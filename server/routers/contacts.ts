import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { isValidE164, normalizeToE164, E164_ERROR_MESSAGE } from "../../shared/phone";
import { routeLeadsBatch } from "../services/leadRoutingEngine";
import { getAccountCustomFieldDefs, validateCustomFields } from "./customFields";
import {
  createContact,
  getContactById,
  listContacts,
  updateContact,
  deleteContact,
  assignContact,
  getContactStats,
  getContactTags,
  addContactTag,
  removeContactTag,
  listAllTagsForAccount,
  createContactNote,
  listContactNotes,
  updateContactNote,
  deleteContactNote,
  getContactNoteById,
  getMember,
  createAuditLog,
  getContactActivities,
  logContactActivity,
  findContactByEmail,
  findContactByPhone,
  bulkAssignContacts,
  getContactIdsByFilter,
  listMembers,
  findExistingEmails,
  findExistingPhones,
} from "../db";

// ─── Tenant guard: verify user is a member of the account ───
// Platform admins (role='admin' on users table) bypass this check
export async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
  // Platform admins can access any account
  if (userRole === "admin") {
    // Try to get membership; if they're a member return it, otherwise return a synthetic admin membership
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }

  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account",
    });
  }
  return member;
}

// ─── Zod schemas ───
const contactStatusEnum = z.enum([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
]);

export const contactsRouter = router({
  // ─── Create contact ───
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().max(320).optional().or(z.literal("")),
        phone: z.string().max(30).optional().or(z.literal("")),
        leadSource: z.string().max(100).optional(),
        status: contactStatusEnum.optional(),
        assignedUserId: z.number().int().positive().optional(),
        company: z.string().max(255).optional(),
        title: z.string().max(255).optional(),
        address: z.string().optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        zip: z.string().max(20).optional(),
        tags: z.array(z.string().max(100)).optional(),
        customFields: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const { tags, customFields: rawCustomFields, ...contactData } = input;

      // Validate custom fields against definitions
      let validatedCustomFields: Record<string, unknown> | null = null;
      if (rawCustomFields && Object.keys(rawCustomFields).length > 0) {
        const defs = await getAccountCustomFieldDefs(input.accountId);
        validatedCustomFields = validateCustomFields(rawCustomFields, defs, { requireAll: true });
      }
      // Normalize empty strings to null
      let phone = contactData.phone || null;
      // Validate and normalize phone to E.164 if provided
      if (phone) {
        const normalized = normalizeToE164(phone);
        if (!normalized || !isValidE164(normalized)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E164_ERROR_MESSAGE,
          });
        }
        phone = normalized;
      }
      const normalizedData = {
        ...contactData,
        email: contactData.email || null,
        phone,
        customFields: validatedCustomFields ? JSON.stringify(validatedCustomFields) : null,
      };

      const { id } = await createContact(normalizedData);

      // Add tags if provided
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await addContactTag(id, tag.trim());
        }
        // Fire tag_added triggers for each tag (async, non-blocking)
        import("../services/workflowTriggers").then(({ onTagAdded }) => {
          for (const tag of tags) {
            onTagAdded(input.accountId, id, tag.trim()).catch((err: unknown) =>
              console.error("[Trigger] onTagAdded error:", err)
            );
          }
        });
      }

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contact.created",
        resourceType: "contact",
        resourceId: id,
      });

      // Log activity
      logContactActivity({
        contactId: id,
        accountId: input.accountId,
        activityType: "contact_created",
        description: `Contact ${input.firstName} ${input.lastName} was created`,
      });

      // Fire automation triggers (async, non-blocking)
      import("../services/workflowTriggers").then(({ onContactCreated }) => {
        onContactCreated(input.accountId, id).catch((err: unknown) =>
          console.error("[Trigger] onContactCreated error:", err)
        );
      });

      // If lead source is facebook, also fire the facebook_lead_received trigger
      if (input.leadSource?.toLowerCase().includes("facebook")) {
        import("../services/workflowTriggers").then(({ onFacebookLeadReceived }) => {
          onFacebookLeadReceived(input.accountId, id).catch((err: unknown) =>
            console.error("[Trigger] onFacebookLeadReceived error:", err)
          );
        });
      }

      return { id };
    }),

  // ─── List contacts with search/filter/pagination ───
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        search: z.string().optional(),
        status: contactStatusEnum.optional(),
        leadSource: z.string().optional(),
        assignedUserId: z.number().int().positive().optional(),
        tag: z.string().optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
        customFieldFilters: z
          .array(
            z.object({
              slug: z.string(),
              operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty"]),
              value: z.string().optional(),
            })
          )
          .optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listContacts(input);
    }),

  // ─── Get single contact ───
  get: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.id, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }
      return contact;
    }),

  // ─── Update contact ───
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        email: z.string().email().max(320).optional().or(z.literal("")),
        phone: z.string().max(30).optional().or(z.literal("")),
        leadSource: z.string().max(100).optional().nullable(),
        status: contactStatusEnum.optional(),
        assignedUserId: z.number().int().positive().optional().nullable(),
        company: z.string().max(255).optional().nullable(),
        title: z.string().max(255).optional().nullable(),
        address: z.string().optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        state: z.string().max(100).optional().nullable(),
        zip: z.string().max(20).optional().nullable(),
        customFields: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getContactById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }

      const { id, accountId, customFields: rawCustomFields, ...updateData } = input;

      // Validate and merge custom fields
      let mergedCustomFields: string | undefined;
      if (rawCustomFields !== undefined) {
        const defs = await getAccountCustomFieldDefs(accountId);
        const existingCf = existing.customFields ? JSON.parse(existing.customFields) : {};
        const merged = { ...existingCf, ...rawCustomFields };
        const validated = validateCustomFields(merged, defs);
        mergedCustomFields = JSON.stringify(validated);
      }
      // Normalize empty strings to null for email/phone
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          normalized[key] = value === "" ? null : value;
        }
      }
      // Validate and normalize phone to E.164 if provided
      if (normalized.phone && typeof normalized.phone === "string") {
        const normalizedPhone = normalizeToE164(normalized.phone);
        if (!normalizedPhone || !isValidE164(normalizedPhone)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E164_ERROR_MESSAGE,
          });
        }
        normalized.phone = normalizedPhone;
      }

      // Add merged custom fields to update data
      if (mergedCustomFields !== undefined) {
        normalized.customFields = mergedCustomFields;
      }

      await updateContact(id, accountId, normalized);

      // Fire pipeline stage changed trigger if status changed
      if (normalized.status && normalized.status !== existing.status) {
        import("../services/workflowTriggers").then(({ onPipelineStageChanged }) => {
          onPipelineStageChanged(
            accountId,
            id,
            existing.status || "new",
            normalized.status as string
          ).catch((err: unknown) =>
            console.error("[Trigger] onPipelineStageChanged error:", err)
          );
        });
      }

      await createAuditLog({
        accountId,
        userId: ctx.user.id,
        action: "contact.updated",
        resourceType: "contact",
        resourceId: id,
      });

      return { success: true };
    }),

  // ─── Delete contact ───
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(
        ctx.user.id,
        input.accountId,
        ctx.user.role
      );

      // Only owner/manager can delete
      if (member.role === "employee") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Employees cannot delete contacts",
        });
      }

      const existing = await getContactById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }

      await deleteContact(input.id, input.accountId);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contact.deleted",
        resourceType: "contact",
        resourceId: input.id,
      });

      return { success: true };
    }),

  // ─── Assign contact to team member ───
  assign: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        assignedUserId: z.number().int().positive().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // If assigning to someone, verify they're a member
      if (input.assignedUserId) {
        const targetMember = await getMember(
          input.accountId,
          input.assignedUserId
        );
        if (!targetMember || !targetMember.isActive) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Target user is not an active member of this account",
          });
        }
      }

      await assignContact(input.id, input.accountId, input.assignedUserId);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contact.assigned",
        resourceType: "contact",
        resourceId: input.id,
        metadata: JSON.stringify({
          assignedUserId: input.assignedUserId,
        }),
      });

      return { success: true };
    }),

  // ─── Contact stats for an account ───
  stats: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getContactStats(input.accountId);
    }),

  // ─── Tags ───
  getTags: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      // Verify contact belongs to account
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }
      return getContactTags(input.contactId);
    }),

  addTag: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        tag: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }
      const result = await addContactTag(input.contactId, input.tag.trim());

      // Log activity
      logContactActivity({
        contactId: input.contactId,
        accountId: input.accountId,
        activityType: "tag_added",
        description: `Tag "${input.tag.trim()}" was added`,
        metadata: JSON.stringify({ tag: input.tag.trim() }),
      });

      // Fire automation trigger (async, non-blocking)
      import("../services/workflowTriggers").then(({ onTagAdded }) => {
        onTagAdded(input.accountId, input.contactId, input.tag.trim()).catch((err: unknown) =>
          console.error("[Trigger] onTagAdded error:", err)
        );
      });

      return result;
    }),

  removeTag: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        tag: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }
      await removeContactTag(input.contactId, input.tag);

      // Log activity
      logContactActivity({
        contactId: input.contactId,
        accountId: input.accountId,
        activityType: "tag_removed",
        description: `Tag "${input.tag}" was removed`,
        metadata: JSON.stringify({ tag: input.tag }),
      });

      return { success: true };
    }),

  allTags: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listAllTagsForAccount(input.accountId);
    }),

  // ─── Notes ───
  listNotes: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }
      return listContactNotes(input.contactId);
    }),

  addNote: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }
      const note = await createContactNote({
        contactId: input.contactId,
        authorId: ctx.user.id,
        content: input.content,
      });

      // Log activity
      logContactActivity({
        contactId: input.contactId,
        accountId: input.accountId,
        activityType: "note_added",
        description: `Note added: ${input.content.substring(0, 100)}${input.content.length > 100 ? "..." : ""}`,
        metadata: JSON.stringify({ noteId: note.id }),
      });

      return note;
    }),

  updateNote: protectedProcedure
    .input(
      z.object({
        noteId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        content: z.string().min(1).max(5000).optional(),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const note = await getContactNoteById(input.noteId);
      if (!note) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Note not found",
        });
      }
      // Verify the contact belongs to this account
      const contact = await getContactById(note.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Note does not belong to this account",
        });
      }
      const updateData: { content?: string; isPinned?: boolean } = {};
      if (input.content !== undefined) updateData.content = input.content;
      if (input.isPinned !== undefined) updateData.isPinned = input.isPinned;
      await updateContactNote(input.noteId, updateData);
      return { success: true };
    }),

  deleteNote: protectedProcedure
    .input(
      z.object({
        noteId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const note = await getContactNoteById(input.noteId);
      if (!note) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Note not found",
        });
      }
      const contact = await getContactById(note.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Note does not belong to this account",
        });
      }
      await deleteContactNote(input.noteId);
      return { success: true };
    }),

  // ─── Activity Timeline ───
  getActivity: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }
      return getContactActivities(input.contactId, input.accountId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // ─── Bulk import contacts from CSV ───
  importContacts: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contacts: z.array(
          z.object({
            firstName: z.string().max(100).optional().default(""),
            lastName: z.string().max(100).optional().default(""),
            email: z.string().max(320).optional().default(""),
            phone: z.string().max(30).optional().default(""),
            tags: z.string().optional().default(""),
            notes: z.string().optional().default(""),
            customFields: z.record(z.string(), z.string()).optional(),
          })
        ).min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      let imported = 0;
      let skipped = 0;
      let failed = 0;
      const errorRows: Array<{ row: number; data: Record<string, string>; reason: string }> = [];
      const importedContacts: Array<{ contactId: number; tags?: string[]; leadSource?: string }> = [];

      // ── Phase 1: Pre-process all rows (normalize, validate) ──
      // Load custom field definitions once for the entire import
      const customFieldDefs = await getAccountCustomFieldDefs(input.accountId);

      type ProcessedRow = {
        rowNum: number;
        firstName: string;
        lastName: string;
        email: string;
        normalizedPhone: string | null;
        tagsStr: string;
        notes: string;
        customFields: Record<string, string> | null;
      };
      const validRows: ProcessedRow[] = [];

      for (let i = 0; i < input.contacts.length; i++) {
        const row = input.contacts[i];
        const rowNum = i + 1;
        const firstName = row.firstName?.trim() || "";
        const lastName = row.lastName?.trim() || "";
        const email = row.email?.trim() || "";
        const rawPhone = row.phone?.trim() || "";
        const tagsStr = row.tags?.trim() || "";
        const notes = row.notes?.trim() || "";

        if (!firstName && !lastName && !rawPhone) {
          failed++;
          errorRows.push({
            row: rowNum,
            data: { firstName, lastName, email, phone: rawPhone, tags: tagsStr, notes },
            reason: "At least one of First Name, Last Name, or Phone is required",
          });
          continue;
        }

        let normalizedPhone: string | null = null;
        if (rawPhone) {
          const normalized = normalizeToE164(rawPhone);
          if (normalized && isValidE164(normalized)) {
            normalizedPhone = normalized;
          }
        }

        // Process custom fields for this row
        let rowCustomFields: Record<string, string> | null = null;
        if (row.customFields && Object.keys(row.customFields).length > 0) {
          try {
            rowCustomFields = validateCustomFields(row.customFields, customFieldDefs) as Record<string, string>;
          } catch (err) {
            failed++;
            errorRows.push({
              row: rowNum,
              data: { firstName, lastName, email, phone: rawPhone, tags: tagsStr, notes },
              reason: err instanceof Error ? err.message : "Invalid custom fields",
            });
            continue;
          }
        }

        validRows.push({ rowNum, firstName, lastName, email, normalizedPhone, tagsStr, notes, customFields: rowCustomFields });
      }

      // ── Phase 2: Bulk duplicate check (batch queries instead of N individual queries) ──
      const allEmails = validRows.filter((r) => r.email).map((r) => r.email.toLowerCase());
      const allPhones = validRows.filter((r) => r.normalizedPhone).map((r) => r.normalizedPhone!);

      const existingEmails = await findExistingEmails(allEmails, input.accountId);
      const existingPhones = await findExistingPhones(allPhones, input.accountId);

      // Also track emails/phones we insert during this import to catch intra-batch duplicates
      const importedEmails = new Set<string>();
      const importedPhones = new Set<string>();

      // Filter out duplicates
      const toInsert: ProcessedRow[] = [];
      for (const row of validRows) {
        const emailLower = row.email?.toLowerCase() || "";
        if (emailLower && (existingEmails.has(emailLower) || importedEmails.has(emailLower))) {
          skipped++;
          continue;
        }
        if (row.normalizedPhone && (existingPhones.has(row.normalizedPhone) || importedPhones.has(row.normalizedPhone))) {
          skipped++;
          continue;
        }
        toInsert.push(row);
        if (emailLower) importedEmails.add(emailLower);
        if (row.normalizedPhone) importedPhones.add(row.normalizedPhone);
      }

      // ── Phase 3: Batched inserts (500 rows at a time) ──
      const BATCH_SIZE = 500;
      for (let batchStart = 0; batchStart < toInsert.length; batchStart += BATCH_SIZE) {
        const batch = toInsert.slice(batchStart, batchStart + BATCH_SIZE);

        for (const row of batch) {
          try {
            const { id } = await createContact({
              accountId: input.accountId,
              firstName: row.firstName || "Unknown",
              lastName: row.lastName || "",
              email: row.email || null,
              phone: row.normalizedPhone,
              status: "new",
              customFields: row.customFields ? JSON.stringify(row.customFields) : null,
            });

            // Add tags if provided (comma-separated)
            if (row.tagsStr) {
              const tags = row.tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
              for (const tag of tags) {
                await addContactTag(id, tag);
              }
            }

            // Add notes as a contact note if provided
            if (row.notes) {
              await createContactNote({
                contactId: id,
                authorId: ctx.user.id,
                content: row.notes,
              });
            }

            // Log activity (fire-and-forget)
            logContactActivity({
              contactId: id,
              accountId: input.accountId,
              activityType: "contact_created",
              description: `Contact ${row.firstName} ${row.lastName} imported via CSV`,
            });

            const parsedTags = row.tagsStr ? row.tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];
            importedContacts.push({ contactId: id, tags: parsedTags, leadSource: "csv_import" });

            imported++;
          } catch (err) {
            failed++;
            errorRows.push({
              row: row.rowNum,
              data: {
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                phone: row.normalizedPhone || "",
                tags: row.tagsStr,
                notes: row.notes,
              },
              reason: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      }

      // ── Phase 4: Auto-route imported leads via routing rules ──
      let routingResult = { totalRouted: 0, totalUnrouted: 0, routingDetails: [] as any[] };
      if (importedContacts.length > 0) {
        try {
          routingResult = await routeLeadsBatch(
            importedContacts,
            input.accountId,
            "csv_import"
          );
        } catch (err) {
          console.error("[CSV Import] Lead routing failed (non-blocking):", err);
        }
      }

      // Audit log for the bulk import
      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contacts.bulk_import",
        resourceType: "contact",
        resourceId: 0,
        metadata: JSON.stringify({ imported, skipped, failed, routed: routingResult.totalRouted }),
      });

      return {
        imported,
        skipped,
        failed,
        errorRows: errorRows.slice(0, 100), // Cap error rows to prevent huge responses
        routed: routingResult.totalRouted,
        unrouted: routingResult.totalUnrouted,
      };
    }),

  // ─── Bulk assign contacts to a user ───
  bulkAssign: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactIds: z.array(z.number().int().positive()).min(1).max(5000),
        assignedUserId: z.number().int().positive().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // Verify the target user is a member of the account (if assigning)
      if (input.assignedUserId) {
        const member = await getMember(input.accountId, input.assignedUserId);
        if (!member) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Target user is not a member of this account.",
          });
        }
      }

      const result = await bulkAssignContacts(
        input.contactIds,
        input.accountId,
        input.assignedUserId
      );

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contacts.bulk_assign",
        resourceType: "contact",
        resourceId: 0,
        metadata: JSON.stringify({
          contactCount: input.contactIds.length,
          assignedUserId: input.assignedUserId,
        }),
      });

      return { success: true, updated: result.updated };
    }),

  // ─── Distribute leads evenly among multiple users ───
  distributeLeads: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactIds: z.array(z.number().int().positive()).min(1).max(10000),
        userIds: z.array(z.number().int().positive()).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // Verify all target users are members
      for (const userId of input.userIds) {
        const member = await getMember(input.accountId, userId);
        if (!member) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `User ${userId} is not a member of this account.`,
          });
        }
      }

      // Round-robin distribution
      const assignments: Record<number, number[]> = {};
      for (const userId of input.userIds) {
        assignments[userId] = [];
      }

      input.contactIds.forEach((contactId, idx) => {
        const userId = input.userIds[idx % input.userIds.length];
        assignments[userId].push(contactId);
      });

      // Execute bulk assignments
      const results: Array<{ userId: number; count: number }> = [];
      for (const [userIdStr, ids] of Object.entries(assignments)) {
        const userId = parseInt(userIdStr, 10);
        if (ids.length > 0) {
          await bulkAssignContacts(ids, input.accountId, userId);
          results.push({ userId, count: ids.length });
        }
      }

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contacts.distribute_leads",
        resourceType: "contact",
        resourceId: 0,
        metadata: JSON.stringify({
          totalContacts: input.contactIds.length,
          distribution: results,
        }),
      });

      return { success: true, distribution: results };
    }),

  // ─── Get contact IDs by filter (for distribute leads UI) ───
  getFilteredIds: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        tag: z.string().optional(),
        status: z.string().optional(),
        leadSource: z.string().optional(),
        search: z.string().optional(),
        unassignedOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const ids = await getContactIdsByFilter(input.accountId, {
        tag: input.tag,
        status: input.status,
        leadSource: input.leadSource,
        search: input.search,
        unassignedOnly: input.unassignedOnly,
      });
      return { ids, total: ids.length };
    }),

  // ─── Export contacts as CSV-ready data (includes custom fields) ───
  exportContacts: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactIds: z.array(z.number().int().positive()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const db = (await import("../db")).getDb();
      const dbInstance = await db;
      if (!dbInstance) return { headers: [], rows: [] };

      const { contacts } = await import("../../drizzle/schema");
      const { eq, inArray, and } = await import("drizzle-orm");

      // Fetch contacts
      let contactList;
      if (input.contactIds && input.contactIds.length > 0) {
        contactList = await dbInstance
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.accountId, input.accountId),
              inArray(contacts.id, input.contactIds)
            )
          );
      } else {
        contactList = await dbInstance
          .select()
          .from(contacts)
          .where(eq(contacts.accountId, input.accountId));
      }

      // Fetch custom field definitions for column headers
      const fieldDefs = await getAccountCustomFieldDefs(input.accountId);

      // Fetch tags for all contacts
      const { contactTags } = await import("../../drizzle/schema");
      const allTags = await dbInstance
        .select()
        .from(contactTags)
        .where(
          inArray(
            contactTags.contactId,
            contactList.map((c) => c.id)
          )
        );
      const tagsByContact = new Map<number, string[]>();
      for (const t of allTags) {
        const arr = tagsByContact.get(t.contactId) || [];
        arr.push(t.tag);
        tagsByContact.set(t.contactId, arr);
      }

      // Build headers: standard fields + custom field columns
      const standardHeaders = [
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Company",
        "Title",
        "Status",
        "Lead Source",
        "Address",
        "City",
        "State",
        "ZIP",
        "Tags",
      ];
      const customHeaders = fieldDefs.map((d) => d.name);
      const headers = [...standardHeaders, ...customHeaders];

      // Build rows
      const rows = contactList.map((c) => {
        const cf = c.customFields ? JSON.parse(c.customFields) : {};
        const tags = tagsByContact.get(c.id)?.join(", ") || "";
        const standardValues = [
          c.firstName,
          c.lastName,
          c.email || "",
          c.phone || "",
          c.company || "",
          c.title || "",
          c.status,
          c.leadSource || "",
          c.address || "",
          c.city || "",
          c.state || "",
          c.zip || "",
          tags,
        ];
        const customValues = fieldDefs.map((d) => {
          const val = cf[d.slug];
          if (val === null || val === undefined) return "";
          if (typeof val === "boolean") return val ? "Yes" : "No";
          return String(val);
        });
        return [...standardValues, ...customValues];
      });

      return { headers, rows, fieldDefs: fieldDefs.map((d) => ({ slug: d.slug, name: d.name, type: d.type })) };
    }),

  // ─── Bulk Update Custom Field ───
  bulkUpdateCustomField: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactIds: z.array(z.number().int().positive()).min(1).max(5000),
        fieldSlug: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      await requireAccountMember(userId, input.accountId, ctx.user.role);

      // Validate the field slug exists for this account
      const fieldDefs = await getAccountCustomFieldDefs(input.accountId);
      const fieldDef = fieldDefs.find((d) => d.slug === input.fieldSlug);
      if (!fieldDef) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Custom field "${input.fieldSlug}" does not exist for this account.` });
      }

      // Validate value against field type (validateCustomFields throws TRPCError on invalid)
      if (input.value !== null) {
        const testObj: Record<string, unknown> = { [input.fieldSlug]: input.value };
        validateCustomFields(testObj, fieldDefs);
      }

      // Perform bulk update — merge into each contact's customFields JSON
      const { getDb: getBulkDb } = await import("../db");
      const bulkDb = await getBulkDb();
      if (!bulkDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { contacts: contactsTable } = await import("../../drizzle/schema");
      const { eq, and, inArray } = await import("drizzle-orm");

      // Fetch all target contacts in this account
      const targetContacts = await bulkDb
        .select({ id: contactsTable.id, customFields: contactsTable.customFields })
        .from(contactsTable)
        .where(
          and(
            eq(contactsTable.accountId, input.accountId),
            inArray(contactsTable.id, input.contactIds)
          )
        );

      let updatedCount = 0;
      for (const contact of targetContacts) {
        const existing: Record<string, unknown> = contact.customFields
          ? JSON.parse(contact.customFields as string)
          : {};

        if (input.value === null) {
          delete existing[input.fieldSlug];
        } else {
          existing[input.fieldSlug] = input.value;
        }

        await bulkDb
          .update(contactsTable)
          .set({ customFields: JSON.stringify(existing) })
          .where(eq(contactsTable.id, contact.id));
        updatedCount++;
      }

      await createAuditLog({
        accountId: input.accountId,
        userId,
        action: "contacts.bulk_update_custom_field",
        resourceType: "contact",
        metadata: JSON.stringify({
          fieldSlug: input.fieldSlug,
          value: input.value,
          contactCount: updatedCount,
        }),
      });

      return { updatedCount };
    }),
});
