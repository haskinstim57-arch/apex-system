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
import { inboundMessageRouter } from "../webhooks/inboundMessages";
import { twilioVoiceStatusRouter } from "../webhooks/twilioVoiceStatus";
import { applySecurityMiddleware } from "../middleware/security";

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
  });
}

startServer().catch(console.error);
