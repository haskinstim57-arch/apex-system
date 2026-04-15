import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { vapiWebhookRouter } from "../webhooks/vapi";
import { facebookLeadsWebhookRouter } from "../webhooks/facebookLeads";
import { startWorkflowWorker } from "../services/workflowEngine";
import { startCampaignScheduler } from "../services/campaignScheduler";
import { startFacebookTokenRefreshJob } from "../services/facebookTokenRefresh";
import { startAppointmentReminders } from "../services/appointmentReminders";
import { startPortRequestPoller } from "../services/portRequestPoller";
import { startCalendarWatchRenewal } from "../services/calendarWatchRenewal";
import { googleCalendarWebhookRouter } from "../webhooks/googleCalendarWebhook";
import { outlookCalendarWebhookRouter } from "../webhooks/outlookCalendarWebhook";
import { calendarOAuthCallbackRouter } from "../webhooks/calendarOAuthCallbacks";
import { startFacebookLeadPoller } from "../services/facebookLeadPoller";
import { startFacebookTokenHealthMonitor } from "../services/facebookTokenHealthMonitor";
import { startDateTriggerCron } from "../services/dateTriggerCron";
import { inboundMessageRouter } from "../webhooks/inboundMessages";
import { twilioVoiceStatusRouter } from "../webhooks/twilioVoiceStatus";
import { applySecurityMiddleware } from "../middleware/security";
import { inboundApiRouter } from "../webhooks/inboundApi";
import { publicPagesRouter } from "../webhooks/publicPages";
import { webchatWebhookRouter } from "../webhooks/webchat";
import { webchatWidgetRouter } from "../webhooks/webchatWidget";
import { jarvisStreamRouter } from "../webhooks/jarvisStream";
import { squareWebhookRouter } from "../webhooks/square";
import { deliveryStatusRouter } from "../webhooks/deliveryStatus";
import { gmbOAuthCallbackRouter } from "../webhooks/gmbOAuthCallback";
import { startScheduledReportsCron } from "../services/scheduledReportsCron";
import { startMessageQueueWorker } from "../services/messageQueue";
import { startPushBatchWorker } from "../services/pushBatcher";
import { startJarvisTaskWorker } from "../services/jarvisTaskWorker";
import { startSequenceActivationWorker } from "../services/sequenceActivationWorker";
import { startMessageRetryWorker } from "../services/messageRetryWorker";
import { startRecurringContentWorker } from "../services/recurringContentWorker";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Apply security middleware (helmet, CORS, rate limiting)
  applySecurityMiddleware(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Public REST webhook for VAPI via n8n
  app.use(vapiWebhookRouter);
  // Public REST webhook for Facebook Lead Ads
  app.use(facebookLeadsWebhookRouter);
  // Calendar OAuth callbacks (Google & Outlook)
  app.use(calendarOAuthCallbackRouter);
  // Inbound message webhooks (Twilio SMS + SendGrid Email)
  app.use(inboundMessageRouter);
  // Twilio voice status callback (missed call text-back)
  app.use(twilioVoiceStatusRouter);
  // Calendar push notification webhooks (Google & Outlook)
  app.use(googleCalendarWebhookRouter);
  app.use(outlookCalendarWebhookRouter);
  // Inbound API endpoints (external services push data in via API key)
  app.use(inboundApiRouter);
  // Public webchat widget endpoints
  app.use(webchatWebhookRouter);
  // Embeddable webchat widget script
  app.use(webchatWidgetRouter);
  // Jarvis AI streaming endpoint
  app.use(jarvisStreamRouter);
  // Square payment webhook
  app.use(squareWebhookRouter);
  // Google My Business OAuth callback
  app.use(gmbOAuthCallbackRouter);
  // Delivery status webhooks (SendGrid + Twilio)
  app.use(deliveryStatusRouter);
  // Public landing page serving
  app.use(publicPagesRouter);
  // Build version endpoint — returns server start timestamp for frontend cache-busting
  const BUILD_TIMESTAMP = Date.now().toString();
  app.get("/api/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({ version: BUILD_TIMESTAMP });
  });

  // Internal import endpoint (localhost only, for one-time historical imports)
  app.post("/api/internal/import-lead", async (req, res) => {
    try {
      // Only allow from localhost
      const ip = req.ip || req.socket.remoteAddress || "";
      if (!ip.includes("127.0.0.1") && !ip.includes("::1") && !ip.includes("::ffff:127.0.0.1")) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { accountId, firstName, lastName, email, phone, leadSource, customFields, fbLeadId } = req.body;
      if (!accountId || !firstName || !fbLeadId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Dedup check
      const { getDb } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return res.json({ error: "DB not available" });

      const existing = await db.execute(
        sql`SELECT id FROM contacts WHERE accountId = ${accountId} AND customFields LIKE ${`%"fb_lead_id":"${fbLeadId}"%`} LIMIT 1`
      );
      const rows = existing[0] as unknown as any[];
      if (rows && rows.length > 0) {
        return res.json({ skipped: true, reason: "already exists" });
      }

      // Also check by email for additional dedup
      if (email) {
        const emailCheck = await db.execute(
          sql`SELECT id FROM contacts WHERE accountId = ${accountId} AND email = ${email} LIMIT 1`
        );
        const emailRows = emailCheck[0] as unknown as any[];
        if (emailRows && emailRows.length > 0) {
          return res.json({ skipped: true, reason: "email exists" });
        }
      }

      // Create contact
      const { createContact, getOrCreateDefaultPipeline, listPipelineStages, createDeal, createNotification } = await import("../db");
      const { routeLead } = await import("../services/leadRoutingEngine");

      const { id: contactId } = await createContact({
        accountId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        leadSource: leadSource || "facebook",
        status: "new",
        customFields: JSON.stringify(customFields || {}),
      });

      // Create deal
      try {
        const pipeline = await getOrCreateDefaultPipeline(accountId);
        const stages = await listPipelineStages(pipeline.id, accountId);
        const newLeadStage = stages.find((s: any) => s.name === "New Lead");
        if (newLeadStage) {
          await createDeal({
            accountId,
            pipelineId: pipeline.id,
            stageId: newLeadStage.id,
            contactId,
            title: `${firstName} ${lastName}`,
          });
        }
      } catch {}

      // Route lead (async, don't wait)
      routeLead({
        contactId,
        accountId,
        leadSource: leadSource || "facebook",
        source: "facebook_lead",
      }).catch(() => {});

      return res.json({ created: true, contactId });
    } catch (err: any) {
      console.error("[Import] Error:", err.message);
      return res.json({ error: err.message });
    }
  });

  // Internal setup-outbound endpoint (localhost only, for one-time outbound sales engine setup)
  app.post("/api/internal/setup-outbound", async (req, res) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "";
      if (!ip.includes("127.0.0.1") && !ip.includes("::1") && !ip.includes("::ffff:127.0.0.1")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { action } = req.body;
      const { getDb } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return res.json({ error: "DB not available" });

      // ─── ACTION: import_contact ───
      if (action === "import_contact") {
        const { accountId, userId, firstName, lastName, email, phone, company, city, state, website, leadSource, tags, notes } = req.body;
        if (!accountId || !firstName) return res.status(400).json({ error: "Missing required fields" });

        // Dedup by email
        if (email) {
          const emailCheck = await db.execute(sql`SELECT id FROM contacts WHERE accountId = ${accountId} AND email = ${email} LIMIT 1`);
          const emailRows = emailCheck[0] as unknown as any[];
          if (emailRows && emailRows.length > 0) return res.json({ skipped: true, reason: "email exists" });
        }
        // Dedup by phone
        if (phone) {
          const phoneCheck = await db.execute(sql`SELECT id FROM contacts WHERE accountId = ${accountId} AND phone = ${phone} LIMIT 1`);
          const phoneRows = phoneCheck[0] as unknown as any[];
          if (phoneRows && phoneRows.length > 0) return res.json({ skipped: true, reason: "phone exists" });
        }

        const { createContact, addContactTag, createContactNote, logContactActivity, getOrCreateDefaultPipeline, listPipelineStages, createDeal } = await import("../db");
        const { routeLead } = await import("../services/leadRoutingEngine");

        const { id: contactId } = await createContact({
          accountId,
          firstName,
          lastName: lastName || "",
          email: email || null,
          phone: phone || null,
          company: company || null,
          city: city || null,
          state: state || null,
          leadSource: leadSource || "csv_import",
          status: "new" as const,
        });

        // Add tags
        if (tags) {
          const tagList = tags.split(",").map((t: string) => t.trim()).filter(Boolean);
          for (const tag of tagList) {
            await addContactTag(contactId, tag);
          }
        }

        // Add notes
        if (notes && userId) {
          await createContactNote({ contactId, authorId: userId, content: notes });
        }

        // Log activity
        logContactActivity({
          contactId,
          accountId,
          activityType: "contact_created",
          description: `Contact ${firstName} ${lastName} imported via CSV`,
        });

        // Create deal in pipeline
        try {
          const pipeline = await getOrCreateDefaultPipeline(accountId);
          const stages = await listPipelineStages(pipeline.id, accountId);
          const newLeadStage = stages.find((s: any) => s.name === "New Lead") || stages[0];
          if (newLeadStage) {
            await createDeal({ accountId, pipelineId: pipeline.id, stageId: newLeadStage.id, contactId, title: `${firstName} ${lastName}` });
          }
        } catch {}

        // Route lead
        routeLead({ contactId, accountId, leadSource: leadSource || "csv_import", source: "csv_import" }).catch(() => {});

        return res.json({ created: true, contactId });
      }

      // ─── ACTION: create_email_campaign ───
      if (action === "create_email_campaign") {
        const { accountId, userId, campaignName, fromAddress, steps } = req.body;
        const { createCampaign } = await import("../db");

        const campaignIds = [];
        for (const step of steps) {
          const { id } = await createCampaign({
            accountId,
            name: `${campaignName} (Step ${step.stepNum}: Day ${step.dayOffset})`,
            type: "email" as const,
            status: "draft" as const,
            subject: step.subject,
            body: step.body,
            fromAddress: fromAddress || null,
            createdById: userId,
          });
          campaignIds.push(id);
          console.log(`[Setup] Created email campaign step ${step.stepNum}: ID ${id}`);
        }
        return res.json({ success: true, campaignIds });
      }

      // ─── ACTION: create_sms_campaign ───
      if (action === "create_sms_campaign") {
        const { accountId, userId, campaignName, steps } = req.body;
        const { createCampaign } = await import("../db");

        const campaignIds = [];
        for (const step of steps) {
          const { id } = await createCampaign({
            accountId,
            name: `${campaignName} (Step ${step.stepNum}: Day ${step.dayOffset})`,
            type: "sms" as const,
            status: "draft" as const,
            subject: null,
            body: step.body,
            fromAddress: null,
            createdById: userId,
          });
          campaignIds.push(id);
          console.log(`[Setup] Created SMS campaign step ${step.stepNum}: ID ${id}`);
        }
        return res.json({ success: true, campaignIds });
      }

      // ─── ACTION: create_dialer_script ───
      if (action === "create_dialer_script") {
        const { accountId, userId, name, content } = req.body;
        const { createDialerScript } = await import("../db");

        const { id } = await createDialerScript({
          accountId,
          name,
          content,
          isActive: true,
          createdById: userId,
        });
        console.log(`[Setup] Created dialer script: ID ${id}`);
        return res.json({ success: true, scriptId: id });
      }

      // ─── ACTION: create_workflow ───
      if (action === "create_workflow") {
        const { accountId, userId, name, description, triggerType, triggerConfig, isActive, steps: wfSteps } = req.body;
        const { createWorkflow, createWorkflowStep } = await import("../db");
        const { id: workflowId } = await createWorkflow({
          accountId,
          name,
          description: description || null,
          triggerType,
          triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null,
          isActive: isActive ?? true,
          createdById: userId,
        });
        const stepIds = [];
        for (const step of wfSteps) {
          const { id: stepId } = await createWorkflowStep({
            workflowId,
            stepOrder: step.stepOrder,
            stepType: step.stepType,
            actionType: step.actionType || null,
            config: step.config ? JSON.stringify(step.config) : null,
            delayType: step.delayType || null,
            delayValue: step.delayValue || null,
          });
          stepIds.push(stepId);
        }
        console.log(`[Setup] Created workflow "${name}" (ID ${workflowId}) with ${stepIds.length} steps`);
        return res.json({ success: true, workflowId, stepIds });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
      console.error("[Setup] Error:", err.message);
      return res.json({ error: err.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the workflow execution engine background worker
    startWorkflowWorker();
    // Start the campaign scheduler background worker (runs every 60s)
    startCampaignScheduler();
    // Start the Facebook token refresh job (runs daily, alerts on expiring tokens)
    startFacebookTokenRefreshJob();

    // Start appointment reminders job (checks every 5 min for 24h and 1h reminders)
    startAppointmentReminders();

    // Start port request poller (checks every 5 min for completed number ports)
    startPortRequestPoller();

    // Start calendar watch renewal job (checks every 6h for expiring watches/subscriptions)
    startCalendarWatchRenewal();

    // Start Facebook lead polling fallback (every 60s, catches leads when webhooks fail)
    startFacebookLeadPoller();

    // Start Facebook token health monitor (daily check on all page tokens)
    startFacebookTokenHealthMonitor();

    // Start date trigger cron job (runs daily, scans contacts against date_trigger workflows)
    startDateTriggerCron();

    // Start scheduled reports cron (runs every 5 min, sends due analytics reports)
    startScheduledReportsCron();

    // Start message queue worker (checks every 30s, dispatches queued messages when business hours open)
    startMessageQueueWorker();

    // Start push notification batch flush worker (checks every 15s, groups rapid-fire events)
    startPushBatchWorker();

    // Start Jarvis scheduled task worker (checks every 60s, executes due recurring tasks)
    startJarvisTaskWorker();

    // Start sequence activation worker (checks every 5 min, activates due draft sequences)
    startSequenceActivationWorker();

    // Start message retry worker (checks every 15 min, retries failed messages with transient errors)
    startMessageRetryWorker();

    // Start recurring content worker (checks every 1 hour, generates content for due plans)
    startRecurringContentWorker();
  });
}

startServer().catch(console.error);
