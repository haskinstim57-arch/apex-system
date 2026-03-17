/**
 * Test script: sends a real email through the SendGrid service
 * to verify the full invitation email flow works end-to-end.
 * 
 * Usage: node scripts/test-sendgrid-send.mjs
 */
import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@apexsystem.io";
const fromName = process.env.SENDGRID_FROM_NAME || "Apex Systems";
const testRecipient = "tariqhaskins@indigolabsai.com"; // dev notifications go here

console.log("=== SendGrid Diagnostic Test ===");
console.log(`API Key present: ${!!apiKey}`);
console.log(`API Key prefix: ${apiKey ? apiKey.substring(0, 10) + "..." : "N/A"}`);
console.log(`From Email: ${fromEmail}`);
console.log(`From Name: ${fromName}`);
console.log(`To: ${testRecipient}`);
console.log("");

if (!apiKey) {
  console.error("[FAIL] SENDGRID_API_KEY is not set. Cannot send.");
  process.exit(1);
}

sgMail.setApiKey(apiKey);

const msg = {
  to: testRecipient,
  from: {
    email: fromEmail,
    name: fromName,
  },
  subject: "[Apex System] Email Diagnostic Test",
  text: "This is a diagnostic test email from Apex System to verify SendGrid delivery is working correctly.",
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #d4a843;">Apex System - Email Diagnostic Test</h2>
      <p>This is a diagnostic test email to verify SendGrid delivery is working correctly.</p>
      <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      <p><strong>From:</strong> ${fromEmail} (${fromName})</p>
      <p><strong>API Key prefix:</strong> ${apiKey.substring(0, 10)}...</p>
      <hr style="border: 1px solid #333;">
      <p style="color: #888; font-size: 12px;">If you received this email, SendGrid delivery is working.</p>
    </div>
  `,
};

console.log("[SENDGRID] Calling sgMail.send()...");

try {
  const [response] = await sgMail.send(msg);
  const messageId = response?.headers?.["x-message-id"] || "unknown";
  console.log("");
  console.log("=== RESULT: SUCCESS ===");
  console.log(`Status Code: ${response?.statusCode}`);
  console.log(`Message ID: ${messageId}`);
  console.log(`Email sent to: ${testRecipient}`);
  console.log("");
  console.log("Check the recipient's inbox (and spam folder) for the test email.");
} catch (err) {
  console.error("");
  console.error("=== RESULT: FAILED ===");
  console.error(`Error message: ${err?.message}`);
  console.error(`Status code: ${err?.code}`);
  console.error(`Response body: ${JSON.stringify(err?.response?.body || "N/A", null, 2)}`);
  process.exit(1);
}
