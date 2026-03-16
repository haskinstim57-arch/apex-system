import {
  listScheduledCampaignsReady,
  getCampaign,
  updateCampaign,
  listCampaignRecipients,
  updateCampaignRecipientStatus,
  getCampaignRecipientStats,
} from "../db";
import { dispatchSMS, dispatchEmail } from "./messaging";

// ─────────────────────────────────────────────
// Campaign Scheduler Background Worker
// Runs every 60 seconds, finds campaigns where
// scheduledAt <= now and status = "scheduled",
// then sends all pending recipients.
// ─────────────────────────────────────────────

const SCHEDULER_INTERVAL_MS = 60_000; // 1 minute
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

/** Start the campaign scheduler background worker */
export function startCampaignScheduler() {
  if (schedulerTimer) return;
  console.log("[CampaignScheduler] Starting background worker (60s interval)");
  schedulerTimer = setInterval(async () => {
    try {
      await processScheduledCampaigns();
    } catch (err) {
      console.error("[CampaignScheduler] Worker error:", err);
    }
  }, SCHEDULER_INTERVAL_MS);
  // Run once immediately
  processScheduledCampaigns().catch((err) =>
    console.error("[CampaignScheduler] Initial run error:", err)
  );
}

/** Stop the campaign scheduler background worker */
export function stopCampaignScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[CampaignScheduler] Stopped background worker");
  }
}

/** Merge template variables into body text */
function mergeTemplateVars(
  body: string,
  contact: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
  }
): string {
  return body
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{phone\}\}/g, contact.phone || "")
    .replace(/\{\{company\}\}/g, contact.company || "");
}

/** Process all campaigns that are scheduled and ready to send */
async function processScheduledCampaigns() {
  const campaigns = await listScheduledCampaignsReady();
  if (campaigns.length === 0) return;

  console.log(
    `[CampaignScheduler] Found ${campaigns.length} campaign(s) ready to send`
  );

  for (const campaign of campaigns) {
    try {
      await sendCampaign(campaign.id, campaign.accountId);
    } catch (err) {
      console.error(
        `[CampaignScheduler] Error sending campaign ${campaign.id}:`,
        err
      );
      // Mark as failed but don't crash the worker
      await updateCampaign(campaign.id, campaign.accountId, {
        status: "paused",
      }).catch(() => {});
    }
  }
}

/** Send a single campaign to all its pending recipients */
async function sendCampaign(campaignId: number, accountId: number) {
  const campaign = await getCampaign(campaignId, accountId);
  if (!campaign) {
    console.warn(`[CampaignScheduler] Campaign ${campaignId} not found`);
    return;
  }

  // Only process scheduled campaigns
  if (campaign.status !== "scheduled") {
    console.warn(
      `[CampaignScheduler] Campaign ${campaignId} status is "${campaign.status}", skipping`
    );
    return;
  }

  // Mark as sending
  await updateCampaign(campaignId, accountId, {
    status: "sending",
    sentAt: new Date(),
  });

  console.log(
    `[CampaignScheduler] Sending campaign ${campaignId}: "${campaign.name}" (${campaign.type})`
  );

  // Get all pending recipients
  const { data: recipients } = await listCampaignRecipients(campaignId, {
    status: "pending",
    limit: 10000,
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    const mergedBody = mergeTemplateVars(campaign.body, {
      firstName: recipient.contactFirstName || undefined,
      lastName: recipient.contactLastName || undefined,
      email: recipient.contactEmail || undefined,
      phone: recipient.contactPhone || undefined,
    });

    try {
      let result;
      if (campaign.type === "email") {
        result = await dispatchEmail({
          to: recipient.toAddress,
          subject: campaign.subject || campaign.name,
          body: mergedBody,
          from: campaign.fromAddress || undefined,
        });
      } else {
        result = await dispatchSMS({
          to: recipient.toAddress,
          body: mergedBody,
          from: campaign.fromAddress || undefined,
        });
      }

      if (result.success) {
        sentCount++;
        await updateCampaignRecipientStatus(recipient.id, "sent", {
          sentAt: new Date(),
        });
      } else {
        failedCount++;
        await updateCampaignRecipientStatus(recipient.id, "failed", {
          errorMessage: result.error,
        });
      }
    } catch (err: any) {
      failedCount++;
      await updateCampaignRecipientStatus(recipient.id, "failed", {
        errorMessage: err?.message || String(err),
      });
    }
  }

  // Mark campaign as sent
  await updateCampaign(campaignId, accountId, {
    status: "sent",
    completedAt: new Date(),
    sentCount,
    failedCount,
    totalRecipients: recipients.length,
  });

  console.log(
    `[CampaignScheduler] Campaign ${campaignId} complete: ${sentCount} sent, ${failedCount} failed out of ${recipients.length}`
  );
}
