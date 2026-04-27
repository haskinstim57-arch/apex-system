import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { requireAccountMember } from "./contacts";
import { emailDrafts, emailSignatures, contacts, messages, users, accounts } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { trackUsage } from "../services/usageTracker";
import { dispatchEmail } from "../services/messaging";

// ─── Pre-built Signature Templates ─────────────────────────────────────────
const SIGNATURE_TEMPLATES = [
  {
    id: "professional-classic",
    name: "Professional Classic",
    description: "Clean two-column layout with a vertical divider. Timeless and corporate.",
    category: "professional" as const,
    html: `<table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333;">
  <tr>
    <td style="padding-right: 16px; border-right: 3px solid #0c5ab0; vertical-align: top;">
      {{headshot}}
      <strong style="font-size: 16px; color: #0c5ab0;">{{name}}</strong><br/>
      <span style="font-size: 13px; color: #666;">{{title}}</span><br/>
      <span style="font-size: 13px; color: #666;">{{company}}</span>
    </td>
    <td style="padding-left: 16px; vertical-align: top;">
      <span style="color: #666;">📞 {{phone}}</span><br/>
      <a href="mailto:{{email}}" style="color: #0c5ab0; text-decoration: none;">✉️ {{email}}</a><br/>
      <span style="color: #666;">🌐 {{website}}</span><br/>
      <span style="font-size: 11px; color: #999;">NMLS# {{nmls}}</span>
    </td>
  </tr>
</table>`,
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Sleek single-column design with subtle accent line.",
    category: "modern" as const,
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 14px; color: #2d2d2d;">
  <tr><td style="padding-bottom: 8px;">
    <strong style="font-size: 17px;">{{name}}</strong>
    <span style="color: #999; margin: 0 8px;">|</span>
    <span style="color: #666;">{{title}}</span>
  </td></tr>
  <tr><td style="border-top: 2px solid #0c5ab0; padding-top: 8px;">
    <span style="color: #555;">{{company}}</span><br/>
    <span style="color: #555;">{{phone}} · <a href="mailto:{{email}}" style="color: #0c5ab0; text-decoration: none;">{{email}}</a></span><br/>
    <span style="font-size: 11px; color: #999;">NMLS# {{nmls}}</span>
  </td></tr>
</table>`,
  },
  {
    id: "bold-banner",
    name: "Bold Banner",
    description: "Eye-catching colored header bar with white text.",
    category: "bold" as const,
    html: `<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; width: 100%; max-width: 500px;">
  <tr><td style="background-color: #0c5ab0; padding: 14px 20px; border-radius: 6px 6px 0 0;">
    <strong style="font-size: 18px; color: #ffffff;">{{name}}</strong><br/>
    <span style="font-size: 13px; color: #cce0f5;">{{title}} — {{company}}</span>
  </td></tr>
  <tr><td style="padding: 12px 20px; background: #f8f9fa; border-radius: 0 0 6px 6px; font-size: 13px; color: #555;">
    📞 {{phone}} &nbsp;|&nbsp; ✉️ <a href="mailto:{{email}}" style="color: #0c5ab0;">{{email}}</a> &nbsp;|&nbsp; 🌐 {{website}}<br/>
    <span style="font-size: 11px; color: #999;">NMLS# {{nmls}}</span>
  </td></tr>
</table>`,
  },
  {
    id: "photo-card",
    name: "Photo Card",
    description: "Headshot-focused layout with photo on the left and details on the right.",
    category: "professional" as const,
    html: `<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding-right: 16px; vertical-align: top;">
      {{headshot}}
    </td>
    <td style="vertical-align: top;">
      <strong style="font-size: 16px; color: #1a1a1a;">{{name}}</strong><br/>
      <span style="color: #0c5ab0; font-size: 13px;">{{title}}</span><br/>
      <span style="color: #666; font-size: 13px;">{{company}}</span><br/>
      <br/>
      <span style="font-size: 13px;">📞 {{phone}}</span><br/>
      <a href="mailto:{{email}}" style="color: #0c5ab0; text-decoration: none; font-size: 13px;">{{email}}</a><br/>
      {{logo}}
      <span style="font-size: 11px; color: #999;">NMLS# {{nmls}}</span>
    </td>
  </tr>
</table>`,
  },
  {
    id: "gradient-accent",
    name: "Gradient Accent",
    description: "Modern gradient left border with clean typography.",
    category: "modern" as const,
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="border-left: 4px solid; border-image: linear-gradient(to bottom, #0c5ab0, #38bdf8) 1; padding-left: 14px;">
      <strong style="font-size: 16px;">{{name}}</strong><br/>
      <span style="color: #0c5ab0;">{{title}}</span> · <span style="color: #666;">{{company}}</span><br/>
      <span style="font-size: 13px; color: #555;">{{phone}} · <a href="mailto:{{email}}" style="color: #0c5ab0; text-decoration: none;">{{email}}</a></span><br/>
      <span style="font-size: 11px; color: #aaa;">NMLS# {{nmls}}</span>
    </td>
  </tr>
</table>`,
  },
  {
    id: "mortgage-pro",
    name: "Mortgage Professional",
    description: "Industry-specific template with rate quote CTA and equal housing logo.",
    category: "industry" as const,
    html: `<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 500px;">
  <tr><td style="padding-bottom: 10px;">
    {{headshot}}
    <strong style="font-size: 16px;">{{name}}</strong><br/>
    <span style="color: #0c5ab0;">Licensed Mortgage Loan Originator</span><br/>
    <span style="color: #666;">{{company}}</span>
  </td></tr>
  <tr><td style="border-top: 2px solid #0c5ab0; padding-top: 10px; font-size: 13px;">
    📞 {{phone}} &nbsp;|&nbsp; ✉️ <a href="mailto:{{email}}" style="color: #0c5ab0; text-decoration: none;">{{email}}</a><br/>
    🌐 {{website}}<br/>
    <span style="font-size: 11px; color: #999;">NMLS# {{nmls}} | Equal Housing Lender ⌂</span><br/>
    <a href="{{website}}" style="display: inline-block; margin-top: 8px; padding: 6px 16px; background: #0c5ab0; color: #fff; text-decoration: none; border-radius: 4px; font-size: 12px;">Get Your Free Rate Quote →</a>
  </td></tr>
</table>`,
  },
  {
    id: "dark-elegant",
    name: "Dark Elegant",
    description: "Dark background with gold accents for a premium feel.",
    category: "bold" as const,
    html: `<table cellpadding="0" cellspacing="0" style="font-family: Georgia, serif; font-size: 14px; max-width: 500px;">
  <tr><td style="background: #1a1a2e; padding: 16px 20px; border-radius: 8px;">
    <strong style="font-size: 17px; color: #d4af37;">{{name}}</strong><br/>
    <span style="color: #ccc; font-size: 13px;">{{title}} — {{company}}</span><br/><br/>
    <span style="color: #aaa; font-size: 13px;">📞 {{phone}}</span><br/>
    <a href="mailto:{{email}}" style="color: #d4af37; text-decoration: none; font-size: 13px;">✉️ {{email}}</a><br/>
    <span style="color: #aaa; font-size: 13px;">🌐 {{website}}</span><br/>
    <span style="font-size: 11px; color: #777;">NMLS# {{nmls}}</span>
  </td></tr>
</table>`,
  },
  {
    id: "simple-text",
    name: "Simple Text",
    description: "No-frills plain text style — maximum email client compatibility.",
    category: "minimal" as const,
    html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">
  <strong>{{name}}</strong><br/>
  {{title}} | {{company}}<br/>
  Phone: {{phone}}<br/>
  Email: <a href="mailto:{{email}}" style="color: #0c5ab0;">{{email}}</a><br/>
  NMLS# {{nmls}}
</div>`,
  },
];

// ─── Template type prompts ──────────────────────────────────────────────────
const TEMPLATE_PROMPTS: Record<string, string> = {
  newsletter:
    "Write a professional email newsletter (200–350 words). Include a subject line, engaging intro, 2–3 key sections with subheadings, and a CTA.",
  nurture:
    "Write a lead nurturing email (150–250 words). Warm, educational tone. Provide value, address a pain point, soft CTA.",
  follow_up:
    "Write a follow-up email (100–150 words). Reference the previous conversation naturally, move the relationship forward, clear next step.",
  introduction:
    "Write a first-touch introduction email (100–150 words). Professional, friendly, establish credibility, clear value prop.",
  promotional:
    "Write a promotional email (150–200 words). Compelling offer, urgency, clear CTA button text suggestion.",
  re_engagement:
    "Write a re-engagement email (100–150 words). Acknowledge the gap, offer fresh value, easy low-friction CTA.",
  custom:
    "Write a professional marketing email. Follow any custom instructions provided.",
};

const TEMPLATE_TYPES = [
  "newsletter",
  "nurture",
  "follow_up",
  "introduction",
  "promotional",
  "re_engagement",
  "custom",
] as const;

const TONES = [
  "professional",
  "friendly",
  "casual",
  "urgent",
  "empathetic",
] as const;

export const emailContentRouter = router({
  // ─── Generate Email ─────────────────────────────────────────────────────
  generateEmail: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        templateType: z.enum(TEMPLATE_TYPES),
        tone: z.enum(TONES),
        topic: z.string().min(1).max(500),
        customInstructions: z.string().optional(),
        contactId: z.number().optional(),
        includeConversationHistory: z.boolean().optional().default(false),
        aiModel: z.string().optional().default("gemini-2.5-flash"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Fetch sender context
      const [sender] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, ctx.user!.id))
        .limit(1);

      const [account] = await db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);

      // Build context from contact + conversation history
      let contactContext = "";
      let contactName = "";
      if (input.contactId) {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.id, input.contactId),
              eq(contacts.accountId, input.accountId)
            )
          )
          .limit(1);

        if (contact) {
          contactName = `${contact.firstName} ${contact.lastName}`.trim();
          contactContext += `\nRecipient: ${contactName}`;
          if (contact.email) contactContext += ` (${contact.email})`;
          if (contact.company) contactContext += `, Company: ${contact.company}`;
          if (contact.title) contactContext += `, Title: ${contact.title}`;
        }

        if (input.includeConversationHistory) {
          const recentMessages = await db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.contactId, input.contactId),
                eq(messages.accountId, input.accountId)
              )
            )
            .orderBy(desc(messages.createdAt))
            .limit(10);

          if (recentMessages.length > 0) {
            const history = recentMessages
              .reverse()
              .map(
                (m) =>
                  `[${m.direction === "outbound" ? "You" : contactName || "Contact"}] ${m.subject ? `Subject: ${m.subject} — ` : ""}${m.body}`
              )
              .join("\n\n");
            contactContext += `\n\nPrevious conversation history with this contact:\n${history}`;
          }
        }
      }

      // Build system prompt
      const basePrompt = TEMPLATE_PROMPTS[input.templateType] || TEMPLATE_PROMPTS.custom;
      const systemPrompt = `${basePrompt}\n\nTone: ${input.tone}.\n\nYou MUST respond with valid JSON matching this exact schema: { "subject": "string", "previewText": "string", "body": "string" }. The body should use HTML formatting with <p>, <h3>, <strong>, <a> tags for email rendering. Do not include any text outside the JSON object. IMPORTANT: Always sign off the email using the provided Sender Name and Company. NEVER use placeholders like [Your Name] or [Company Name].`;

      // Build user message
      let userMessage = `Topic: ${input.topic}`;

      // Add sender context
      userMessage += `\n\nSender Name: ${sender?.name || "The Sender"}`;
      if (account?.name) {
        userMessage += `\nSender Company/Account: ${account.name}`;
      }

      if (input.customInstructions) {
        userMessage += `\n\nCustom instructions: ${input.customInstructions}`;
      }
      if (contactContext) {
        userMessage += `\n${contactContext}`;
      }

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model: input.aiModel || "gemini-2.5-flash",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_generation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject: {
                  type: "string",
                  description: "Email subject line",
                },
                previewText: {
                  type: "string",
                  description:
                    "Short preview text shown in inbox (40-90 chars)",
                },
                body: {
                  type: "string",
                  description:
                    "Full email body in HTML format with paragraph tags",
                },
              },
              required: ["subject", "previewText", "body"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      let parsed: { subject: string; previewText: string; body: string };

      try {
        const contentStr =
          typeof rawContent === "string"
            ? rawContent
            : JSON.stringify(rawContent);
        parsed = JSON.parse(contentStr);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse LLM response as JSON",
        });
      }

      if (!parsed.subject || !parsed.body) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "LLM returned incomplete email content",
        });
      }

      // Track usage
      await trackUsage({
        accountId: input.accountId,
        userId: ctx.user!.id,
        eventType: "llm_request",
        quantity: 1,
        metadata: {
          feature: "email_generation",
          templateType: input.templateType,
          model: input.aiModel,
          hasContact: !!input.contactId,
          hasHistory: input.includeConversationHistory,
        },
      }).catch((err) =>
        console.error("[emailContent] Usage tracking failed:", err)
      );

      // Auto-append default signature if one exists
      let finalBody = parsed.body;
      const [defaultSig] = await db
        .select()
        .from(emailSignatures)
        .where(
          and(
            eq(emailSignatures.accountId, input.accountId),
            eq(emailSignatures.isDefault, true)
          )
        )
        .limit(1);

      if (defaultSig) {
        finalBody += `<br/><br/>${defaultSig.html}`;
      }

      return {
        subject: parsed.subject,
        previewText: parsed.previewText || "",
        body: finalBody,
        contactName: contactName || null,
        signatureAppended: !!defaultSig,
      };
    }),

  // ─── Save Draft ─────────────────────────────────────────────────────────
  saveDraft: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactId: z.number().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        previewText: z.string().optional(),
        templateType: z.string(),
        tone: z.string().optional(),
        topic: z.string().optional(),
        aiModel: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const [result] = await db.insert(emailDrafts).values({
        accountId: input.accountId,
        createdByUserId: ctx.user!.id,
        contactId: input.contactId || null,
        subject: input.subject,
        body: input.body,
        previewText: input.previewText || null,
        templateType: input.templateType,
        tone: input.tone || null,
        topic: input.topic || null,
        aiModel: input.aiModel || null,
      });

      return { id: result.insertId };
    }),

  // ─── Get Drafts ─────────────────────────────────────────────────────────
  getDrafts: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactId: z.number().optional(),
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const conditions = [eq(emailDrafts.accountId, input.accountId)];
      if (input.contactId) {
        conditions.push(eq(emailDrafts.contactId, input.contactId));
      }

      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

      const drafts = await db
        .select()
        .from(emailDrafts)
        .where(whereClause)
        .orderBy(desc(emailDrafts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailDrafts)
        .where(whereClause);

      // Fetch contact names for drafts that have contactId
      const contactIds = Array.from(
        new Set(drafts.filter((d) => d.contactId).map((d) => d.contactId!))
      );
      let contactMap: Record<number, string> = {};
      if (contactIds.length > 0) {
        const contactRows = await db
          .select({
            id: contacts.id,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
          })
          .from(contacts)
          .where(
            and(
              sql`${contacts.id} IN (${sql.raw(contactIds.join(","))})`,
              eq(contacts.accountId, input.accountId)
            )
          );
        contactMap = Object.fromEntries(
          contactRows.map((c) => [
            c.id,
            `${c.firstName} ${c.lastName}`.trim(),
          ])
        );
      }

      return {
        drafts: drafts.map((d) => ({
          ...d,
          contactName: d.contactId ? contactMap[d.contactId] || null : null,
        })),
        total: countResult?.count || 0,
      };
    }),

  // ─── Update Draft ───────────────────────────────────────────────────────
  updateDraft: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        id: z.number(),
        subject: z.string().optional(),
        body: z.string().optional(),
        previewText: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Verify ownership and check status
      const [existing] = await db
        .select()
        .from(emailDrafts)
        .where(
          and(
            eq(emailDrafts.id, input.id),
            eq(emailDrafts.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      }

      if (existing.status === "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot edit a sent email",
        });
      }

      const updates: Record<string, any> = {};
      if (input.subject !== undefined) updates.subject = input.subject;
      if (input.body !== undefined) updates.body = input.body;
      if (input.previewText !== undefined)
        updates.previewText = input.previewText;
      if (input.status !== undefined) updates.status = input.status;

      if (Object.keys(updates).length === 0) {
        return { success: true };
      }

      await db
        .update(emailDrafts)
        .set(updates)
        .where(eq(emailDrafts.id, input.id));

      return { success: true };
    }),

  // ─── Delete Draft ───────────────────────────────────────────────────────
  deleteDraft: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Verify ownership
      const [existing] = await db
        .select()
        .from(emailDrafts)
        .where(
          and(
            eq(emailDrafts.id, input.id),
            eq(emailDrafts.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      }

      await db.delete(emailDrafts).where(eq(emailDrafts.id, input.id));

      return { success: true };
    }),

  // ─── Bulk Generate Emails ──────────────────────────────────────────────
  bulkGenerateEmails: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactIds: z.array(z.number()).min(1).max(50),
        templateType: z.enum(TEMPLATE_TYPES),
        tone: z.enum(TONES),
        topic: z.string().min(1).max(500),
        customInstructions: z.string().optional(),
        includeConversationHistory: z.boolean().optional().default(false),
        aiModel: z.string().optional().default("gemini-2.5-flash"),
        saveDrafts: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Fetch sender context
      const [sender] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, ctx.user!.id))
        .limit(1);

      const [account] = await db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);

      // Fetch all contacts
      const contactRows = await db
        .select()
        .from(contacts)
        .where(
          and(
            sql`${contacts.id} IN (${sql.raw(input.contactIds.join(","))})`,
            eq(contacts.accountId, input.accountId)
          )
        );

      if (contactRows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No contacts found",
        });
      }

      const results: Array<{
        contactId: number;
        contactName: string;
        contactEmail: string | null;
        subject: string;
        previewText: string;
        body: string;
        draftId: number | null;
        error: string | null;
      }> = [];

      for (const contact of contactRows) {
        try {
          const contactName = `${contact.firstName} ${contact.lastName}`.trim();
          let contactContext = `\nRecipient: ${contactName}`;
          if (contact.email) contactContext += ` (${contact.email})`;
          if (contact.company) contactContext += `, Company: ${contact.company}`;
          if (contact.title) contactContext += `, Title: ${contact.title}`;

          // Optionally fetch conversation history
          if (input.includeConversationHistory) {
            const recentMessages = await db
              .select()
              .from(messages)
              .where(
                and(
                  eq(messages.contactId, contact.id),
                  eq(messages.accountId, input.accountId)
                )
              )
              .orderBy(desc(messages.createdAt))
              .limit(10);

            if (recentMessages.length > 0) {
              const history = recentMessages
                .reverse()
                .map(
                  (m) =>
                    `[${m.direction === "outbound" ? "You" : contactName}] ${m.subject ? `Subject: ${m.subject} — ` : ""}${m.body}`
                )
                .join("\n\n");
              contactContext += `\n\nPrevious conversation history with this contact:\n${history}`;
            }
          }

          const basePrompt = TEMPLATE_PROMPTS[input.templateType] || TEMPLATE_PROMPTS.custom;
          const systemPrompt = `${basePrompt}\n\nTone: ${input.tone}.\n\nYou MUST respond with valid JSON matching this exact schema: { "subject": "string", "previewText": "string", "body": "string" }. The body should use HTML formatting with <p>, <h3>, <strong>, <a> tags for email rendering. Do not include any text outside the JSON object. Personalize the email for the recipient. IMPORTANT: Always sign off the email using the provided Sender Name and Company. NEVER use placeholders like [Your Name] or [Company Name].`;

          let userMessage = `Topic: ${input.topic}`;

          // Add sender context
          userMessage += `\n\nSender Name: ${sender?.name || "The Sender"}`;
          if (account?.name) {
            userMessage += `\nSender Company/Account: ${account.name}`;
          }

          if (input.customInstructions) {
            userMessage += `\n\nCustom instructions: ${input.customInstructions}`;
          }
          userMessage += `\n${contactContext}`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            model: input.aiModel || "gemini-2.5-flash",
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "email_generation",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    subject: { type: "string", description: "Email subject line" },
                    previewText: { type: "string", description: "Short preview text (40-90 chars)" },
                    body: { type: "string", description: "Full email body in HTML" },
                  },
                  required: ["subject", "previewText", "body"],
                  additionalProperties: false,
                },
              },
            },
          });

          const rawContent = response.choices?.[0]?.message?.content;
          const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
          const parsed = JSON.parse(contentStr);

          let draftId: number | null = null;
          if (input.saveDrafts) {
            const [insertResult] = await db.insert(emailDrafts).values({
              accountId: input.accountId,
              createdByUserId: ctx.user!.id,
              contactId: contact.id,
              subject: parsed.subject,
              body: parsed.body,
              previewText: parsed.previewText || null,
              templateType: input.templateType,
              tone: input.tone,
              topic: input.topic,
              aiModel: input.aiModel || null,
            });
            draftId = insertResult.insertId;
          }

          // Auto-append default signature
          let finalBody = parsed.body;
          const [defaultSig] = await db
            .select()
            .from(emailSignatures)
            .where(
              and(
                eq(emailSignatures.accountId, input.accountId),
                eq(emailSignatures.isDefault, true)
              )
            )
            .limit(1);
          if (defaultSig) {
            finalBody += `<br/><br/>${defaultSig.html}`;
          }

          // Update draft body if saved with signature
          if (draftId && defaultSig) {
            await db
              .update(emailDrafts)
              .set({ body: finalBody })
              .where(eq(emailDrafts.id, draftId));
          }

          results.push({
            contactId: contact.id,
            contactName,
            contactEmail: contact.email,
            subject: parsed.subject,
            previewText: parsed.previewText || "",
            body: finalBody,
            draftId,
            error: null,
          });
        } catch (err: any) {
          const contactName = `${contact.firstName} ${contact.lastName}`.trim();
          results.push({
            contactId: contact.id,
            contactName,
            contactEmail: contact.email,
            subject: "",
            previewText: "",
            body: "",
            draftId: null,
            error: err.message || "Generation failed",
          });
        }
      }

      // Track usage for successful generations
      const successCount = results.filter((r) => !r.error).length;
      if (successCount > 0) {
        await trackUsage({
          accountId: input.accountId,
          userId: ctx.user!.id,
          eventType: "llm_request",
          quantity: successCount,
          metadata: {
            feature: "bulk_email_generation",
            templateType: input.templateType,
            model: input.aiModel,
            totalContacts: input.contactIds.length,
            successCount,
          },
        }).catch((err) =>
          console.error("[emailContent] Bulk usage tracking failed:", err)
        );
      }

      return {
        results,
        totalGenerated: successCount,
        totalFailed: results.length - successCount,
      };
    }),

  // ─── Bulk Send Emails ──────────────────────────────────────────────────
  bulkSendEmails: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        draftIds: z.array(z.number()).min(1).max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const results: Array<{
        draftId: number;
        contactName: string;
        success: boolean;
        error: string | null;
      }> = [];

      for (const draftId of input.draftIds) {
        try {
          // Fetch draft
          const [draft] = await db
            .select()
            .from(emailDrafts)
            .where(
              and(
                eq(emailDrafts.id, draftId),
                eq(emailDrafts.accountId, input.accountId)
              )
            )
            .limit(1);

          if (!draft) {
            results.push({ draftId, contactName: "Unknown", success: false, error: "Draft not found" });
            continue;
          }

          if (draft.status === "sent") {
            results.push({ draftId, contactName: "Unknown", success: false, error: "Already sent" });
            continue;
          }

          if (!draft.contactId) {
            results.push({ draftId, contactName: "Unknown", success: false, error: "No contact associated" });
            continue;
          }

          // Fetch contact
          const [contact] = await db
            .select()
            .from(contacts)
            .where(
              and(
                eq(contacts.id, draft.contactId),
                eq(contacts.accountId, input.accountId)
              )
            )
            .limit(1);

          const contactName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : "Unknown";

          if (!contact?.email) {
            results.push({ draftId, contactName, success: false, error: "Contact has no email" });
            continue;
          }

          // Send
          const sendResult = await dispatchEmail({
            to: contact.email,
            subject: draft.subject,
            body: draft.body,
            accountId: input.accountId,
          });

          if (!sendResult.success) {
            results.push({ draftId, contactName, success: false, error: sendResult.error || "Send failed" });
            continue;
          }

          // Auto-promote contact status from new/uncontacted → contacted
          if (draft.contactId) {
            const { autoPromoteOnOutbound } = await import("../services/contactStatusAutoUpdater");
            autoPromoteOnOutbound(draft.contactId).catch(() => {});
          }

          // Update draft status
          await db
            .update(emailDrafts)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(emailDrafts.id, draftId));

          results.push({ draftId, contactName, success: true, error: null });
        } catch (err: any) {
          results.push({ draftId, contactName: "Unknown", success: false, error: err.message || "Unknown error" });
        }
      }

      // Track usage
      const sentCount = results.filter((r) => r.success).length;
      if (sentCount > 0) {
        await trackUsage({
          accountId: input.accountId,
          userId: ctx.user!.id,
          eventType: "email_sent",
          quantity: sentCount,
          metadata: {
            feature: "bulk_email_send",
            totalAttempted: input.draftIds.length,
            sentCount,
          },
        }).catch((err) =>
          console.error("[emailContent] Bulk send usage tracking failed:", err)
        );
      }

      return {
        results,
        totalSent: sentCount,
        totalFailed: results.length - sentCount,
      };
    }),

  // ─── Signatures: List ─────────────────────────────────────────────────
  listSignatures: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db
        .select()
        .from(emailSignatures)
        .where(eq(emailSignatures.accountId, input.accountId))
        .orderBy(desc(emailSignatures.createdAt));

      return rows;
    }),

  // ─── Signatures: Create ───────────────────────────────────────────────
  createSignature: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1).max(255),
        html: z.string().min(1),
        isDefault: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // If setting as default, unset all others first
      if (input.isDefault) {
        await db
          .update(emailSignatures)
          .set({ isDefault: false })
          .where(eq(emailSignatures.accountId, input.accountId));
      }

      const [result] = await db.insert(emailSignatures).values({
        accountId: input.accountId,
        name: input.name,
        html: input.html,
        isDefault: input.isDefault,
      });

      return { id: result.insertId };
    }),

  // ─── Signatures: Update ───────────────────────────────────────────────
  updateSignature: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        html: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify signature belongs to account
      const [existing] = await db
        .select()
        .from(emailSignatures)
        .where(
          and(
            eq(emailSignatures.id, input.id),
            eq(emailSignatures.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Signature not found" });

      // If setting as default, unset all others first
      if (input.isDefault) {
        await db
          .update(emailSignatures)
          .set({ isDefault: false })
          .where(eq(emailSignatures.accountId, input.accountId));
      }

      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.html !== undefined) updateData.html = input.html;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

      await db
        .update(emailSignatures)
        .set(updateData)
        .where(eq(emailSignatures.id, input.id));

      return { success: true };
    }),

  // ─── Signatures: Delete ───────────────────────────────────────────────
  deleteSignature: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [existing] = await db
        .select()
        .from(emailSignatures)
        .where(
          and(
            eq(emailSignatures.id, input.id),
            eq(emailSignatures.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Signature not found" });

      await db.delete(emailSignatures).where(eq(emailSignatures.id, input.id));

      return { success: true };
    }),

  // ─── Signatures: Set Default ──────────────────────────────────────────
  setDefaultSignature: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify signature belongs to account
      const [existing] = await db
        .select()
        .from(emailSignatures)
        .where(
          and(
            eq(emailSignatures.id, input.id),
            eq(emailSignatures.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Signature not found" });

      // Unset all, then set this one
      await db
        .update(emailSignatures)
        .set({ isDefault: false })
        .where(eq(emailSignatures.accountId, input.accountId));

      await db
        .update(emailSignatures)
        .set({ isDefault: true })
        .where(eq(emailSignatures.id, input.id));

      return { success: true };
    }),

  // ─── Send Email ─────────────────────────────────────────────────────────
  sendEmail: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        draftId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Fetch draft
      const [draft] = await db
        .select()
        .from(emailDrafts)
        .where(
          and(
            eq(emailDrafts.id, input.draftId),
            eq(emailDrafts.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      }

      if (draft.status === "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email already sent",
        });
      }

      if (!draft.contactId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No contact associated with this draft",
        });
      }

      // Fetch contact email
      const [contact] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, draft.contactId),
            eq(contacts.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }

      if (!contact.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contact has no email address",
        });
      }

      // Send the email
      const result = await dispatchEmail({
        to: contact.email,
        subject: draft.subject,
        body: draft.body,
        accountId: input.accountId,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email: ${result.error || "Unknown error"}`,
        });
      }

      // Auto-promote contact status from new/uncontacted → contacted
      if (draft.contactId) {
        const { autoPromoteOnOutbound } = await import("../services/contactStatusAutoUpdater");
        autoPromoteOnOutbound(draft.contactId).catch(() => {});
      }

      // Update draft status
      await db
        .update(emailDrafts)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(emailDrafts.id, input.draftId));

      // Track usage
      await trackUsage({
        accountId: input.accountId,
        userId: ctx.user!.id,
        eventType: "email_sent",
        quantity: 1,
        metadata: {
          draftId: input.draftId,
          contactId: draft.contactId,
          templateType: draft.templateType,
        },
      }).catch((err) =>
        console.error("[emailContent] Send usage tracking failed:", err)
      );

      // Increment usage count on the default signature (if one was appended)
      try {
        const [defaultSig] = await db
          .select({ id: emailSignatures.id })
          .from(emailSignatures)
          .where(
            and(
              eq(emailSignatures.accountId, input.accountId),
              eq(emailSignatures.isDefault, true)
            )
          )
          .limit(1);
        if (defaultSig) {
          await db
            .update(emailSignatures)
            .set({
              usageCount: sql`${emailSignatures.usageCount} + 1`,
              lastUsedAt: new Date(),
            })
            .where(eq(emailSignatures.id, defaultSig.id));
        }
      } catch (sigErr) {
        console.error("[emailContent] Signature usage tracking failed:", sigErr);
      }

      return { success: true };
    }),

  // ─── Signature Templates (pre-built) ──────────────────────────────────
  getSignatureTemplates: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      return SIGNATURE_TEMPLATES;
    }),

  // ─── Upload Signature Image ───────────────────────────────────────────
  uploadSignatureImage: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        fileBase64: z.string().min(1),
        fileName: z.string().min(1).max(255),
        mimeType: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]),
        imageType: z.enum(["headshot", "logo"]).default("headshot"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);

      const { storagePut } = await import("../storage");
      const fileBuffer = Buffer.from(input.fileBase64, "base64");

      // Enforce 2MB limit
      const MAX_SIZE = 2 * 1024 * 1024;
      if (fileBuffer.length > MAX_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File size exceeds 2MB limit" });
      }

      const ext = input.fileName.split(".").pop() || "png";
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const safeKey = `signatures/${input.accountId}/${input.imageType}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(safeKey, fileBuffer, input.mimeType);
      return { url };
    }),

  // ─── Signature Analytics ──────────────────────────────────────────────
  getSignatureAnalytics: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db
        .select({
          id: emailSignatures.id,
          name: emailSignatures.name,
          isDefault: emailSignatures.isDefault,
          usageCount: emailSignatures.usageCount,
          lastUsedAt: emailSignatures.lastUsedAt,
          createdAt: emailSignatures.createdAt,
        })
        .from(emailSignatures)
        .where(eq(emailSignatures.accountId, input.accountId))
        .orderBy(desc(emailSignatures.usageCount));

      const totalUsage = rows.reduce((sum, r) => sum + (r.usageCount || 0), 0);

      return {
        signatures: rows.map((r) => ({
          ...r,
          percentage: totalUsage > 0 ? Math.round(((r.usageCount || 0) / totalUsage) * 100) : 0,
        })),
        totalUsage,
      };
    }),
});
