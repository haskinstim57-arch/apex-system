import { listExpiringIntegrations, getAccountById, getUserById } from "../db";
import { dispatchEmail } from "./messaging";

// ─────────────────────────────────────────────
// Facebook Token Refresh Job
// Runs daily, checks all active Facebook integrations
// where tokenExpiresAt is within 7 days, and sends
// an email alert to the account owner to renew.
// ─────────────────────────────────────────────

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const EXPIRY_WARNING_DAYS = 7;

let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Start the Facebook token refresh background job */
export function startFacebookTokenRefreshJob() {
  if (refreshTimer) return;
  console.log(
    `[FacebookTokenRefresh] Starting background job (${CHECK_INTERVAL_MS / 1000}s interval, warns ${EXPIRY_WARNING_DAYS} days before expiry)`
  );
  refreshTimer = setInterval(async () => {
    try {
      await checkExpiringTokens();
    } catch (err) {
      console.error("[FacebookTokenRefresh] Worker error:", err);
    }
  }, CHECK_INTERVAL_MS);

  // Run once on startup (delayed 30s to let DB connect)
  setTimeout(() => {
    checkExpiringTokens().catch((err) =>
      console.error("[FacebookTokenRefresh] Initial run error:", err)
    );
  }, 30_000);
}

/** Stop the Facebook token refresh background job */
export function stopFacebookTokenRefreshJob() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log("[FacebookTokenRefresh] Stopped background job");
  }
}

/**
 * Check for integrations with tokens expiring within EXPIRY_WARNING_DAYS
 * and send email alerts to account owners.
 */
export async function checkExpiringTokens() {
  const expiring = await listExpiringIntegrations(EXPIRY_WARNING_DAYS);

  if (expiring.length === 0) {
    console.log("[FacebookTokenRefresh] No expiring tokens found");
    return { alerted: 0 };
  }

  console.log(
    `[FacebookTokenRefresh] Found ${expiring.length} integration(s) with tokens expiring within ${EXPIRY_WARNING_DAYS} days`
  );

  let alertsSent = 0;

  for (const integration of expiring) {
    try {
      // Get the account to find the owner
      const account = await getAccountById(integration.accountId);
      if (!account) {
        console.warn(
          `[FacebookTokenRefresh] Account ${integration.accountId} not found, skipping`
        );
        continue;
      }

      // Get the account owner's email
      let ownerEmail: string | null = null;
      let ownerName = "Account Owner";

      if (account.ownerId) {
        const owner = await getUserById(account.ownerId);
        if (owner?.email) {
          ownerEmail = owner.email;
          ownerName = owner.name || "Account Owner";
        }
      }

      // Fall back to account email
      if (!ownerEmail && account.email) {
        ownerEmail = account.email;
      }

      if (!ownerEmail) {
        console.warn(
          `[FacebookTokenRefresh] No email found for account ${integration.accountId} (${account.name}), skipping`
        );
        continue;
      }

      const expiresAt = integration.tokenExpiresAt
        ? new Date(integration.tokenExpiresAt)
        : null;
      const daysLeft = expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : 0;

      const expiryDateStr = expiresAt
        ? expiresAt.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "soon";

      const subject = `⚠️ Your Facebook Connection Expires ${daysLeft <= 1 ? "Today" : `in ${daysLeft} Days`}`;

      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a2e;">Facebook Connection Renewal Required</h2>
          <p>Hi ${ownerName},</p>
          <p>Your Facebook integration for <strong>${account.name || "your account"}</strong> will expire on <strong>${expiryDateStr}</strong>.</p>
          <p>To continue receiving leads from your Facebook Lead Ads and maintain your automation workflows, please reconnect your Facebook account.</p>
          <div style="margin: 24px 0;">
            <p><strong>How to renew:</strong></p>
            <ol>
              <li>Log in to your Sterling Marketing dashboard</li>
              <li>Go to <strong>Settings → Integrations</strong></li>
              <li>Click <strong>"Disconnect"</strong> on your current Facebook connection</li>
              <li>Click <strong>"Connect Facebook"</strong> to re-authorize</li>
            </ol>
          </div>
          <p style="color: #666; font-size: 14px;">If you don't renew before ${expiryDateStr}, your Facebook lead capture will stop working until you reconnect.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">This is an automated message from Sterling Marketing. If you have questions, contact your administrator.</p>
        </div>
      `;

      const result = await dispatchEmail({
        to: ownerEmail,
        subject,
        body,
        accountId: integration.accountId,
      });

      if (result.success) {
        alertsSent++;
        console.log(
          `[FacebookTokenRefresh] Alert sent to ${ownerEmail} for account ${integration.accountId} (expires in ${daysLeft} days)`
        );
      } else {
        console.warn(
          `[FacebookTokenRefresh] Failed to send alert to ${ownerEmail}:`,
          result.error
        );
      }
    } catch (err) {
      console.error(
        `[FacebookTokenRefresh] Error processing integration ${integration.id}:`,
        err
      );
    }
  }

  console.log(
    `[FacebookTokenRefresh] Sent ${alertsSent} alert(s) out of ${expiring.length} expiring integration(s)`
  );

  return { alerted: alertsSent };
}
