import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { isValidE164, normalizeToE164, E164_ERROR_MESSAGE } from "../../shared/phone";
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
} from "../db";

// ─── Tenant guard: verify user is a member of the account ───
// Platform admins (role='admin' on users table) bypass this check
async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const { tags, ...contactData } = input;
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
      };

      const { id } = await createContact(normalizedData);

      // Add tags if provided
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await addContactTag(id, tag.trim());
        }
      }

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contact.created",
        resourceType: "contact",
        resourceId: id,
      });

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

      const { id, accountId, ...updateData } = input;
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

      await updateContact(id, accountId, normalized);

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
      return addContactTag(input.contactId, input.tag.trim());
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
      return createContactNote({
        contactId: input.contactId,
        authorId: ctx.user.id,
        content: input.content,
      });
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
});
