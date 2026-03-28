import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import { getDb } from "../db";
import {
  forms,
  formSubmissions,
  contacts,
  type FormField,
  type FormSettings,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { onFormSubmitted } from "../services/workflowTriggers";
import { notifyOwner } from "../_core/notification";

// ─── Zod schemas for form fields ───
const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "email", "phone", "dropdown", "checkbox", "date"]),
  label: z.string().min(1),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  contactFieldMapping: z.string().optional(),
});

const formSettingsSchema = z
  .object({
    submitButtonText: z.string().optional(),
    successMessage: z.string().optional(),
    redirectUrl: z.string().optional(),
    headerText: z.string().optional(),
    description: z.string().optional(),
    styling: z
      .object({
        primaryColor: z.string().optional(),
        backgroundColor: z.string().optional(),
        fontFamily: z.string().optional(),
      })
      .optional(),
  })
  .optional();

// ─── Helper: generate slug from name ───
function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

export const formsRouter = router({
  // ─── List all forms for an account ───
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(forms)
        .where(eq(forms.accountId, input.accountId))
        .orderBy(desc(forms.createdAt));

      return result;
    }),

  // ─── Get form by ID ───
  getById: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        formId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [form] = await db
        .select()
        .from(forms)
        .where(
          and(eq(forms.id, input.formId), eq(forms.accountId, input.accountId))
        );

      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
      return form;
    }),

  // ─── Create a new form ───
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        fields: z.array(formFieldSchema).min(1),
        settings: formSettingsSchema,
        submitAction: z
          .enum(["create_contact", "update_contact", "notify_only"])
          .default("create_contact"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const slug = generateSlug(input.name);

      const [result] = await db.insert(forms).values({
        accountId: input.accountId,
        name: input.name,
        slug,
        fields: input.fields as FormField[],
        settings: (input.settings ?? {}) as FormSettings,
        submitAction: input.submitAction,
        createdById: ctx.user.id,
      });

      return { id: result.insertId, slug };
    }),

  // ─── Update an existing form ───
  update: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        formId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        fields: z.array(formFieldSchema).min(1).optional(),
        settings: formSettingsSchema,
        submitAction: z
          .enum(["create_contact", "update_contact", "notify_only"])
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.fields !== undefined) updates.fields = input.fields;
      if (input.settings !== undefined) updates.settings = input.settings;
      if (input.submitAction !== undefined)
        updates.submitAction = input.submitAction;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      await db
        .update(forms)
        .set(updates)
        .where(
          and(eq(forms.id, input.formId), eq(forms.accountId, input.accountId))
        );

      return { success: true };
    }),

  // ─── Delete a form ───
  delete: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        formId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(forms)
        .where(
          and(eq(forms.id, input.formId), eq(forms.accountId, input.accountId))
        );

      return { success: true };
    }),

  // ─── List submissions for a form ───
  listSubmissions: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        formId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [submissions, [countRow]] = await Promise.all([
        db
          .select()
          .from(formSubmissions)
          .where(
            and(
              eq(formSubmissions.formId, input.formId),
              eq(formSubmissions.accountId, input.accountId)
            )
          )
          .orderBy(desc(formSubmissions.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(formSubmissions)
          .where(
            and(
              eq(formSubmissions.formId, input.formId),
              eq(formSubmissions.accountId, input.accountId)
            )
          ),
      ]);

      return { submissions, total: countRow?.count ?? 0 };
    }),

  // ─── Get public form by slug (no auth required) ───
  getPublicForm: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [form] = await db
        .select({
          id: forms.id,
          name: forms.name,
          slug: forms.slug,
          fields: forms.fields,
          settings: forms.settings,
          isActive: forms.isActive,
        })
        .from(forms)
        .where(and(eq(forms.slug, input.slug), eq(forms.isActive, true)));

      if (!form)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found or inactive",
        });

      return form;
    }),

  // ─── Submit a public form (no auth required) ───
  submitPublicForm: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        data: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Look up the form
      const [form] = await db
        .select()
        .from(forms)
        .where(and(eq(forms.slug, input.slug), eq(forms.isActive, true)));

      if (!form)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found or inactive",
        });

      let contactId: number | null = null;

      // Extract contact fields from submission data based on field mappings
      const fieldMappings: Record<string, string> = {};
      for (const field of form.fields as FormField[]) {
        if (field.contactFieldMapping && input.data[field.id] !== undefined) {
          fieldMappings[field.contactFieldMapping] = String(
            input.data[field.id]
          );
        }
      }

      if (
        form.submitAction === "create_contact" ||
        form.submitAction === "update_contact"
      ) {
        // Try to find existing contact by email or phone
        const email = fieldMappings.email || null;
        const phone = fieldMappings.phone || null;

        if (email || phone) {
          const conditions = [];
          if (email) {
            conditions.push(
              and(
                eq(contacts.accountId, form.accountId),
                eq(contacts.email, email)
              )
            );
          }
          if (phone) {
            conditions.push(
              and(
                eq(contacts.accountId, form.accountId),
                eq(contacts.phone, phone)
              )
            );
          }

          // Search for existing contact
          let existingContact = null;
          for (const cond of conditions) {
            const [found] = await db
              .select({ id: contacts.id })
              .from(contacts)
              .where(cond!)
              .limit(1);
            if (found) {
              existingContact = found;
              break;
            }
          }

          if (existingContact && form.submitAction === "update_contact") {
            // Update existing contact with mapped fields
            contactId = existingContact.id;
            const updateData: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(fieldMappings)) {
              if (key !== "email" && key !== "phone") {
                updateData[key] = value;
              }
            }
            if (Object.keys(updateData).length > 0) {
              await db
                .update(contacts)
                .set(updateData)
                .where(eq(contacts.id, existingContact.id));
            }
          } else if (!existingContact && form.submitAction === "create_contact") {
            // Create new contact
            const [newContact] = await db.insert(contacts).values({
              accountId: form.accountId,
              firstName: fieldMappings.firstName || "Unknown",
              lastName: fieldMappings.lastName || "",
              email: email,
              phone: phone,
              leadSource: "form",
              status: "new",
            });
            contactId = newContact.insertId;
          } else if (existingContact) {
            contactId = existingContact.id;
          }
        }
      }

      // Save the submission
      const ipAddress =
        (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        ctx.req.socket.remoteAddress ||
        null;
      const userAgent =
        (ctx.req.headers["user-agent"] as string) || null;

      await db.insert(formSubmissions).values({
        formId: form.id,
        accountId: form.accountId,
        contactId,
        data: input.data,
        ipAddress,
        userAgent,
      });

      // Fire form_submitted workflow trigger
      if (contactId) {
        try {
          await onFormSubmitted(form.accountId, contactId, String(form.id));
        } catch (err) {
          console.error("[Forms] Error firing form_submitted trigger:", err);
        }
      }

      // Notify owner (non-critical)
      notifyOwner({
        title: `New form submission: ${form.name}`,
        content: `A new submission was received for form "${form.name}". ${contactId ? `Contact #${contactId} was ${form.submitAction === "create_contact" ? "created" : "matched"}.` : "No contact was created."}`,
      }).catch(() => {});

      return {
        success: true,
        contactId,
        message:
          form.settings?.successMessage ||
          "Thank you! Your submission has been received.",
        redirectUrl: form.settings?.redirectUrl || null,
      };
    }),

  // ─── Get submission stats for a form ───
  submissionStats: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        formId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = Date.now();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const [totalRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.formId, input.formId),
            eq(formSubmissions.accountId, input.accountId)
          )
        );

      const [last7Row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.formId, input.formId),
            eq(formSubmissions.accountId, input.accountId),
            sql`${formSubmissions.createdAt} >= ${sevenDaysAgo}`
          )
        );

      const [last30Row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.formId, input.formId),
            eq(formSubmissions.accountId, input.accountId),
            sql`${formSubmissions.createdAt} >= ${thirtyDaysAgo}`
          )
        );

      return {
        total: totalRow?.count ?? 0,
        last7Days: last7Row?.count ?? 0,
        last30Days: last30Row?.count ?? 0,
      };
    }),
});
