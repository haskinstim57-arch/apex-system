import Twilio from "twilio";
import {
  getActivePortRequests,
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
  updatePortRequest,
  createNotification,
} from "../db";

// ─────────────────────────────────────────────
// Port Request Poller
// Runs every 5 minutes, checks active port requests
// against Twilio to see if the number is now available.
// When a ported number becomes active, it auto-assigns
// it to the account and configures webhooks.
// ─────────────────────────────────────────────

const POLLER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let pollerTimer: ReturnType<typeof setInterval> | null = null;

/** Start the port request poller background worker */
export function startPortRequestPoller() {
  if (pollerTimer) return;
  console.log("[PortRequestPoller] Starting background worker (5min interval)");
  pollerTimer = setInterval(async () => {
    try {
      await processActivePortRequests();
    } catch (err) {
      console.error("[PortRequestPoller] Worker error:", err);
    }
  }, POLLER_INTERVAL_MS);
  // Run once after a short delay to let the server fully start
  setTimeout(() => {
    processActivePortRequests().catch((err) =>
      console.error("[PortRequestPoller] Initial run error:", err)
    );
  }, 30_000); // 30s delay
}

/** Stop the port request poller */
export function stopPortRequestPoller() {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
    console.log("[PortRequestPoller] Stopped");
  }
}

/**
 * Get a Twilio client using per-account or global credentials.
 */
async function getTwilioClientForAccount(accountId: number) {
  const settings = await getAccountMessagingSettings(accountId);
  if (settings?.twilioAccountSid && settings?.twilioAuthToken) {
    return Twilio(settings.twilioAccountSid, settings.twilioAuthToken);
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return Twilio(sid, token);
}

/**
 * Build the app URL from environment.
 * Falls back to VITE_APP_URL if available.
 */
function getAppUrl(): string | null {
  return process.env.VITE_APP_URL || process.env.APP_URL || null;
}

/**
 * Process all active port requests.
 * For each request, check if the number is now in the Twilio account's
 * incoming phone numbers list. If it is, the port is complete.
 */
export async function processActivePortRequests() {
  let requests;
  try {
    requests = await getActivePortRequests();
  } catch (err) {
    console.error("[PortRequestPoller] Failed to fetch active port requests:", err);
    return;
  }

  if (!requests || requests.length === 0) return;

  console.log(
    `[PortRequestPoller] Checking ${requests.length} active port request(s)`
  );

  for (const request of requests) {
    try {
      await checkPortRequestStatus(request);
    } catch (err) {
      console.error(
        `[PortRequestPoller] Error checking port request #${request.id}:`,
        err
      );
    }
  }
}

/**
 * Check a single port request against Twilio.
 * If the number appears in the account's incoming phone numbers, the port is complete.
 * If the request is older than 45 days and still not complete, mark it as failed.
 */
async function checkPortRequestStatus(request: {
  id: number;
  accountId: number;
  phoneNumber: string;
  status: string;
  portingSid: string | null;
  createdAt: Date;
}) {
  const client = await getTwilioClientForAccount(request.accountId);
  if (!client) {
    console.warn(
      `[PortRequestPoller] No Twilio credentials for account ${request.accountId}, skipping port request #${request.id}`
    );
    return;
  }

  // Check if the account already has a number assigned (someone may have purchased one manually)
  const currentSettings = await getAccountMessagingSettings(request.accountId);
  if (currentSettings?.twilioFromNumber) {
    // Account already has a number — mark port as cancelled
    await updatePortRequest(request.id, request.accountId, {
      status: "cancelled",
      notes: "Port request cancelled — account already has a phone number assigned.",
    });
    await createNotification({
      accountId: request.accountId,
      userId: null,
      type: "workflow_failed",
      title: "Port Request Cancelled",
      body: `Port request for ${request.phoneNumber} was cancelled because a phone number is already assigned to this account.`,
      link: "/settings",
    });
    console.log(
      `[PortRequestPoller] Port request #${request.id} cancelled — account ${request.accountId} already has a number`
    );
    return;
  }

  try {
    // Search for the ported number in the account's incoming phone numbers
    const incomingNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: request.phoneNumber,
      limit: 1,
    });

    if (incomingNumbers.length > 0) {
      // Number found — port is complete!
      const number = incomingNumbers[0];
      await handlePortCompleted(request, number);
    } else {
      // Number not yet in account — check if request is too old
      await checkPortTimeout(request);
    }
  } catch (err: any) {
    console.error(
      `[PortRequestPoller] Twilio API error for port request #${request.id}:`,
      err?.message || err
    );

    // If it's a 404 or auth error, don't mark as failed — could be transient
    if (err?.status === 401 || err?.status === 403) {
      console.warn(
        `[PortRequestPoller] Auth issue for account ${request.accountId} — skipping`
      );
    }
  }
}

/**
 * Handle a completed port: assign the number to the account,
 * configure webhooks, update the port request, and notify the user.
 */
async function handlePortCompleted(
  request: { id: number; accountId: number; phoneNumber: string },
  twilioNumber: { sid: string; phoneNumber: string }
) {
  const appUrl = getAppUrl();

  // Configure webhooks if we have an app URL
  if (appUrl) {
    try {
      const client = await getTwilioClientForAccount(request.accountId);
      if (client) {
        const baseUrl = appUrl.replace(/\/$/, "");
        await client.incomingPhoneNumbers(twilioNumber.sid).update({
          smsUrl: `${baseUrl}/api/webhooks/twilio/inbound`,
          smsMethod: "POST",
          statusCallback: `${baseUrl}/api/webhooks/twilio/voice-status`,
          statusCallbackMethod: "POST",
        });
        console.log(
          `[PortRequestPoller] Configured webhooks for ${twilioNumber.phoneNumber}`
        );
      }
    } catch (err: any) {
      console.error(
        `[PortRequestPoller] Failed to configure webhooks for ${twilioNumber.phoneNumber}:`,
        err?.message || err
      );
      // Continue anyway — the number is still assigned
    }
  }

  // Assign the number to the account
  await upsertAccountMessagingSettings(request.accountId, {
    twilioFromNumber: twilioNumber.phoneNumber,
    twilioPhoneSid: twilioNumber.sid,
  });

  // Update the port request status
  await updatePortRequest(request.id, request.accountId, {
    status: "completed",
    portingSid: twilioNumber.sid,
    notes: `Port completed successfully. Number ${twilioNumber.phoneNumber} is now active and assigned to this account.`,
  });

  // Notify the account
  await createNotification({
    accountId: request.accountId,
    userId: null,
    type: "appointment_booked",
    title: "Phone Number Ported Successfully",
    body: `Your number ${twilioNumber.phoneNumber} has been ported successfully and is now active. It has been automatically assigned to your account for SMS and voice.`,
    link: "/settings",
  });

  console.log(
    `[PortRequestPoller] ✓ Port request #${request.id} completed — ${twilioNumber.phoneNumber} assigned to account ${request.accountId}`
  );
}

/**
 * Check if a port request has exceeded the timeout period (45 days).
 * If so, mark it as failed and notify the user.
 */
async function checkPortTimeout(request: {
  id: number;
  accountId: number;
  phoneNumber: string;
  status: string;
  createdAt: Date;
}) {
  const MAX_PORT_AGE_MS = 45 * 24 * 60 * 60 * 1000; // 45 days
  const age = Date.now() - new Date(request.createdAt).getTime();

  if (age > MAX_PORT_AGE_MS) {
    await updatePortRequest(request.id, request.accountId, {
      status: "failed",
      notes:
        "Port request timed out after 45 days. The number may not be eligible for porting, or the carrier may have rejected the request. Please contact support for assistance.",
    });

    await createNotification({
      accountId: request.accountId,
      userId: null,
      type: "workflow_failed",
      title: "Port Request Failed",
      body: `Your port request for ${request.phoneNumber} has timed out after 45 days. Please contact support or submit a new request.`,
      link: "/settings",
    });

    console.log(
      `[PortRequestPoller] Port request #${request.id} timed out (${Math.round(age / (24 * 60 * 60 * 1000))} days old)`
    );
  } else if (request.status === "submitted") {
    // Auto-advance from "submitted" to "in_progress" after the first check
    await updatePortRequest(request.id, request.accountId, {
      status: "in_progress",
      notes:
        "Port request is being processed. This typically takes 1-4 weeks depending on the carrier.",
    });
    console.log(
      `[PortRequestPoller] Port request #${request.id} advanced to in_progress`
    );
  }
}
