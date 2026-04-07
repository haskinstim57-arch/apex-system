import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { requireAccountMember } from "./contacts";
import { emailDrafts, contacts, messages } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { trackUsage } from "../services/usageTracker";
import { dispatchEmail } from "../services/messaging";

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
      const systemPrompt = `${basePrompt}\n\nTone: ${input.tone}.\n\nYou MUST respond with valid JSON matching this exact schema: { "subject": "string", "previewText": "string", "body": "string" }. The body should use HTML formatting with <p>, <h3>, <strong>, <a> tags for email rendering. Do not include any text outside the JSON object.`;

      // Build user message
      let userMessage = `Topic: ${input.topic}`;
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

      return {
        subject: parsed.subject,
        previewText: parsed.previewText || "",
        body: parsed.body,
        contactName: contactName || null,
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
          const systemPrompt = `${basePrompt}\n\nTone: ${input.tone}.\n\nYou MUST respond with valid JSON matching this exact schema: { "subject": "string", "previewText": "string", "body": "string" }. The body should use HTML formatting with <p>, <h3>, <strong>, <a> tags for email rendering. Do not include any text outside the JSON object. Personalize the email for the recipient.`;

          let userMessage = `Topic: ${input.topic}`;
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

          results.push({
            contactId: contact.id,
            contactName,
            contactEmail: contact.email,
            subject: parsed.subject,
            previewText: parsed.previewText || "",
            body: parsed.body,
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

      return { success: true };
    }),
});
