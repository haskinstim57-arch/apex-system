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
import { storagePut } from "../storage";

// ─── Zod schemas for form fields ───
const conditionRuleSchema = z.object({
  fieldId: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "is_empty", "is_not_empty"]),
  value: z.string().optional(),
});

const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "email", "phone", "dropdown", "checkbox", "date", "file"]),
  label: z.string().min(1),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  contactFieldMapping: z.string().optional(),
  conditionRules: z.array(conditionRuleSchema).optional(),
  acceptedFileTypes: z.string().optional(),
  maxFileSizeMB: z.number().positive().max(50).optional(),
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

// ─── Pre-built form templates ───
const FORM_TEMPLATES: {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: FormField[];
  settings: FormSettings;
  submitAction: "create_contact" | "update_contact" | "notify_only";
}[] = [
  {
    id: "mortgage_inquiry",
    name: "Mortgage Inquiry",
    description: "Capture mortgage leads with loan details and pre-qualification info.",
    category: "Mortgage",
    fields: [
      { id: "f1", type: "text", label: "First Name", required: true, placeholder: "Enter your first name", contactFieldMapping: "firstName" },
      { id: "f2", type: "text", label: "Last Name", required: true, placeholder: "Enter your last name", contactFieldMapping: "lastName" },
      { id: "f3", type: "email", label: "Email", required: true, placeholder: "you@example.com", contactFieldMapping: "email" },
      { id: "f4", type: "phone", label: "Phone", required: true, placeholder: "(555) 123-4567", contactFieldMapping: "phone" },
      { id: "f5", type: "dropdown", label: "Loan Type", required: true, options: ["Purchase", "Refinance", "Cash-Out Refinance", "FHA", "VA", "USDA", "Jumbo"] },
      { id: "f6", type: "text", label: "Desired Loan Amount", required: true, placeholder: "$250,000" },
      { id: "f7", type: "dropdown", label: "Credit Score Range", required: false, options: ["Excellent (740+)", "Good (670-739)", "Fair (580-669)", "Below 580", "Not Sure"] },
      { id: "f8", type: "dropdown", label: "Timeline", required: false, options: ["Immediately", "1-3 months", "3-6 months", "6+ months", "Just exploring"] },
      { id: "f9", type: "checkbox", label: "I agree to be contacted regarding my inquiry", required: true },
    ],
    settings: {
      headerText: "Get Your Free Mortgage Quote",
      description: "Fill out the form below and a loan officer will contact you within 24 hours.",
      submitButtonText: "Get My Quote",
      successMessage: "Thank you! A loan officer will be in touch shortly.",
      styling: { primaryColor: "#1e40af" },
    },
    submitAction: "create_contact",
  },
  {
    id: "contact_us",
    name: "Contact Us",
    description: "General contact form for inquiries and support requests.",
    category: "General",
    fields: [
      { id: "f1", type: "text", label: "Full Name", required: true, placeholder: "Your full name", contactFieldMapping: "firstName" },
      { id: "f2", type: "email", label: "Email", required: true, placeholder: "you@example.com", contactFieldMapping: "email" },
      { id: "f3", type: "phone", label: "Phone", required: false, placeholder: "(555) 123-4567", contactFieldMapping: "phone" },
      { id: "f4", type: "dropdown", label: "Subject", required: true, options: ["General Inquiry", "Support", "Partnership", "Feedback", "Other"] },
      { id: "f5", type: "text", label: "Message", required: true, placeholder: "How can we help you?" },
    ],
    settings: {
      headerText: "Contact Us",
      description: "We'd love to hear from you. Fill out the form and we'll get back to you soon.",
      submitButtonText: "Send Message",
      successMessage: "Thank you for reaching out! We'll respond within 1 business day.",
      styling: { primaryColor: "#059669" },
    },
    submitAction: "create_contact",
  },
  {
    id: "refinance_application",
    name: "Refinance Application",
    description: "Detailed refinance application with property and financial details.",
    category: "Mortgage",
    fields: [
      { id: "f1", type: "text", label: "First Name", required: true, placeholder: "First name", contactFieldMapping: "firstName" },
      { id: "f2", type: "text", label: "Last Name", required: true, placeholder: "Last name", contactFieldMapping: "lastName" },
      { id: "f3", type: "email", label: "Email", required: true, placeholder: "you@example.com", contactFieldMapping: "email" },
      { id: "f4", type: "phone", label: "Phone", required: true, placeholder: "(555) 123-4567", contactFieldMapping: "phone" },
      { id: "f5", type: "text", label: "Property Address", required: true, placeholder: "123 Main St, City, State ZIP", contactFieldMapping: "address" },
      { id: "f6", type: "text", label: "Estimated Property Value", required: true, placeholder: "$400,000" },
      { id: "f7", type: "text", label: "Current Mortgage Balance", required: true, placeholder: "$300,000" },
      { id: "f8", type: "text", label: "Current Interest Rate", required: false, placeholder: "6.5%" },
      { id: "f9", type: "dropdown", label: "Refinance Goal", required: true, options: ["Lower monthly payment", "Shorten loan term", "Cash out equity", "Remove PMI", "Switch from ARM to fixed"] },
      { id: "f10", type: "dropdown", label: "Employment Status", required: true, options: ["Employed", "Self-employed", "Retired", "Other"] },
      { id: "f11", type: "checkbox", label: "I authorize a credit check for this application", required: true },
    ],
    settings: {
      headerText: "Refinance Application",
      description: "Start your refinance process today. Complete the form and we'll review your options.",
      submitButtonText: "Submit Application",
      successMessage: "Application received! We'll review and contact you within 48 hours.",
      styling: { primaryColor: "#7c3aed" },
    },
    submitAction: "create_contact",
  },
  {
    id: "home_buyer_checklist",
    name: "Home Buyer Pre-Qualification",
    description: "Pre-qualification form for first-time and returning home buyers.",
    category: "Mortgage",
    fields: [
      { id: "f1", type: "text", label: "First Name", required: true, placeholder: "First name", contactFieldMapping: "firstName" },
      { id: "f2", type: "text", label: "Last Name", required: true, placeholder: "Last name", contactFieldMapping: "lastName" },
      { id: "f3", type: "email", label: "Email", required: true, placeholder: "you@example.com", contactFieldMapping: "email" },
      { id: "f4", type: "phone", label: "Phone", required: true, placeholder: "(555) 123-4567", contactFieldMapping: "phone" },
      { id: "f5", type: "dropdown", label: "Buyer Type", required: true, options: ["First-time buyer", "Move-up buyer", "Investor", "Vacation home"] },
      { id: "f6", type: "text", label: "Target Purchase Price", required: true, placeholder: "$350,000" },
      { id: "f7", type: "text", label: "Down Payment Available", required: true, placeholder: "$50,000" },
      { id: "f8", type: "text", label: "Annual Household Income", required: true, placeholder: "$85,000" },
      { id: "f9", type: "dropdown", label: "Credit Score Range", required: true, options: ["Excellent (740+)", "Good (670-739)", "Fair (580-669)", "Below 580", "Not Sure"] },
      { id: "f10", type: "dropdown", label: "When do you plan to buy?", required: true, options: ["Within 30 days", "1-3 months", "3-6 months", "6+ months"] },
      { id: "f11", type: "checkbox", label: "I consent to receive communications about my home buying journey", required: true },
    ],
    settings: {
      headerText: "Get Pre-Qualified Today",
      description: "Find out how much home you can afford. Takes less than 5 minutes.",
      submitButtonText: "Check My Eligibility",
      successMessage: "Great news! We're reviewing your info and will reach out with your pre-qualification details.",
      styling: { primaryColor: "#0891b2" },
    },
    submitAction: "create_contact",
  },
  {
    id: "real_estate_referral",
    name: "Real Estate Agent Referral",
    description: "Referral form for real estate agents to send leads.",
    category: "Referral",
    fields: [
      { id: "f1", type: "text", label: "Agent Name", required: true, placeholder: "Your name" },
      { id: "f2", type: "text", label: "Agent Company", required: true, placeholder: "Brokerage name" },
      { id: "f3", type: "email", label: "Agent Email", required: true, placeholder: "agent@brokerage.com" },
      { id: "f4", type: "phone", label: "Agent Phone", required: true, placeholder: "(555) 123-4567" },
      { id: "f5", type: "text", label: "Client First Name", required: true, placeholder: "Client first name", contactFieldMapping: "firstName" },
      { id: "f6", type: "text", label: "Client Last Name", required: true, placeholder: "Client last name", contactFieldMapping: "lastName" },
      { id: "f7", type: "email", label: "Client Email", required: false, placeholder: "client@email.com", contactFieldMapping: "email" },
      { id: "f8", type: "phone", label: "Client Phone", required: true, placeholder: "(555) 987-6543", contactFieldMapping: "phone" },
      { id: "f9", type: "dropdown", label: "Referral Type", required: true, options: ["Purchase", "Refinance", "Pre-Approval", "Reverse Mortgage"] },
      { id: "f10", type: "text", label: "Additional Notes", required: false, placeholder: "Any details about the client..." },
    ],
    settings: {
      headerText: "Submit a Referral",
      description: "Refer your client for mortgage services. We'll take great care of them.",
      submitButtonText: "Submit Referral",
      successMessage: "Referral received! We'll contact your client within 24 hours and keep you updated.",
      styling: { primaryColor: "#dc2626" },
    },
    submitAction: "create_contact",
  },
];

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

      const [withContactRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.formId, input.formId),
            eq(formSubmissions.accountId, input.accountId),
            sql`${formSubmissions.contactId} IS NOT NULL`
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

      // Daily submissions for last 30 days
      const dailyRows = await db
        .select({
          day: sql<string>`DATE(${formSubmissions.createdAt})`.as("day"),
          count: sql<number>`count(*)`.as("count"),
        })
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.formId, input.formId),
            eq(formSubmissions.accountId, input.accountId),
            sql`${formSubmissions.createdAt} >= ${thirtyDaysAgo}`
          )
        )
        .groupBy(sql`DATE(${formSubmissions.createdAt})`)
        .orderBy(sql`DATE(${formSubmissions.createdAt})`);

      const total = totalRow?.count ?? 0;
      const withContact = withContactRow?.count ?? 0;
      const conversionRate = total > 0 ? Math.round((withContact / total) * 100) : 0;

      return {
        total,
        withContact,
        conversionRate,
        last7Days: last7Row?.count ?? 0,
        last30Days: last30Row?.count ?? 0,
        daily: dailyRows.map((r) => ({ day: r.day, count: r.count })),
      };
    }),

  // ─── List form templates ───
  listTemplates: publicProcedure.query(async () => {
    return FORM_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      fieldCount: t.fields.length,
    }));
  }),

  // ─── Create form from template ───
  createFromTemplate: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        templateId: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const template = FORM_TEMPLATES.find((t) => t.id === input.templateId);
      if (!template)
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const formName = input.name || template.name;
      const slug = generateSlug(formName);

      const [result] = await db.insert(forms).values({
        accountId: input.accountId,
        name: formName,
        slug,
        fields: template.fields,
        settings: template.settings,
        submitAction: template.submitAction,
        createdById: ctx.user.id,
      });

      return { id: result.insertId, slug };
    }),

  // ─── Duplicate a form (for A/B testing or cloning) ───
  duplicate: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        formId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        isAbVariant: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [original] = await db
        .select()
        .from(forms)
        .where(
          and(eq(forms.id, input.formId), eq(forms.accountId, input.accountId))
        );

      if (!original)
        throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });

      const newName = input.name || `${original.name} (Copy)`;
      const slug = generateSlug(newName);

      const [result] = await db.insert(forms).values({
        accountId: input.accountId,
        name: newName,
        slug,
        fields: original.fields,
        settings: original.settings,
        submitAction: original.submitAction,
        createdById: ctx.user.id,
      });

      return { id: result.insertId, slug };
    }),

  // ─── List submissions with contact names ───
  listSubmissionsWithContacts: protectedProcedure
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
          .select({
            id: formSubmissions.id,
            formId: formSubmissions.formId,
            contactId: formSubmissions.contactId,
            data: formSubmissions.data,
            ipAddress: formSubmissions.ipAddress,
            userAgent: formSubmissions.userAgent,
            createdAt: formSubmissions.createdAt,
            contactFirstName: contacts.firstName,
            contactLastName: contacts.lastName,
            contactEmail: contacts.email,
          })
          .from(formSubmissions)
          .leftJoin(contacts, eq(formSubmissions.contactId, contacts.id))
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

  // ─── Upload a file for a form submission (public, no auth) ───
  uploadFormFile: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        fieldId: z.string().min(1),
        fileName: z.string().min(1),
        fileBase64: z.string().min(1),
        contentType: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify form exists and is active
      const [form] = await db
        .select({ id: forms.id, accountId: forms.accountId, fields: forms.fields })
        .from(forms)
        .where(and(eq(forms.slug, input.slug), eq(forms.isActive, true)));

      if (!form)
        throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or inactive" });

      // Verify the field exists and is a file field
      const formFields = form.fields as FormField[];
      const field = formFields.find((f) => f.id === input.fieldId);
      if (!field || field.type !== "file")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file field" });

      // Check file size (base64 is ~33% larger than binary)
      const maxSizeMB = field.maxFileSizeMB || 10;
      const estimatedBytes = (input.fileBase64.length * 3) / 4;
      if (estimatedBytes > maxSizeMB * 1024 * 1024)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File exceeds maximum size of ${maxSizeMB}MB`,
        });

      // Upload to S3
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `form-uploads/${form.accountId}/${form.id}/${input.fieldId}-${randomSuffix}-${safeFileName}`;
      const fileBuffer = Buffer.from(input.fileBase64, "base64");

      const { url } = await storagePut(fileKey, fileBuffer, input.contentType);

      return { url, fileName: input.fileName };
    }),
});
