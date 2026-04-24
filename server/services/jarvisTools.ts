/**
 * Jarvis AI Assistant — Tool Definitions & Executors
 *
 * Each tool maps to a real CRM operation (DB query, messaging, workflow trigger).
 * Tool definitions follow the OpenAI function-calling schema so they can be
 * passed directly to invokeLLM({ tools }).
 */
import type { Tool } from "../_core/llm";
import { and, eq, desc, asc, sql, gte, count } from "drizzle-orm";
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
  getCampaign,
  createCampaign,
  updateCampaign,
  listDeals,
  getDealByContactId,
  createDeal,
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
  getConversations,
  getLeadScoreHistory,
  updateContactLeadScore,
  createAICall,
  updateAICall,
  listAICalls,
  getAccountById,
  logContactActivity,
  listContactNotes,
  getDb,
} from "../db";
import {
  contacts,
  messages,
  aiCalls,
  campaigns,
  deals,
  socialPosts,
  longFormContent,
  emailDrafts,
  repurposedContent,
  customFieldDefs,
  users,
  accounts,
  leadScoreHistory,
  jarvisScheduledTasks,
  supportTickets,
} from "../../drizzle/schema";
import { billedDispatchSMS, billedDispatchEmail } from "./billedDispatch";
import { triggerWorkflow } from "./workflowEngine";
import { generateSocialPost } from "./contentGenerator";
import { invokeLLM } from "../_core/llm";
import { trackUsage, chargeBeforeSend } from "./usageTracker";
import { listMembers, getOrCreateWarmingConfig } from "../db";
import { getAccountCustomFieldDefs } from "../routers/customFields";
import { getScoreTier } from "./leadScoringEngine";
import { createVapiCall, resolveAssistantId, mapVapiStatus, VapiApiError } from "./vapi";
import { isWithinBusinessHours, type BusinessHoursConfig } from "../utils/businessHours";
import { enqueueMessage } from "./messageQueue";
import { sendEmail } from "./sendgrid";
import {
  generateDailyActivityReport,
  getDailyActivityDateWindow,
} from "./reportEmailGenerator";
import { generatePipelineSummaryReport } from "./pipelineSummaryReport";
import { usageEvents, accountBilling } from "../../drizzle/schema";

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
      description: "Get messaging stats: total, sent, delivered, failed, emails, sms counts. For details on WHY messages failed, use get_failed_messages instead.",
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
      description: "Update fields on an existing contact. Use assignedUserId to assign the contact to a team member.",
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
          assignedUserId: { type: "number", description: "ID of the team member to assign this contact to" },
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
      description: "Add a note to a contact's record. Include a disposition when the note is about a call or contact attempt outcome.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          content: { type: "string", description: "Note text" },
          disposition: {
            type: "string",
            description: "Call/contact disposition. Use when the note is about a call or outreach attempt.",
            enum: ["voicemail_full", "left_voicemail", "no_answer", "answered", "callback_requested", "wrong_number", "do_not_call", "appointment_set", "not_interested", "other"],
          },
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
  {
    type: "function",
    function: {
      name: "check_appointment_availability",
      description: "Check available appointment slots for a calendar on a specific date.",
      parameters: {
        type: "object",
        properties: {
          calendarId: { type: "number" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
        },
        required: ["calendarId", "date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book an appointment for a contact on a specific calendar at a specific time.",
      parameters: {
        type: "object",
        properties: {
          calendarId: { type: "number" },
          contactId: { type: "number" },
          startTime: { type: "string", description: "ISO datetime string for appointment start" },
          endTime: { type: "string", description: "ISO datetime string for appointment end" },
          notes: { type: "string" },
        },
        required: ["calendarId", "contactId", "startTime", "endTime"],
        additionalProperties: false,
      },
    },
  },

  // ── Content Creation ──
  {
    type: "function",
    function: {
      name: "generate_social_post",
      description: "Generate AI social media post content for a specific platform. Returns draft variations the user can review.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["facebook", "instagram", "linkedin", "twitter"] },
          topic: { type: "string" },
          tone: { type: "string", enum: ["professional", "casual", "funny", "inspiring", "educational"] },
          variationsCount: { type: "number", description: "Number of variations (1-3, default 1)" },
        },
        required: ["platform", "topic", "tone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_social_post",
      description: "Schedule a social media post draft for publishing at a specific date and time.",
      parameters: {
        type: "object",
        properties: {
          postId: { type: "number" },
          scheduledAt: { type: "string", description: "ISO datetime string" },
        },
        required: ["postId", "scheduledAt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_blog_post",
      description: "Generate a full long-form blog article using AI on a given topic. Saves as draft automatically.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          wordCountTarget: { type: "number", description: "Target word count (default 800)" },
        },
        required: ["topic"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_email_draft",
      description: "Generate an AI-written marketing or outreach email. Optionally based on a contact's conversation history.",
      parameters: {
        type: "object",
        properties: {
          templateType: { type: "string", enum: ["newsletter", "nurture", "follow_up", "introduction", "promotional", "re_engagement", "custom"] },
          topic: { type: "string" },
          tone: { type: "string", enum: ["professional", "friendly", "casual", "urgent", "empathetic"] },
          contactId: { type: "number", description: "Optional: personalize for this contact" },
        },
        required: ["templateType", "topic", "tone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email_draft",
      description: "Send a saved email draft to its associated contact.",
      parameters: {
        type: "object",
        properties: {
          draftId: { type: "number" },
        },
        required: ["draftId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "repurpose_blog_post",
      description: "Repurpose an existing blog post into a different format — social snippet, email summary, video script, etc.",
      parameters: {
        type: "object",
        properties: {
          contentId: { type: "number" },
          format: { type: "string", enum: ["social-snippet", "email-summary", "short-form", "infographic-script", "video-script"] },
        },
        required: ["contentId", "format"],
        additionalProperties: false,
      },
    },
  },

  // ── Campaign Management ──
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Create a new SMS or email campaign with a name, message body, and optional subject.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["sms", "email"] },
          body: { type: "string" },
          subject: { type: "string", description: "Required if type is email" },
        },
        required: ["name", "type", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_campaign",
      description: "Start sending a campaign that is in draft or scheduled status.",
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "number" },
        },
        required: ["campaignId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pause_campaign",
      description: "Pause an active campaign.",
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "number" },
        },
        required: ["campaignId"],
        additionalProperties: false,
      },
    },
  },

  // ── Pipeline & Deals (expanded) ──
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Create a new deal in the pipeline for a contact.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          contactId: { type: "number" },
          value: { type: "number", description: "Deal value in dollars" },
          stageId: { type: "number", description: "Target stage ID (uses first stage if omitted)" },
        },
        required: ["title", "contactId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_deal",
      description: "Update a deal's title, value, or stage.",
      parameters: {
        type: "object",
        properties: {
          dealId: { type: "number" },
          title: { type: "string" },
          value: { type: "number" },
          stageId: { type: "number" },
        },
        required: ["dealId"],
        additionalProperties: false,
      },
    },
  },

  // ── Inbox & Inbound Messages ──
  {
    type: "function",
    function: {
      name: "get_inbox_conversations",
      description: "Get recent inbound conversations — contacts who have sent messages. Optionally filter by channel type.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["email", "sms"] },
          limit: { type: "number", description: "Max conversations to return (default 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_conversation",
      description: "Get the full message history (both inbound and outbound) with a specific contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          limit: { type: "number", description: "Max messages to return (default 20)" },
        },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },

  // ── Custom Fields ──
  {
    type: "function",
    function: {
      name: "get_contact_custom_fields",
      description: "Get all custom field values for a specific contact.",
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
  {
    type: "function",
    function: {
      name: "update_contact_custom_field",
      description: "Set the value of a custom field for a contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          fieldKey: { type: "string", description: "The slug of the custom field" },
          value: { type: "string" },
        },
        required: ["contactId", "fieldKey", "value"],
        additionalProperties: false,
      },
    },
  },

  // ── Lead Scoring ──
  {
    type: "function",
    function: {
      name: "get_contact_lead_score",
      description: "Get the AI lead score and scoring breakdown for a contact.",
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

  // ── Voice Calls ──
  {
    type: "function",
    function: {
      name: "initiate_ai_voice_call",
      description: "Initiate an AI voice call to a contact using the configured VAPI voice agent.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          agentId: { type: "string", description: "Optional: specific VAPI agent ID (uses account default if omitted)" },
        },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_call_history",
      description: "Get recent AI voice call history for the account or for a specific contact.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "number" },
          limit: { type: "number", description: "Max calls to return (default 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ── Scheduled Tasks ──
  {
    type: "function",
    function: {
      name: "schedule_recurring_task",
      description: "Schedule a recurring task that Jarvis will execute automatically. Examples: 'Send me a pipeline summary every Monday at 9am', 'Generate a social post every weekday at 10am'. The user describes what they want and how often.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short name for the task, e.g. 'Weekly Pipeline Summary'" },
          prompt: { type: "string", description: "The full instruction Jarvis should execute each time, e.g. 'Get my pipeline overview and send me a summary via email'" },
          cronExpression: { type: "string", description: "Cron expression (5 fields: min hour dom month dow). E.g. '0 9 * * 1' for every Monday at 9am" },
          scheduleDescription: { type: "string", description: "Human-readable schedule, e.g. 'Every Monday at 9:00 AM'" },
        },
        required: ["name", "prompt", "cronExpression", "scheduleDescription"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_scheduled_task",
      description: "Cancel/delete a scheduled recurring task by its ID.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "The ID of the scheduled task to cancel" },
        },
        required: ["taskId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_scheduled_tasks",
      description: "List all scheduled recurring tasks for the current account.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ── Team Members ──
  {
    type: "function",
    function: {
      name: "list_team_members",
      description: "List all team members in the current account. Use this to find a user's ID before assigning a contact to them.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },

  // ── Support Tickets ──
  {
    type: "function",
    function: {
      name: "submit_support_ticket",
      description: "Submit a support ticket to the agency admin. Use this when the user reports a bug, requests a feature, or needs billing help.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Short summary of the issue" },
          category: { type: "string", enum: ["bug", "feature", "billing", "general"] },
          message: { type: "string", description: "Detailed description of the issue" },
        },
        required: ["subject", "category", "message"],
        additionalProperties: false,
      },
    },
  },

  // ── Email Warming ──
  {
    type: "function",
    function: {
      name: "get_email_warming_status",
      description: "Get the current email warming status, including the daily limit, max limit, and whether warming is complete.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },

  // ── Reports ──
  {
    type: "function",
    function: {
      name: "generate_daily_activity_report",
      description: "Generate a daily activity report for the account. Includes inbound calls, outbound SMS/email, contact updates, dispositions, hot leads, appointments, AI call outcomes, and sequence activity. Defaults to yesterday. Returns HTML summary inline in chat.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date to report on in YYYY-MM-DD format. Defaults to yesterday if omitted.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_pipeline_summary",
      description: "Generate a pipeline summary report with 7 sections: pipeline snapshot, period activity, pipeline velocity, conversion funnel, stale deals, at-risk high-value deals, and top performers. Returns structured data + HTML.",
      parameters: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date in YYYY-MM-DD format. Required.",
          },
          endDate: {
            type: "string",
            description: "End date in YYYY-MM-DD format. Required.",
          },
        },
        required: ["startDate", "endDate"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_usage_report",
      description: "Get current billing period usage breakdown: total spend by category (SMS, email, AI calls, voice calls, LLM, dialer), current balance, and event counts. Use for questions about costs, spending, or billing.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month"],
            description: "Time period for the usage report. Defaults to 'month'.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_report",
      description: "Send a previously generated report as a formatted email via SendGrid. Use this after generating a report when the user wants it emailed. This uses the system email sender (not billed to client).",
      parameters: {
        type: "object",
        properties: {
          reportHtml: {
            type: "string",
            description: "The HTML content of the report to email.",
          },
          recipientEmails: {
            type: "array",
            items: { type: "string" },
            description: "Array of email addresses to send the report to.",
          },
          subject: {
            type: "string",
            description: "Email subject line.",
          },
          note: {
            type: "string",
            description: "Optional note to include at the top of the email.",
          },
        },
        required: ["reportHtml", "recipientEmails", "subject"],
        additionalProperties: false,
      },
    },
  },

  // ── Failed Message Investigation ──
  {
    type: "function",
    function: {
      name: "get_failed_messages",
      description: "Get details about failed messages including the contact name, message type, destination, error reason, and timestamp. Use this when asked why messages failed or to investigate delivery issues.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max number of failed messages to return (default 10, max 50)",
          },
          contactId: {
            type: "number",
            description: "Optional — filter to failed messages for a specific contact",
          },
          type: {
            type: "string",
            enum: ["sms", "email"],
            description: "Optional — filter by message type",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ── Part D: Note action items + application link tools ──
  {
    type: "function" as const,
    function: {
      name: "check_notes_for_action_items",
      description:
        "Scan recent public notes across contacts in the account, identify actionable phrases (send application link, follow up, credit repair needed, callback requested), and return suggested actions.",
      parameters: {
        type: "object",
        properties: {
          lookbackDays: {
            type: "number",
            description: "Number of days to look back for notes (default 7)",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_application_link",
      description:
        "Send a pre-configured loan application link to a contact via SMS or email. Uses the account's configured application URL or a default.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "number",
            description: "The contact ID to send the application link to",
          },
          channel: {
            type: "string",
            enum: ["sms", "email"],
            description: "Send via SMS or email (default: sms if phone available, else email)",
          },
        },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_pending_tasks",
      description:
        "List pending Jarvis tasks in the task queue for the current account. Returns tasks that need approval (e.g., send application link, follow-up reminders).",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bulk_add_contact_notes",
      description: "Add the same note (with optional disposition) to multiple contacts at once. Use this instead of calling add_contact_note repeatedly when dispositioning more than 3 contacts. Supports up to 500 contacts per call.",
      parameters: {
        type: "object",
        properties: {
          contactIds: {
            type: "array",
            items: { type: "number" },
            description: "Array of contact IDs to add the note to (1-500)",
          },
          content: { type: "string", description: "Note text to add to each contact" },
          disposition: {
            type: "string",
            description: "Call/contact disposition to set on each contact",
            enum: ["voicemail_full", "left_voicemail", "no_answer", "answered", "callback_requested", "wrong_number", "do_not_call", "appointment_set", "not_interested", "other"],
          },
          isInternal: {
            type: "boolean",
            description: "If true, notes are internal (hidden from employees). Defaults to false.",
          },
        },
        required: ["contactIds", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description:
        "Mark a Jarvis task queue item as completed after executing it.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "number",
            description: "The task queue item ID to mark as completed",
          },
        },
        required: ["taskId"],
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

    case "get_failed_messages": {
      const limit = Math.min((args.limit as number) || 10, 50);
      const db = await getDb();
      if (!db) return { total: 0, messages: [] };

      // Build conditions
      const conditions = [
        eq(messages.accountId, accountId),
        eq(messages.status, "failed"),
      ];
      if (args.contactId) conditions.push(eq(messages.contactId, args.contactId as number));
      if (args.type) conditions.push(eq(messages.type, args.type as "sms" | "email"));

      // Count total
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(messages)
        .where(and(...conditions));

      // Fetch rows joined with contacts for name
      const rows = await db
        .select({
          id: messages.id,
          contactId: messages.contactId,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          type: messages.type,
          toAddress: messages.toAddress,
          body: messages.body,
          subject: messages.subject,
          errorMessage: messages.errorMessage,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(contacts, eq(messages.contactId, contacts.id))
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      // Twilio SMS error code mapping
      const twilioErrorMap: Record<string, string> = {
        "30003": "Unreachable destination \u2014 phone may be off or out of service",
        "30004": "Message blocked \u2014 carrier blocked this message",
        "30005": "Unknown destination \u2014 number doesn\u2019t exist",
        "30006": "Landline number \u2014 SMS cannot be delivered to landlines",
        "30007": "Message filtered by carrier \u2014 may contain flagged content",
        "30008": "Unknown error from carrier",
        "21211": "Invalid phone number format",
      };

      const getHumanReason = (errorMsg: string | null, msgType: string): string => {
        if (!errorMsg) {
          return msgType === "email"
            ? "Email delivery failed \u2014 server rejected the message or address bounced"
            : "Delivery failed \u2014 carrier or server rejected the message";
        }
        // Try to extract a Twilio error code from the error message
        const codeMatch = errorMsg.match(/\b(3000[3-8]|21211)\b/);
        if (codeMatch && twilioErrorMap[codeMatch[1]]) {
          return twilioErrorMap[codeMatch[1]];
        }
        // Check for common email bounce keywords
        const lower = errorMsg.toLowerCase();
        if (lower.includes("bounce")) return "Email bounced \u2014 recipient address is invalid or mailbox full";
        if (lower.includes("spam") || lower.includes("blocked")) return "Message blocked \u2014 flagged as spam by recipient server";
        if (lower.includes("invalid") && lower.includes("email")) return "Invalid email address";
        if (lower.includes("unsubscribe") || lower.includes("suppression")) return "Recipient has unsubscribed or is on suppression list";
        // Fallback: return the raw error message (truncated)
        return errorMsg.length > 120 ? errorMsg.slice(0, 120) + "\u2026" : errorMsg;
      }

      return {
        total: cnt,
        messages: rows.map((m) => {
          const contactName = [m.contactFirstName, m.contactLastName].filter(Boolean).join(" ");
          return {
            id: m.id,
            contact: contactName || `Contact #${m.contactId}`,
            contactId: m.contactId,
            type: m.type,
            sentTo: m.toAddress,
            preview: m.body?.slice(0, 100) || null,
            errorCode: m.errorMessage?.match(/\b(\d{5})\b/)?.[1] || null,
            reason: getHumanReason(m.errorMessage, m.type),
            failedAt: m.createdAt,
          };
        }),
      };
    }

    // ── Contact Management ───
    case "search_contacts": {
      const searchTerm = (args.search as string | undefined) || "";
      const searchLimit = Math.min((args.limit as number) || 20, 50);
      const baseFilters = {
        accountId,
        status: args.status as string | undefined,
        tag: args.tag as string | undefined,
        limit: searchLimit,
        offset: 0,
      };

      // Retry strategy: full term → individual words (for multi-word queries)
      let result = await listContacts({ ...baseFilters, search: searchTerm || undefined });

      // If no results and search has multiple words, try each word separately
      if (result.data.length === 0 && searchTerm.trim().includes(" ")) {
        const words = searchTerm.trim().split(/\s+/);
        const seenIds = new Set<number>();
        const combined: typeof result.data = [];
        for (const word of words) {
          if (word.length < 2) continue;
          const partial = await listContacts({ ...baseFilters, search: word });
          for (const c of partial.data) {
            if (!seenIds.has(c.id)) {
              seenIds.add(c.id);
              combined.push(c);
            }
          }
        }
        result = { data: combined.slice(0, searchLimit), total: combined.length };
      }

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
      const notes = await listContactNotes(contact.id);
      // Internal notes are Jarvis-excluded per client requirement (PMR)
      const publicNotes = notes.filter(n => !(n as any).isInternal);
      return {
        ...contact,
        tags: tags.map(t => t.tag),
        recentMessages: recentMessages.slice(0, 5).map(m => ({
          id: m.id, type: m.type, direction: m.direction,
          subject: m.subject, body: m.body?.substring(0, 200),
          status: m.status, createdAt: m.createdAt,
        })),
        notes: publicNotes.slice(0, 10).map(n => ({
          id: n.id,
          body: n.content,
          disposition: (n as any).disposition ?? null,
          createdAt: n.createdAt,
          createdByUserId: n.authorId,
          authorName: n.authorName ?? null,
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
        ...(args.disposition ? { disposition: args.disposition as string } : {}),
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
      const smsResult = await billedDispatchSMS({
        accountId,
        to: contact.phone,
        body: args.body as string,
        contactId: contact.id,
        userId,
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
      const emailResult = await billedDispatchEmail({
        accountId,
        to: contact.email,
        subject: args.subject as string,
        body: args.body as string,
        contactId: contact.id,
        userId,
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
      const mapped = msgs.slice(0, 20).map(m => ({
        id: m.id, type: m.type, direction: m.direction,
        subject: m.subject, body: m.body?.substring(0, 300),
        status: m.status, createdAt: m.createdAt,
      }));
      return { messages: mapped, total: mapped.length };
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
      return { workflows: wfs.map(w => ({
        id: w.id, name: w.name, isActive: w.isActive,
        triggerType: w.triggerType, description: w.description,
      })), total: wfs.length };
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
      return { segments: segs.map(s => ({
        id: s.id, name: s.name, description: s.description,
        icon: s.icon, color: s.color,
      })), total: segs.length };
    }

    // ── Sequences ──
    case "list_sequences": {
      const seqs = await listSequences(accountId);
      return { sequences: seqs.map(s => ({
        id: s.id, name: s.name, status: s.status,
        stepCount: s.stepCount, activeEnrollments: s.activeEnrollments,
        completedCount: s.completedCount,
      })), total: seqs.length };
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
      return { calendars: cals.map(c => ({
        id: c.id, name: c.name, slug: c.slug,
      })), total: cals.length };
    }

    case "get_contact_appointments": {
      const appts = await getAppointmentsByContact(args.contactId as number, accountId);
      return { appointments: appts.map(a => ({
        id: a.id, guestName: a.guestName, startTime: a.startTime,
        endTime: a.endTime, status: a.status, notes: a.notes,
      })), total: appts.length };
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

          const smsResult = await billedDispatchSMS({
            accountId,
            to: contact.phone,
            body,
            contactId: contact.id,
            userId,
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

    // ── Appointment Booking (new) ──
    case "check_appointment_availability": {
      const slots = await getAvailableSlots(
        args.calendarId as number,
        args.date as string
      );
      return { calendarId: args.calendarId, date: args.date, availableSlots: slots };
    }

    case "book_appointment": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      const result = await createAppointment({
        calendarId: args.calendarId as number,
        accountId,
        contactId: contact.id,
        guestName: `${contact.firstName} ${contact.lastName}`.trim(),
        guestEmail: contact.email || "no-email@placeholder.com",
        guestPhone: contact.phone || undefined,
        startTime: new Date(args.startTime as string),
        endTime: new Date(args.endTime as string),
        notes: (args.notes as string) || undefined,
      });
      logContactActivity({
        contactId: contact.id,
        accountId,
        activityType: "appointment_booked",
        description: `Appointment booked by Jarvis AI for ${args.startTime}`,
      });
      return { success: true, id: result.id, startTime: args.startTime, endTime: args.endTime };
    }

    // ── Content Creation ──
    case "generate_social_post": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };
      const variations = args.variationsCount
        ? Math.min(Math.max(args.variationsCount as number, 1), 3)
        : 1;
      const genResult = await generateSocialPost({
        accountId,
        platform: args.platform as any,
        topic: args.topic as string,
        tone: args.tone as any,
        variationsCount: variations,
      });
      // Save the first variation as a draft
      const first = genResult.variations[0];
      const [insertResult] = await db.insert(socialPosts).values({
        accountId,
        createdByUserId: userId,
        platform: args.platform as any,
        content: first.content,
        hashtags: JSON.stringify(first.hashtags),
        imagePrompt: first.imagePrompt,
        status: "draft",
        tone: args.tone as string,
        topic: args.topic as string,
      });
      await trackUsage({
        accountId,
        userId,
        eventType: "llm_request",
        quantity: 1,
        metadata: { feature: "jarvis_social_post", platform: args.platform },
      }).catch(() => {});
      return {
        draftId: insertResult.insertId,
        variations: genResult.variations.map((v) => ({
          content: v.content,
          hashtags: v.hashtags,
          imagePrompt: v.imagePrompt,
        })),
      };
    }

    case "schedule_social_post": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.id, args.postId as number),
            eq(socialPosts.accountId, accountId)
          )
        )
        .limit(1);
      if (!post) return { error: "Post not found" };
      await db
        .update(socialPosts)
        .set({
          status: "scheduled",
          scheduledAt: new Date(args.scheduledAt as string),
        })
        .where(eq(socialPosts.id, post.id));
      return { success: true, postId: post.id, scheduledAt: args.scheduledAt };
    }

    case "generate_blog_post": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };
      const topic = args.topic as string;
      const wordTarget = (args.wordCountTarget as number) || 800;
      const systemPrompt = `You are an expert content writer and SEO specialist. Generate a high-quality, long-form blog post in Markdown format.
INSTRUCTIONS:
Write a comprehensive, well-researched blog post about "${topic}".
REQUIREMENTS:
- Write in Markdown format with proper headings (##, ###), paragraphs, lists, and emphasis.
- Include a compelling title as the first H1 heading.
- Aim for ${wordTarget} words of substantive content.
- Use engaging hooks, data points, and actionable insights.
- Include a meta description suggestion at the end.
- Make the content SEO-friendly with natural keyword usage.
- End with a strong conclusion and call to action.
Return your response as valid JSON.`;
      const llmResp = await invokeLLM({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a long-form blog post about: ${topic}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "blog_post",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                metaDescription: { type: "string" },
                imagePrompt: { type: "string" },
              },
              required: ["title", "content", "metaDescription", "imagePrompt"],
              additionalProperties: false,
            },
          },
        },
      });
      const raw = llmResp.choices?.[0]?.message?.content;
      const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (!rawStr) return { error: "LLM returned empty response" };
      let parsed: { title: string; content: string; metaDescription: string; imagePrompt: string };
      try {
        parsed = JSON.parse(rawStr);
      } catch {
        return { error: "Failed to parse LLM response" };
      }
      const wordCount = parsed.content.split(/\s+/).filter(Boolean).length;
      const [result] = await db.insert(longFormContent).values({
        accountId,
        createdByUserId: userId,
        title: parsed.title,
        topic,
        content: parsed.content,
        imagePrompt: parsed.imagePrompt,
        status: "draft",
        aiModel: "gemini-2.5-flash",
        wordCount,
      });
      await trackUsage({
        accountId,
        userId,
        eventType: "llm_request",
        quantity: 1,
        metadata: { feature: "jarvis_blog_post" },
      }).catch(() => {});
      return { id: result.insertId, title: parsed.title, wordCount };
    }

    case "generate_email_draft": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };
      const templateType = args.templateType as string;
      const tone = args.tone as string;
      const topic = args.topic as string;
      const EMAIL_TEMPLATE_PROMPTS: Record<string, string> = {
        newsletter: "Write a professional email newsletter (200\u2013350 words). Include a subject line, engaging intro, 2\u20133 key sections with subheadings, and a CTA.",
        nurture: "Write a lead nurturing email (150\u2013250 words). Warm, educational tone. Provide value, address a pain point, soft CTA.",
        follow_up: "Write a follow-up email (100\u2013150 words). Reference the previous conversation naturally, move the relationship forward, clear next step.",
        introduction: "Write a first-touch introduction email (100\u2013150 words). Professional, friendly, establish credibility, clear value prop.",
        promotional: "Write a promotional email (150\u2013200 words). Compelling offer, urgency, clear CTA button text suggestion.",
        re_engagement: "Write a re-engagement email (100\u2013150 words). Acknowledge the gap, offer fresh value, easy low-friction CTA.",
        custom: "Write a professional marketing email. Follow any custom instructions provided.",
      };
      const basePrompt = EMAIL_TEMPLATE_PROMPTS[templateType] || EMAIL_TEMPLATE_PROMPTS.custom;
      // Fetch sender context
      const [sender] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const [account] = await db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);
      // Build contact context
      let contactContext = "";
      let contactName = "";
      if (args.contactId) {
        const contact = await getContactById(args.contactId as number, accountId);
        if (contact) {
          contactName = `${contact.firstName} ${contact.lastName}`.trim();
          contactContext += `\nRecipient: ${contactName}`;
          if (contact.email) contactContext += ` (${contact.email})`;
          if (contact.company) contactContext += `, Company: ${contact.company}`;
          // Fetch recent messages for context
          const recentMsgs = await db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.contactId, args.contactId as number),
                eq(messages.accountId, accountId)
              )
            )
            .orderBy(desc(messages.createdAt))
            .limit(10);
          if (recentMsgs.length > 0) {
            const history = recentMsgs
              .reverse()
              .map(
                (m) =>
                  `[${m.direction === "outbound" ? "You" : contactName || "Contact"}] ${m.subject ? `Subject: ${m.subject} \u2014 ` : ""}${m.body}`
              )
              .join("\n\n");
            contactContext += `\n\nPrevious conversation history:\n${history}`;
          }
        }
      }
      const sysPrompt = `${basePrompt}\n\nTone: ${tone}.\n\nYou MUST respond with valid JSON matching this exact schema: { "subject": "string", "previewText": "string", "body": "string" }. The body should use HTML formatting with <p>, <h3>, <strong>, <a> tags for email rendering. Do not include any text outside the JSON object. IMPORTANT: Always sign off the email using the provided Sender Name and Company. NEVER use placeholders like [Your Name] or [Company Name].`;
      let userMessage = `Topic: ${topic}\n\nSender Name: ${sender?.name || "The Sender"}`;
      if (account?.name) userMessage += `\nSender Company/Account: ${account.name}`;
      if (contactContext) userMessage += `\n${contactContext}`;
      const emailResp = await invokeLLM({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userMessage },
        ],
        model: "gemini-2.5-flash",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_generation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject: { type: "string" },
                previewText: { type: "string" },
                body: { type: "string" },
              },
              required: ["subject", "previewText", "body"],
              additionalProperties: false,
            },
          },
        },
      });
      const emailRaw = emailResp.choices?.[0]?.message?.content;
      const emailStr = typeof emailRaw === "string" ? emailRaw : JSON.stringify(emailRaw);
      if (!emailStr) return { error: "LLM returned empty response" };
      let emailParsed: { subject: string; previewText: string; body: string };
      try {
        emailParsed = JSON.parse(emailStr);
      } catch {
        return { error: "Failed to parse LLM response" };
      }
      const [draftResult] = await db.insert(emailDrafts).values({
        accountId,
        createdByUserId: userId,
        contactId: (args.contactId as number) || undefined,
        subject: emailParsed.subject,
        body: emailParsed.body,
        previewText: emailParsed.previewText,
        templateType,
        tone,
        topic,
        aiModel: "gemini-2.5-flash",
        status: "draft",
      });
      await trackUsage({
        accountId,
        userId,
        eventType: "llm_request",
        quantity: 1,
        metadata: { feature: "jarvis_email_draft", templateType },
      }).catch(() => {});
      return {
        id: draftResult.insertId,
        subject: emailParsed.subject,
        previewText: emailParsed.previewText,
        body: emailParsed.body,
      };
    }

    case "send_email_draft": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };
      const [draft] = await db
        .select()
        .from(emailDrafts)
        .where(
          and(
            eq(emailDrafts.id, args.draftId as number),
            eq(emailDrafts.accountId, accountId)
          )
        )
        .limit(1);
      if (!draft) return { error: "Draft not found" };
      if (draft.status !== "draft") return { error: `Draft is already ${draft.status}` };
      if (!draft.contactId) return { error: "Draft has no associated contact" };
      const contact = await getContactById(draft.contactId, accountId);
      if (!contact) return { error: "Contact not found" };
      if (!contact.email) return { error: "Contact has no email address" };
      const emailResult = await billedDispatchEmail({
        accountId,
        to: contact.email,
        subject: draft.subject,
        body: draft.body,
        contactId: contact.id,
        userId,
        metadata: { feature: "jarvis_send_draft" },
      });
      if (emailResult.success) {
        await db
          .update(emailDrafts)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(emailDrafts.id, draft.id));
        await createMessage({
          accountId,
          contactId: contact.id,
          userId,
          type: "email",
          direction: "outbound",
          status: "sent",
          subject: draft.subject,
          body: draft.body,
          toAddress: contact.email,
        });
        logContactActivity({
          contactId: contact.id,
          accountId,
          activityType: "message_sent",
          description: `Email draft sent by Jarvis AI: "${draft.subject}"`,
        });
      }
      return { success: emailResult.success, sentTo: contact.email, error: emailResult.error };
    }

    case "repurpose_blog_post": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };
      const [original] = await db
        .select()
        .from(longFormContent)
        .where(
          and(
            eq(longFormContent.id, args.contentId as number),
            eq(longFormContent.accountId, accountId)
          )
        )
        .limit(1);
      if (!original) return { error: "Content not found" };
      const format = args.format as string;
      const REPURPOSE_PROMPTS_MAP: Record<string, (title: string) => string> = {
        "social-snippet": (title) =>
          `Convert the following blog post into a concise, engaging social media post (max 280 characters). Include a hook and call to action. The original title is "${title}".`,
        "email-summary": (title) =>
          `Convert the following blog post into a professional email newsletter summary (150-250 words). Include a subject line suggestion, key takeaways, and a CTA to read the full article. The original title is "${title}".`,
        "short-form": (title) =>
          `Condense the following blog post into a short-form article (300-500 words) that captures the key points. Maintain the core message and value. The original title is "${title}".`,
        "infographic-script": (title) =>
          `Extract the key data points, statistics, and main ideas from the following blog post and organize them into an infographic script with sections, bullet points, and suggested visual elements. The original title is "${title}".`,
        "video-script": (title) =>
          `Convert the following blog post into a 2-3 minute video script with an intro hook, main talking points, and outro with CTA. Include speaker notes and suggested B-roll descriptions. The original title is "${title}".`,
      };
      const promptBuilder = REPURPOSE_PROMPTS_MAP[format];
      if (!promptBuilder) return { error: `Unknown format: ${format}` };
      const repurposeResp = await invokeLLM({
        messages: [
          { role: "system", content: promptBuilder(original.title) },
          { role: "user", content: `Here is the blog post to repurpose:\n\n${original.content}` },
        ],
      });
      const repurposeRaw = repurposeResp.choices?.[0]?.message?.content;
      const generatedContent = typeof repurposeRaw === "string" ? repurposeRaw : JSON.stringify(repurposeRaw);
      if (!generatedContent) return { error: "LLM returned empty response" };
      const [repResult] = await db.insert(repurposedContent).values({
        accountId,
        originalContentId: args.contentId as number,
        format: format as any,
        content: generatedContent,
      });
      await trackUsage({
        accountId,
        userId,
        eventType: "llm_request",
        quantity: 1,
        metadata: { feature: "jarvis_repurpose", format },
      }).catch(() => {});
      return { id: repResult.insertId, format, content: generatedContent };
    }

    // ── Campaign Management ──
    case "create_campaign": {
      const result = await createCampaign({
        accountId,
        name: args.name as string,
        type: args.type as "email" | "sms",
        body: args.body as string,
        subject: (args.subject as string) || null,
        status: "draft",
        createdById: userId,
      });
      return { success: true, id: result.id, name: args.name, type: args.type, status: "draft" };
    }

    case "send_campaign": {
      const campaign = await getCampaign(args.campaignId as number, accountId);
      if (!campaign) return { error: "Campaign not found" };
      if (campaign.status !== "draft" && campaign.status !== "scheduled") {
        return { error: `Cannot send a campaign with status "${campaign.status}"` };
      }
      await updateCampaign(args.campaignId as number, accountId, {
        status: "sending",
        sentAt: new Date(),
      });
      return { success: true, campaignId: args.campaignId };
    }

    case "pause_campaign": {
      const campaign = await getCampaign(args.campaignId as number, accountId);
      if (!campaign) return { error: "Campaign not found" };
      await updateCampaign(args.campaignId as number, accountId, { status: "paused" });
      return { success: true };
    }

    // ── Pipeline & Deals (expanded) ──
    case "create_deal": {
      const pipeline = await getOrCreateDefaultPipeline(accountId);
      let stageId = args.stageId as number | undefined;
      if (!stageId) {
        const stages = await listPipelineStages(pipeline.id, accountId);
        if (stages.length === 0) return { error: "No pipeline stages found" };
        stageId = stages[0].id;
      }
      const dealResult = await createDeal({
        accountId,
        pipelineId: pipeline.id,
        contactId: args.contactId as number,
        title: args.title as string,
        value: (args.value as number) || 0,
        stageId,
      });
      logContactActivity({
        contactId: args.contactId as number,
        accountId,
        activityType: "pipeline_stage_changed",
        description: `Deal "${args.title}" created by Jarvis AI`,
      });
      return { success: true, id: dealResult.id, title: args.title, stageId };
    }

    case "update_deal": {
      const updateData: Record<string, unknown> = {};
      if (args.title !== undefined) updateData.title = args.title;
      if (args.value !== undefined) updateData.value = args.value;
      if (args.stageId !== undefined) updateData.stageId = args.stageId;
      await updateDeal(args.dealId as number, accountId, updateData as any);
      return { success: true, dealId: args.dealId };
    }

    // ── Inbox & Inbound Messages ──
    case "get_inbox_conversations": {
      const limit = Math.min((args.limit as number) || 10, 50);
      const result = await getConversations({
        accountId,
        type: args.type as "email" | "sms" | undefined,
        limit,
        offset: 0,
      });
      return {
        conversations: result.conversations.map((c) => ({
          contactId: c.contactId,
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          unreadCount: c.unreadCount,
          lastMessageAt: c.lastMessageAt,
          latestMessage: c.latestMessage,
        })),
        total: result.total,
      };
    }

    case "get_contact_conversation": {
      const limit = Math.min((args.limit as number) || 20, 50);
      const allMsgs = await listMessagesByContact(args.contactId as number, accountId);
      const mapped = allMsgs.slice(0, limit).map((m) => ({
        id: m.id,
        type: m.type,
        direction: m.direction,
        subject: m.subject,
        body: m.body?.substring(0, 500),
        status: m.status,
        createdAt: m.createdAt,
      }));
      return { messages: mapped, total: mapped.length };
    }

    // ── Custom Fields ──
    case "get_contact_custom_fields": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      const defs = await getAccountCustomFieldDefs(accountId);
      const cfData: Record<string, unknown> = contact.customFields
        ? JSON.parse(contact.customFields)
        : {};
      return { fields: defs.map((def) => ({
        fieldName: def.name,
        fieldKey: def.slug,
        value: cfData[def.slug] ?? null,
        fieldType: def.type,
      })), total: defs.length };
    }

    case "update_contact_custom_field": {
      const db = await getDb();
      if (!db) return { error: "Database unavailable" };
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      const defs = await getAccountCustomFieldDefs(accountId);
      const fieldDef = defs.find((d) => d.slug === (args.fieldKey as string));
      if (!fieldDef) return { error: `Custom field "${args.fieldKey}" not found for this account` };
      const existingCf: Record<string, unknown> = contact.customFields
        ? JSON.parse(contact.customFields)
        : {};
      existingCf[args.fieldKey as string] = args.value;
      await db
        .update(contacts)
        .set({ customFields: JSON.stringify(existingCf) })
        .where(and(eq(contacts.id, args.contactId as number), eq(contacts.accountId, accountId)));
      logContactActivity({
        contactId: args.contactId as number,
        accountId,
        activityType: "note_added",
        description: `Custom field "${fieldDef.name}" updated to "${args.value}" by Jarvis AI`,
      });
      return { success: true, fieldKey: args.fieldKey, value: args.value };
    }

    // ── Lead Scoring ──
    case "get_contact_lead_score": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      const score = contact.leadScore ?? 0;
      const tier = getScoreTier(score);
      const history = await getLeadScoreHistory(args.contactId as number, accountId, 10);
      return {
        score,
        grade: tier.label,
        color: tier.color,
        breakdown: history.map((h) => ({
          event: h.event,
          delta: h.delta,
          scoreBefore: h.scoreBefore,
          scoreAfter: h.scoreAfter,
          reason: h.reason,
          createdAt: h.createdAt,
        })),
        lastCalculated: history[0]?.createdAt ?? null,
      };
    }

    // ── Voice Calls ──
    case "initiate_ai_voice_call": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };
      if (!contact.phone) return { error: "Contact does not have a phone number" };
      const assistantId = (args.agentId as string) || resolveAssistantId(contact.leadSource);
      const contactName = `${contact.firstName} ${contact.lastName}`.trim();
      // Check business hours
      const acct = await getAccountById(accountId);
      const bhConfig = acct?.businessHoursConfig as BusinessHoursConfig | null;
      if (!isWithinBusinessHours(bhConfig)) {
        const { id: queueId } = await enqueueMessage({
          accountId,
          contactId: contact.id,
          type: "ai_call",
          payload: {
            contactId: contact.id,
            phoneNumber: contact.phone,
            customerName: contactName,
            assistantId,
            initiatedById: userId,
            metadata: { leadSource: contact.leadSource ?? undefined },
          },
          source: "jarvis_ai",
          initiatedById: userId,
        });
        return {
          success: true,
          queued: true,
          queueId,
          message: "Call queued \u2014 will be dispatched when business hours resume.",
        };
      }
      const { id: callId } = await createAICall({
        accountId,
        contactId: contact.id,
        initiatedById: userId,
        phoneNumber: contact.phone,
        status: "queued",
        direction: "outbound",
        assistantId,
      });
      try {
        const vapiResponse = await createVapiCall({
          phoneNumber: contact.phone,
          customerName: contactName,
          assistantId,
          metadata: {
            apexAccountId: accountId,
            apexContactId: contact.id,
            apexCallId: callId,
            leadSource: contact.leadSource ?? undefined,
          },
        });
        const mappedStatus = mapVapiStatus(vapiResponse.status);
        await updateAICall(callId, {
          status: mappedStatus,
          externalCallId: vapiResponse.id,
          startedAt: new Date(),
          metadata: JSON.stringify(vapiResponse),
        });
        logContactActivity({
          contactId: contact.id,
          accountId,
          activityType: "ai_call_made",
          description: `AI call initiated by Jarvis AI to ${contact.phone}`,
          metadata: JSON.stringify({ callId, externalCallId: vapiResponse.id }),
        });
        return { success: true, callId, externalCallId: vapiResponse.id };
      } catch (err) {
        const errorMsg =
          err instanceof VapiApiError
            ? `VAPI error (${err.statusCode}): ${err.responseBody}`
            : err instanceof Error
              ? err.message
              : "Unknown error initiating VAPI call";
        await updateAICall(callId, { status: "failed", errorMessage: errorMsg });
        return { success: false, callId, error: errorMsg };
      }
    }

    case "get_ai_call_history": {
      const limit = Math.min((args.limit as number) || 10, 50);
      const result = await listAICalls({
        accountId,
        contactId: args.contactId as number | undefined,
        limit,
      });
      // Enrich with contact names
      const enriched = await Promise.all(
        result.data.map(async (call) => {
          const contact = await getContactById(call.contactId, accountId);
          return {
            id: call.id,
            contactId: call.contactId,
            contactName: contact
              ? `${contact.firstName} ${contact.lastName}`.trim()
              : "Unknown",
            phoneNumber: call.phoneNumber,
            status: call.status,
            direction: call.direction,
            durationSeconds: call.durationSeconds,
            summary: call.summary?.substring(0, 200),
            createdAt: call.createdAt,
          };
        })
      );
      return { calls: enriched, total: result.total };
    }

    // ── Scheduled Tasks ──
    case "schedule_recurring_task": {
      const { name, prompt, cronExpression, scheduleDescription } = args as {
        name: string; prompt: string; cronExpression: string; scheduleDescription: string;
      };
      // Validate cron expression (basic: 5 fields)
      const cronParts = cronExpression.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        return { error: "Invalid cron expression. Must have 5 fields: minute hour day-of-month month day-of-week" };
      }
      const schedDb = (await getDb())!;
      const [inserted] = await schedDb.insert(jarvisScheduledTasks).values({
        accountId,
        userId,
        name,
        prompt,
        cronExpression: cronExpression.trim(),
        scheduleDescription,
      });
      return {
        success: true,
        taskId: inserted.insertId ? Number(inserted.insertId) : null,
        message: `Scheduled task "${name}" created. It will run ${scheduleDescription}.`,
        schedule: scheduleDescription,
        cronExpression,
      };
    }

    case "cancel_scheduled_task": {
      const { taskId } = args as { taskId: number };
      const cancelDb = (await getDb())!;
      await cancelDb.delete(jarvisScheduledTasks)
        .where(and(
          eq(jarvisScheduledTasks.id, taskId),
          eq(jarvisScheduledTasks.accountId, accountId),
        ));
      return { success: true, message: `Scheduled task #${taskId} has been cancelled and deleted.` };
    }

    case "list_scheduled_tasks": {
      const listDb = (await getDb())!;
      const tasks = await listDb.select().from(jarvisScheduledTasks)
        .where(eq(jarvisScheduledTasks.accountId, accountId))
        .orderBy(desc(jarvisScheduledTasks.createdAt));
      return {
        tasks: tasks.map((t: typeof jarvisScheduledTasks.$inferSelect) => ({
          id: t.id,
          name: t.name,
          prompt: t.prompt,
          schedule: t.scheduleDescription,
          cronExpression: t.cronExpression,
          isActive: t.isActive,
          lastRunAt: t.lastRunAt,
        })),
        total: tasks.length,
      };
    }

    case "list_team_members": {
      const members = await listMembers(accountId);
      return {
        members: members.map(m => ({
          userId: m.userId,
          name: m.userName,
          email: m.userEmail,
          role: m.role,
          isActive: m.isActive
        }))
      };
    }

    case "submit_support_ticket": {
      const db = await getDb();
      const [result] = await db!.insert(supportTickets).values({
        accountId,
        userId,
        subject: args.subject as string,
        category: args.category as "bug" | "feature" | "billing" | "general",
        message: args.message as string,
        status: "open",
      });
      return { success: true, ticketId: result.insertId, message: "Support ticket submitted successfully." };
    }

    case "get_email_warming_status": {
      const config = await getOrCreateWarmingConfig(accountId);
      const daysSinceStart = Math.floor((Date.now() - config.warmingStartDate.getTime()) / 86400000);
      return {
        enabled: config.enabled,
        currentDailyLimit: config.currentDailyLimit,
        maxDailyLimit: config.maxDailyLimit,
        todaySendCount: config.todaySendCount,
        daysSinceStart,
        warmingComplete: config.currentDailyLimit >= config.maxDailyLimit
      };
    }

    // ── Reports ──
    case "generate_daily_activity_report": {
      const account = await getAccountById(accountId);
      const accountName = account?.name || "Account";

      let startDate: Date;
      let endDate: Date;

      if (args.date) {
        // User specified a date
        const d = new Date(args.date as string + "T00:00:00");
        startDate = new Date(d);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(d);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Default to yesterday (or use the business-day window)
        const window = getDailyActivityDateWindow(new Date());
        if (window) {
          startDate = window.startDate;
          endDate = window.endDate;
        } else {
          // Weekend fallback: use yesterday
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = new Date(yesterday);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(yesterday);
          endDate.setHours(23, 59, 59, 999);
        }
      }

      const { html, csv } = await generateDailyActivityReport(
        accountId,
        startDate,
        endDate,
        accountName
      );

      const dateStr = startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      return {
        success: true,
        reportType: "daily_activity",
        date: dateStr,
        html,
        csvPreview: csv.split("\n").slice(0, 10).join("\n"),
        message: `Daily Activity Report for ${dateStr} generated. You can ask me to email this report to anyone.`,
        suggestFollowUp: "Would you like this scheduled daily? Or want me to email this to someone?",
      };
    }

    case "generate_pipeline_summary": {
      const account = await getAccountById(accountId);
      const accountName = account?.name || "Account";
      const start = new Date(args.startDate as string + "T00:00:00");
      const end = new Date(args.endDate as string + "T23:59:59.999");
      const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      const { html, csv } = await generatePipelineSummaryReport({
        accountId,
        accountName,
        periodDays,
        startDate: start,
        endDate: end,
      });

      const dateRange = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2014 ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      return {
        success: true,
        reportType: "pipeline_summary",
        dateRange,
        periodDays,
        html,
        csvPreview: csv.split("\n").slice(0, 10).join("\n"),
        message: `Pipeline Summary Report for ${dateRange} generated. Includes snapshot, activity, velocity, funnel, stale deals, at-risk deals, and top performers.`,
        suggestFollowUp: "Would you like this scheduled weekly? Or want me to email this to someone?",
      };
    }

    case "get_usage_report": {
      const db = (await getDb())!;
      const period = (args.period as string) || "month";

      const now = new Date();
      let periodStart: Date;
      let periodLabel: string;

      if (period === "today") {
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        periodLabel = "Today";
      } else if (period === "week") {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);
        periodLabel = "Last 7 Days";
      } else {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 30);
        periodLabel = "Last 30 Days";
      }

      // Get usage breakdown by event type
      const usageBreakdown = await db
        .select({
          eventType: usageEvents.eventType,
          totalEvents: count(),
          totalCost: sql<string>`CAST(SUM(${usageEvents.totalCost}) AS CHAR)`,
          totalQuantity: sql<string>`CAST(SUM(${usageEvents.quantity}) AS CHAR)`,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.accountId, accountId),
            gte(usageEvents.createdAt, periodStart),
            eq(usageEvents.refunded, false)
          )
        )
        .groupBy(usageEvents.eventType);

      // Get current balance
      const [billing] = await db
        .select({ currentBalance: accountBilling.currentBalance })
        .from(accountBilling)
        .where(eq(accountBilling.accountId, accountId))
        .limit(1);

      const eventTypeLabels: Record<string, string> = {
        sms_sent: "SMS",
        email_sent: "Email",
        ai_call_minute: "AI Call Minutes",
        voice_call_minute: "Voice Call Minutes",
        llm_request: "LLM Requests",
        power_dialer_call: "Power Dialer Calls",
      };

      const breakdown = usageBreakdown.map((u) => ({
        category: eventTypeLabels[u.eventType] || u.eventType,
        eventType: u.eventType,
        events: u.totalEvents,
        quantity: parseFloat(u.totalQuantity || "0"),
        cost: `$${parseFloat(u.totalCost || "0").toFixed(2)}`,
      }));

      const totalSpend = usageBreakdown.reduce((sum, u) => sum + parseFloat(u.totalCost || "0"), 0);

      return {
        success: true,
        reportType: "usage",
        period: periodLabel,
        currentBalance: billing ? `$${parseFloat(billing.currentBalance).toFixed(2)}` : "$0.00",
        totalSpend: `$${totalSpend.toFixed(2)}`,
        breakdown,
        message: `Usage report for ${periodLabel}: Total spend $${totalSpend.toFixed(2)}, Current balance ${billing ? `$${parseFloat(billing.currentBalance).toFixed(2)}` : "$0.00"}.`,
      };
    }

    case "email_report": {
      const recipientEmails = args.recipientEmails as string[];
      const subject = args.subject as string;
      const reportHtml = args.reportHtml as string;
      const note = args.note as string | undefined;

      // Wrap with optional note at top
      let emailBody = reportHtml;
      if (note) {
        emailBody = `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <p style="margin:0;font-size:14px;color:#92400e;"><strong>Note:</strong> ${note}</p>
        </div>` + emailBody;
      }

      const results: { email: string; success: boolean; error?: string }[] = [];
      for (const email of recipientEmails) {
        try {
          const result = await sendEmail({
            to: email,
            subject,
            body: emailBody,
            // Use system sender (not billed to client)
          });
          results.push({ email, success: result.success, error: result.error });
        } catch (err: any) {
          results.push({ email, success: false, error: err.message });
        }
      }

      const allSuccess = results.every((r) => r.success);
      return {
        success: allSuccess,
        results,
        message: allSuccess
          ? `Report emailed to ${recipientEmails.join(", ")} successfully.`
          : `Some emails failed: ${results.filter((r) => !r.success).map((r) => `${r.email}: ${r.error}`).join("; ")}`,
      };
    }

    // ── Part D: Note action items + application link tools ──
    case "check_notes_for_action_items": {
      const lookbackDays = (args.lookbackDays as number) || 7;
      const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
      const { contactNotes, contacts } = await import("../../drizzle/schema");
      const db = await (await import("../db")).getDb();
      if (!db) return { error: "Database unavailable" };
      const recentNotes = await db
        .select({
          noteId: contactNotes.id,
          contactId: contactNotes.contactId,
          content: contactNotes.content,
          disposition: contactNotes.disposition,
          isInternal: contactNotes.isInternal,
          createdAt: contactNotes.createdAt,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
        })
        .from(contactNotes)
        .innerJoin(contacts, eq(contacts.id, contactNotes.contactId))
        .where(
          and(
            eq(contacts.accountId, accountId),
            eq(contactNotes.isInternal, false),
            gte(contactNotes.createdAt, cutoff)
          )
        )
        .orderBy(desc(contactNotes.createdAt))
        .limit(200);

      // Identify actionable phrases
      const ACTION_PATTERNS = [
        { pattern: /send.*app(lication)?.*link/i, action: "send_application_link" },
        { pattern: /follow.?up/i, action: "follow_up" },
        { pattern: /credit.?repair/i, action: "credit_repair_referral" },
        { pattern: /call.?back|callback/i, action: "schedule_callback" },
        { pattern: /needs?.?(loan|mortgage)/i, action: "send_application_link" },
      ];

      const actionItems = recentNotes
        .filter(n => {
          const text = (n.content || "").toLowerCase();
          return ACTION_PATTERNS.some(p => p.pattern.test(text)) ||
            n.disposition === "spoke_needs_loan_app_link" ||
            n.disposition === "borrower_requested_callback" ||
            n.disposition === "credit_repair";
        })
        .map(n => {
          const matchedPattern = ACTION_PATTERNS.find(p => p.pattern.test(n.content || ""));
          let suggestedAction = matchedPattern?.action || "review";
          if (n.disposition === "spoke_needs_loan_app_link") suggestedAction = "send_application_link";
          if (n.disposition === "borrower_requested_callback") suggestedAction = "schedule_callback";
          if (n.disposition === "credit_repair") suggestedAction = "credit_repair_referral";
          return {
            noteId: n.noteId,
            contactId: n.contactId,
            contactName: `${n.firstName || ""} ${n.lastName || ""}`.trim(),
            notePreview: (n.content || "").substring(0, 150),
            disposition: n.disposition,
            suggestedAction,
            createdAt: n.createdAt,
          };
        });

      return {
        totalNotesScanned: recentNotes.length,
        actionItemsFound: actionItems.length,
        actionItems: actionItems.slice(0, 20),
      };
    }

    case "send_application_link": {
      const contact = await getContactById(args.contactId as number, accountId);
      if (!contact) return { error: "Contact not found" };

      // Get account for application URL (use website or a default)
      const account = await getAccountById(accountId);
      const appUrl = account?.website
        ? `${account.website}/apply`
        : "https://apply.pmrloans.com";

      const contactName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "there";
      const messageBody = `Hi ${contactName}, here is your loan application link: ${appUrl} — Let us know if you have any questions!`;

      const channel = (args.channel as string) || (contact.phone ? "sms" : "email");

      if (channel === "sms") {
        if (!contact.phone) return { error: "Contact has no phone number. Try email channel." };
        const smsResult = await billedDispatchSMS({
          accountId,
          to: contact.phone,
          body: messageBody,
          contactId: contact.id,
          userId,
        });
        await createMessage({
          accountId,
          contactId: contact.id,
          userId,
          type: "sms",
          direction: "outbound",
          status: smsResult.success ? "sent" : "failed",
          body: messageBody,
          toAddress: contact.phone,
          errorMessage: smsResult.error || undefined,
        });
        logContactActivity({
          contactId: contact.id, accountId,
          activityType: "message_sent",
          description: "Application link sent via SMS by Jarvis",
        });
        return { success: smsResult.success, channel: "sms", error: smsResult.error };
      } else {
        if (!contact.email) return { error: "Contact has no email. Try sms channel." };
        const emailResult = await billedDispatchEmail({
          accountId,
          to: contact.email,
          subject: "Your Loan Application Link",
          body: messageBody,
          contactId: contact.id,
          userId,
        });
        await createMessage({
          accountId,
          contactId: contact.id,
          userId,
          type: "email",
          direction: "outbound",
          status: emailResult.success ? "sent" : "failed",
          subject: "Your Loan Application Link",
          body: messageBody,
          toAddress: contact.email,
          errorMessage: emailResult.error || undefined,
        });
        logContactActivity({
          contactId: contact.id, accountId,
          activityType: "message_sent",
          description: "Application link sent via email by Jarvis",
        });
        return { success: emailResult.success, channel: "email", error: emailResult.error };
      }
    }

    case "list_pending_tasks": {
      const { jarvisTaskQueue, contacts: contactsTable } = await import("../../drizzle/schema");
      const db = await (await import("../db")).getDb();
      if (!db) return { error: "Database unavailable" };
      const tasks = await db
        .select({
          id: jarvisTaskQueue.id,
          contactId: jarvisTaskQueue.contactId,
          taskType: jarvisTaskQueue.taskType,
          status: jarvisTaskQueue.status,
          payload: jarvisTaskQueue.payload,
          createdAt: jarvisTaskQueue.createdAt,
          contactFirstName: contactsTable.firstName,
          contactLastName: contactsTable.lastName,
        })
        .from(jarvisTaskQueue)
        .leftJoin(contactsTable, eq(contactsTable.id, jarvisTaskQueue.contactId))
        .where(
          and(
            eq(jarvisTaskQueue.accountId, accountId),
            eq(jarvisTaskQueue.status, "pending")
          )
        )
        .orderBy(desc(jarvisTaskQueue.createdAt))
        .limit(20);

      return {
        pendingCount: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          contactId: t.contactId,
          contactName: `${t.contactFirstName || ""} ${t.contactLastName || ""}`.trim(),
          taskType: t.taskType,
          payload: t.payload ? JSON.parse(t.payload) : null,
          createdAt: t.createdAt,
        })),
      };
    }

    case "complete_task": {
      const { jarvisTaskQueue } = await import("../../drizzle/schema");
      const db = await (await import("../db")).getDb();
      if (!db) return { error: "Database unavailable" };
      const [task] = await db
        .select()
        .from(jarvisTaskQueue)
        .where(
          and(
            eq(jarvisTaskQueue.id, args.taskId as number),
            eq(jarvisTaskQueue.accountId, accountId)
          )
        )
        .limit(1);
      if (!task) return { error: "Task not found" };
      if (task.status !== "pending") return { error: `Task already ${task.status}` };
      await db
        .update(jarvisTaskQueue)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(jarvisTaskQueue.id, task.id));
      return { success: true, taskId: task.id, taskType: task.taskType };
    }

    case "bulk_add_contact_notes": {
      const contactIds = args.contactIds as number[];
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return { error: "contactIds must be a non-empty array" };
      }
      if (contactIds.length > 500) {
        return { error: "Maximum 500 contacts per bulk call" };
      }
      const content = args.content as string;
      const disposition = args.disposition as string | undefined;
      const isInternal = args.isInternal as boolean | undefined;
      let created = 0;
      const failedContactIds: number[] = [];

      // Process in parallel batches of 50 to avoid overwhelming the DB
      const BATCH_SIZE = 50;
      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batch = contactIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (contactId) => {
            await createContactNote({
              contactId,
              authorId: userId,
              content,
              ...(disposition ? { disposition } : {}),
              ...(isInternal ? { isInternal: true } : {}),
            });
            logContactActivity({
              contactId,
              accountId,
              activityType: "note_added",
              description: "Note added by Jarvis AI (bulk)",
            });
          })
        );
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === "fulfilled") {
            created++;
          } else {
            failedContactIds.push(batch[j]);
          }
        }
      }

      return {
        created,
        failed: failedContactIds.length,
        total: contactIds.length,
        failedContactIds,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
