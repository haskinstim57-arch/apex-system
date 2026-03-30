/**
 * Jarvis AI Assistant — Tool Definitions & Executors
 *
 * Each tool maps to a real CRM operation (DB query, messaging, workflow trigger).
 * Tool definitions follow the OpenAI function-calling schema so they can be
 * passed directly to invokeLLM({ tools }).
 */
import type { Tool } from "../_core/llm";
import { and, eq, desc, sql, gte, count } from "drizzle-orm";
import {
  getAccountDashboardStats,
  getContactStats,
  getMessageStats,
  getCampaignStats,
  listContacts,
  getContactById,
  createContact,
  updateContact,
  getContactTags,
  addContactTag,
  removeContactTag,
  listAllTagsForAccount,
  createContactNote,
  createMessage,
  listMessagesByContact,
  listCampaigns,
  listDeals,
  getDealByContactId,
  updateDeal,
  listWorkflows,
  getWorkflowById,
  getOrCreateDefaultPipeline,
  listPipelineStages,
  listSegments,
  listSequences,
  enrollContactInSequence,
  getContactEnrollments,
  getCalendars,
  getAppointmentsByContact,
  getAvailableSlots,
  createAppointment,
  logContactActivity,
  getDb,
} from "../db";
import {
  contacts,
  messages,
  aiCalls,
  campaigns,
  deals,
} from "../../drizzle/schema";
import { dispatchSMS, dispatchEmail } from "./messaging";
import { triggerWorkflow } from "./workflowEngine";

// ═══════════════════════════════════════════════
// TOOL DEFINITIONS (OpenAI function-calling schema)
// ═══════════════════════════════════════════════

export const JARVIS_TOOLS: Tool[] = [
  // ── Dashboard & Stats ──
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Get high-level dashboard stats: total contacts, messages, active campaigns, calls, appointments.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_stats",
      description: "Get contact pipeline stats: total, new, qualified, won counts.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_message_stats",
      description: "Get messaging stats: total, sent, delivered, failed, emails, sms counts.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_campaign_stats",
      description: "Get campaign stats: total, draft, scheduled, sending, sent, paused, cancelled.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },

  // ── Contact Management ──
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search contacts by name, email, phone, status, or tag. Returns up to 20 results.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Free-text search across name, email, phone, company" },
          status: { type: "string", enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "nurture"] },
          tag: { type: "string", description: "Filter by tag" },
          createdAfterDays: { type: "number", description: "Only contacts created in the last N days" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contacts_by_filter",
      description: "Advanced contact filter. Find contacts by creation date, message history, call activity, tags, assignment, and status. Use this for queries like 'contacts created in last 7 days with no messages'.",
      parameters: {
        type: "object",
        properties: {
          createdAfterDays: { type: "number", description: "Contacts created in the last N days" },
          createdBeforeDays: { type: "number", description: "Contacts created more than N days ago" },
          hasNoMessages: { type: "boolean", description: "Only contacts with zero messages" },
          hasNoCallActivity: { type: "boolean", description: "Only contacts with zero AI calls" },
          hasTag: { type: "string", description: "Must have this tag" },
          doesNotHaveTag: { type: "string", description: "Must NOT have this tag" },
          assignedToUserId: { type: "number", description: "Assigned to this user ID" },
          status: { type: "string", enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "nurture"] },
          limit: { type: "number", description: "Max results (default 50, max 200)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details for a specific contact by ID, including tags and recent messages.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number", description: "Contact ID" },
        },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new contact in the CRM.",
      parameters: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          leadSource: { type: "string" },
          status: { type: "string", enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "nurture"] },
        },
        required: ["firstName", "lastName"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Update fields on an existing contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          status: { type: "string", enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "nurture"] },
        },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_contact_tags",
      description: "Add or remove a tag from a contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          action: { type: "string", enum: ["add", "remove"] },
          tag: { type: "string" },
        },
        required: ["contactId", "action", "tag"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tags",
      description: "List all tags used in this account.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "add_contact_note",
      description: "Add a note to a contact's record.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          content: { type: "string", description: "Note text" },
        },
        required: ["contactId", "content"],
        additionalProperties: false,
      },
    },
  },

  // ── Analytics ──
  {
    type: "function",
    function: {
      name: "get_analytics",
      description: "Get real-time analytics for the last 7 days: new contacts, messages sent, AI calls made, active campaigns, total pipeline value, and reply rate.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },

  // ── Bulk Messaging ──
  {
    type: "function",
    function: {
      name: "bulk_send_sms",
      description: "Send the same SMS message to multiple contacts at once. Provide an array of contact IDs and the message body.",
      parameters: {
        type: "object",
        properties: {
          contactIds: {
            type: "array",
            items: { type: "number" },
            description: "Array of contact IDs to send SMS to",
          },
          body: { type: "string", description: "SMS message text" },
        },
        required: ["contactIds", "body"],
        additionalProperties: false,
      },
    },
  },

  // ── Messaging ──
  {
    type: "function",
    function: {
      name: "send_sms",
      description: "Send an SMS message to a contact. Requires the contact to have a phone number.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          body: { type: "string", description: "SMS message text" },
        },
        required: ["contactId", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email to a contact. Requires the contact to have an email address.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          subject: { type: "string" },
          body: { type: "string", description: "Email body (plain text or HTML)" },
        },
        required: ["contactId", "subject", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_messages",
      description: "Get recent message history for a contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
        },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },

  // ── Campaigns ──
  {
    type: "function",
    function: {
      name: "list_campaigns",
      description: "List campaigns, optionally filtered by status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "scheduled", "sending", "sent", "paused", "cancelled"] },
          search: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },

  // ── Pipeline & Deals ──
  {
    type: "function",
    function: {
      name: "get_pipeline_overview",
      description: "Get all deals in the default pipeline with their stages.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "move_deal_stage",
      description: "Move a deal to a different pipeline stage.",
      parameters: {
        type: "object",
        properties: {
          dealId: { type: "number" },
          stageId: { type: "number", description: "Target stage ID" },
        },
        required: ["dealId", "stageId"],
        additionalProperties: false,
      },
    },
  },

  // ── Workflows & Automations ──
  {
    type: "function",
    function: {
      name: "list_workflows",
      description: "List all workflows/automations for this account.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_workflow",
      description: "Manually trigger a workflow for a specific contact.",
      parameters: {
        type: "object",
        properties: {
          workflowId: { type: "number" },
          contactId: { type: "number" },
        },
        required: ["workflowId", "contactId"],
        additionalProperties: false,
      },
    },
  },

  // ── Segments ──
  {
    type: "function",
    function: {
      name: "list_segments",
      description: "List all contact segments for this account.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },

  // ── Sequences ──
  {
    type: "function",
    function: {
      name: "list_sequences",
      description: "List all sequences (drip campaigns) for this account.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "enroll_in_sequence",
      description: "Enroll a contact in a sequence.",
      parameters: {
        type: "object",
        properties: {
          sequenceId: { type: "number" },
          contactId: { type: "number" },
        },
        required: ["sequenceId", "contactId"],
        additionalProperties: false,
      },
    },
  },

  // ── Calendar & Appointments ──
  {
    type: "function",
    function: {
      name: "list_calendars",
      description: "List all booking calendars for this account.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_appointments",
      description: "Get all appointments for a specific contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
        },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },
];

// ═══════════════════════════════════════════════
// TOOL EXECUTOR
// ═══════════════════════════════════════════════

interface ToolContext {
  accountId: number;
  userId: number;
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const { accountId, userId } = ctx;

  switch (toolName) {
    // ── Dashboard & Stats ──
    case "get_dashboard_stats":
      return getAccountDashboardStats(accountId);

    case "get_contact_stats":
      return getContactStats(accountId);

    case "get_message_stats":
      return getMessageStats(accountId);

    case "get_campaign_stats":
      return getCampaignStats(accountId);

    // ── Contact Management ──
    case "search_contacts": {
      const result = await listContacts({
        accountId,
        search: args.search as string | undefined,
        status: args.status as string | undefined,
        tag: args.tag as string | undefined,
        limit: Math.min((args.limit as number) || 20, 50),
        offset: 0,
      });
      let filtered = result.data;
      // Client-side date filter if createdAfterDays is provided
      if (args.createdAfterDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (args.createdAfterDays as number));
        filtered = filtered.filter(c => new Date(c.createdAt) >= cutoff);
      }
      return { contacts: filtered.map(c => ({
        id: c.id, firstName: c.firstName, lastName: c.lastName,
        email: c.email, phone: c.phone, status: c.status,
        company: c.company, leadSource: c.leadSource, createdAt: c.createdAt,
      })), total: filtered.length };
    }

    case "get_contact_detail": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      const tags = await getContactTags(contact.id);
      const recentMessages = await listMessagesByContact(contact.id, accountId);
      const enrollments = await getContactEnrollments(contact.id, accountId);
      return {
        ...contact,
        tags: tags.map(t => t.tag),
        recentMessages: recentMessages.slice(0, 5).map(m => ({
          id: m.id, type: m.type, direction: m.direction,
          subject: m.subject, body: m.body?.substring(0, 200),
          status: m.status, createdAt: m.createdAt,
        })),
        activeSequences: enrollments
          .filter((e: any) => (e.enrollment?.status || e.status) === "active")
          .length,
      };
    }

    case "create_contact": {
      const result = await createContact({
        accountId,
        firstName: args.firstName as string,
        lastName: args.lastName as string,
        email: (args.email as string) || undefined,
        phone: (args.phone as string) || undefined,
        company: (args.company as string) || undefined,
        leadSource: (args.leadSource as string) || undefined,
        status: (args.status as any) || "new",
      });
      logContactActivity({
        contactId: result.id,
        accountId,
        activityType: "contact_created",
        description: "Contact created by Jarvis AI",
      });
      return { success: true, contactId: result.id };
    }

    case "update_contact": {
      const { contactId, ...updates } = args;
      const cleanUpdates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined && v !== null) cleanUpdates[k] = v;
      }
      await updateContact(contactId as number, accountId, cleanUpdates);
      return { success: true };
    }

    case "manage_contact_tags": {
      const cid = args.contactId as number;
      if (args.action === "add") {
        await addContactTag(cid, args.tag as string);
        logContactActivity({
          contactId: cid, accountId,
          activityType: "tag_added",
          description: `Tag "${args.tag}" added by Jarvis AI`,
        });
      } else {
        await removeContactTag(cid, args.tag as string);
        logContactActivity({
          contactId: cid, accountId,
          activityType: "tag_removed",
          description: `Tag "${args.tag}" removed by Jarvis AI`,
        });
      }
      return { success: true };
    }

    case "list_tags":
      return { tags: await listAllTagsForAccount(accountId) };

    case "add_contact_note": {
      await createContactNote({
        contactId: args.contactId as number,
        authorId: userId,
        content: args.content as string,
      });
      logContactActivity({
        contactId: args.contactId as number,
        accountId,
        activityType: "note_added",
        description: "Note added by Jarvis AI",
      });
      return { success: true };
    }

    // ── Messaging ──
    case "send_sms": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      if (!contact.phone) return { error: "Contact has no phone number" };
      const smsResult = await dispatchSMS({
        to: contact.phone,
        body: args.body as string,
        accountId,
        contactId: contact.id,
      });
      await createMessage({
        accountId,
        contactId: contact.id,
        userId,
        type: "sms",
        direction: "outbound",
        status: smsResult.success ? "sent" : "failed",
        body: args.body as string,
        toAddress: contact.phone,
        errorMessage: smsResult.error || undefined,
      });
      logContactActivity({
        contactId: contact.id, accountId,
        activityType: "message_sent",
        description: "SMS sent by Jarvis AI",
      });
      return { success: smsResult.success, error: smsResult.error };
    }

    case "send_email": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      if (!contact.email) return { error: "Contact has no email address" };
      const emailResult = await dispatchEmail({
        to: contact.email,
        subject: args.subject as string,
        body: args.body as string,
        accountId,
      });
      await createMessage({
        accountId,
        contactId: contact.id,
        userId,
        type: "email",
        direction: "outbound",
        status: emailResult.success ? "sent" : "failed",
        subject: args.subject as string,
        body: args.body as string,
        toAddress: contact.email,
        errorMessage: emailResult.error || undefined,
      });
      logContactActivity({
        contactId: contact.id, accountId,
        activityType: "message_sent",
        description: `Email sent by Jarvis AI: "${args.subject}"`,
      });
      return { success: emailResult.success, error: emailResult.error };
    }

    case "get_contact_messages": {
      const msgs = await listMessagesByContact(args.contactId as number, accountId);
      return msgs.slice(0, 20).map(m => ({
        id: m.id, type: m.type, direction: m.direction,
        subject: m.subject, body: m.body?.substring(0, 300),
        status: m.status, createdAt: m.createdAt,
      }));
    }

    // ── Campaigns ──
    case "list_campaigns": {
      const result = await listCampaigns(accountId, {
        status: args.status as string | undefined,
        search: args.search as string | undefined,
        limit: 20,
      });
      return {
        campaigns: result.data.map(c => ({
          id: c.id, name: c.name, type: c.type,
          status: c.status, createdAt: c.createdAt,
        })),
        total: result.total,
      };
    }

    // ── Pipeline & Deals ──
    case "get_pipeline_overview": {
      const pipeline = await getOrCreateDefaultPipeline(accountId);
      const stages = await listPipelineStages(pipeline.id, accountId);
      const allDeals = await listDeals(pipeline.id, accountId);
      return {
        pipeline: { id: pipeline.id, name: pipeline.name },
        stages: stages.map(s => ({
          id: s.id, name: s.name, color: s.color,
          deals: allDeals
            .filter(d => d.deal.stageId === s.id)
            .map(d => ({
              id: d.deal.id, title: d.deal.title, value: d.deal.value,
              contact: `${d.contact.firstName} ${d.contact.lastName}`,
            })),
        })),
      };
    }

    case "move_deal_stage": {
      await updateDeal(args.dealId as number, accountId, {
        stageId: args.stageId as number,
      });
      return { success: true };
    }

    // ── Workflows ──
    case "list_workflows": {
      const wfs = await listWorkflows(accountId);
      return wfs.map(w => ({
        id: w.id, name: w.name, isActive: w.isActive,
        triggerType: w.triggerType, description: w.description,
      }));
    }

    case "trigger_workflow": {
      const wf = await getWorkflowById(args.workflowId as number, accountId);
      if (!wf) return { error: "Workflow not found" };
      if (!wf.isActive) return { error: "Workflow is not active" };
      const execId = await triggerWorkflow(wf, args.contactId as number, accountId, "jarvis_ai");
      return { success: true, executionId: execId };
    }

    // ── Segments ──
    case "list_segments": {
      const segs = await listSegments(accountId);
      return segs.map(s => ({
        id: s.id, name: s.name, description: s.description,
        icon: s.icon, color: s.color,
      }));
    }

    // ── Sequences ──
    case "list_sequences": {
      const seqs = await listSequences(accountId);
      return seqs.map(s => ({
        id: s.id, name: s.name, status: s.status,
        stepCount: s.stepCount, activeEnrollments: s.activeEnrollments,
        completedCount: s.completedCount,
      }));
    }

    case "enroll_in_sequence": {
      const result = await enrollContactInSequence({
        sequenceId: args.sequenceId as number,
        contactId: args.contactId as number,
        accountId,
        enrollmentSource: "manual",
      });
      return {
        success: true,
        enrollmentId: result.id,
        alreadyEnrolled: result.alreadyEnrolled,
      };
    }

    // ── Calendar & Appointments ──
    case "list_calendars": {
      const cals = await getCalendars(accountId);
      return cals.map(c => ({
        id: c.id, name: c.name, slug: c.slug,
      }));
    }

    case "get_contact_appointments": {
      const appts = await getAppointmentsByContact(args.contactId as number, accountId);
      return appts.map(a => ({
        id: a.id, guestName: a.guestName, startTime: a.startTime,
        endTime: a.endTime, status: a.status, notes: a.notes,
      }));
    }

    // ── Advanced Contact Filter ──
    case "get_contacts_by_filter": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };

      const conditions: any[] = [eq(contacts.accountId, accountId)];

      if (args.createdAfterDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (args.createdAfterDays as number));
        conditions.push(gte(contacts.createdAt, cutoff));
      }
      if (args.status) {
        conditions.push(eq(contacts.status, args.status as any));
      }
      if (args.assignedToUserId) {
        conditions.push(eq(contacts.assignedUserId, args.assignedToUserId as number));
      }

      const limit = Math.min((args.limit as number) || 50, 200);
      let rows = await db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(desc(contacts.createdAt))
        .limit(limit);

      // Post-query filters that require subqueries
      if (args.hasNoMessages) {
        const contactsWithMsgs = await db
          .select({ contactId: messages.contactId })
          .from(messages)
          .where(eq(messages.accountId, accountId))
          .groupBy(messages.contactId);
        const withMsgIds = new Set(contactsWithMsgs.map(r => r.contactId));
        rows = rows.filter(c => !withMsgIds.has(c.id));
      }

      if (args.hasNoCallActivity) {
        const contactsWithCalls = await db
          .select({ contactId: aiCalls.contactId })
          .from(aiCalls)
          .where(eq(aiCalls.accountId, accountId))
          .groupBy(aiCalls.contactId);
        const withCallIds = new Set(contactsWithCalls.map(r => r.contactId));
        rows = rows.filter(c => !withCallIds.has(c.id));
      }

      // Tag filters (post-query since tags are in a separate table)
      if (args.hasTag || args.doesNotHaveTag) {
        const filteredRows = [];
        for (const c of rows) {
          const tags = await getContactTags(c.id);
          const tagNames = tags.map(t => t.tag);
          if (args.hasTag && !tagNames.includes(args.hasTag as string)) continue;
          if (args.doesNotHaveTag && tagNames.includes(args.doesNotHaveTag as string)) continue;
          filteredRows.push(c);
        }
        rows = filteredRows;
      }

      return {
        contacts: rows.map(c => ({
          id: c.id, firstName: c.firstName, lastName: c.lastName,
          email: c.email, phone: c.phone, status: c.status,
          company: c.company, leadSource: c.leadSource, createdAt: c.createdAt,
        })),
        total: rows.length,
      };
    }

    // ── Analytics ──
    case "get_analytics": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [newContacts] = await db
        .select({ count: count() })
        .from(contacts)
        .where(and(eq(contacts.accountId, accountId), gte(contacts.createdAt, sevenDaysAgo)));

      const [msgsSent] = await db
        .select({ count: count() })
        .from(messages)
        .where(and(
          eq(messages.accountId, accountId),
          eq(messages.direction, "outbound"),
          gte(messages.createdAt, sevenDaysAgo),
        ));

      const [msgsReceived] = await db
        .select({ count: count() })
        .from(messages)
        .where(and(
          eq(messages.accountId, accountId),
          eq(messages.direction, "inbound"),
          gte(messages.createdAt, sevenDaysAgo),
        ));

      const [callsMade] = await db
        .select({ count: count() })
        .from(aiCalls)
        .where(and(eq(aiCalls.accountId, accountId), gte(aiCalls.createdAt, sevenDaysAgo)));

      const [activeCampaigns] = await db
        .select({ count: count() })
        .from(campaigns)
        .where(and(
          eq(campaigns.accountId, accountId),
          eq(campaigns.status, "sending"),
        ));

      const pipelineValue = await db
        .select({ total: sql<number>`COALESCE(SUM(${deals.value}), 0)` })
        .from(deals)
        .where(eq(deals.accountId, accountId));

      const replyRate = msgsSent.count > 0
        ? Math.round((msgsReceived.count / msgsSent.count) * 100)
        : 0;

      return {
        period: "Last 7 days",
        newContacts: newContacts.count,
        messagesSent: msgsSent.count,
        messagesReceived: msgsReceived.count,
        replyRate: `${replyRate}%`,
        aiCallsMade: callsMade.count,
        activeCampaigns: activeCampaigns.count,
        totalPipelineValue: pipelineValue[0]?.total ?? 0,
      };
    }

    // ── Bulk SMS ──
    case "bulk_send_sms": {
      const contactIds = args.contactIds as number[];
      const body = args.body as string;
      if (!contactIds || contactIds.length === 0) return { error: "No contact IDs provided" };
      if (contactIds.length > 100) return { error: "Maximum 100 contacts per bulk send" };

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const cid of contactIds) {
        try {
          const contact = await getContactById(cid, accountId);
          if (!contact) { failed++; errors.push(`Contact ${cid} not found`); continue; }
          if (!contact.phone) { failed++; errors.push(`${contact.firstName} ${contact.lastName} has no phone`); continue; }

          const smsResult = await dispatchSMS({
            to: contact.phone,
            body,
            accountId,
            contactId: contact.id,
          });

          await createMessage({
            accountId,
            contactId: contact.id,
            userId,
            type: "sms",
            direction: "outbound",
            status: smsResult.success ? "sent" : "failed",
            body,
            toAddress: contact.phone,
            errorMessage: smsResult.error || undefined,
          });

          if (smsResult.success) {
            sent++;
            logContactActivity({
              contactId: contact.id, accountId,
              activityType: "message_sent",
              description: "Bulk SMS sent by Jarvis AI",
            });
          } else {
            failed++;
            errors.push(`${contact.firstName}: ${smsResult.error}`);
          }
        } catch (e: any) {
          failed++;
          errors.push(`Contact ${cid}: ${e.message}`);
        }
      }

      return {
        success: true,
        sent,
        failed,
        total: contactIds.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
