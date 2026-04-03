/**
 * Send FTHB test email + SMS from Premier Mortgage Resources account (420001)
 * Email: Step 1 (Day 1) → timyourloanofficer@gmail.com
 * SMS:   Step 1 (Day 0) → +16619927005
 */

// Load env
import { config } from "dotenv";
config();

// We need to use the platform's messaging service directly
// Import the dispatch functions after registering ts-node
import { register } from "tsx/esm/api";
const unreg = register();

const { dispatchEmail } = await import("../server/services/messaging.js");
const { dispatchSMS } = await import("../server/services/messaging.js");

// ─── FTHB Email Step 1 content ───
const emailSubject = "Your First Home: Where to start";
const emailBody = `Hi Tim,

Congratulations on taking the first step toward buying your first home! I'm Tim Haskins with Premier Mortgage Resources, and my team specializes in helping first-time buyers navigate the market without the stress.

The biggest myth in real estate is that you need a 20% down payment. We have access to multiple loan programs designed specifically for first-time buyers that require significantly less down—sometimes as low as 3% or 3.5%.

The best way to start is to figure out exactly how much home you can comfortably afford. If you have 10 minutes this week, I'd love to run some quick numbers for you.

You can book a quick intro call on my calendar here: [Insert Calendar Link]

Best,
Tim Haskins
Premier Mortgage Resources
NMLS #1116876

---
© Copyright 2025 Premier Mortgage Resources, LLC | Equal Housing Opportunity | NMLS ID 1169 | PMR is not affiliated with or an agency of the federal government. Not an offer to extend credit or a commitment to lend. Terms subject to change without notice. Not all branches or MLOs are licensed in all states. Tim Haskins NMLS #1116876.`;

// ─── FTHB SMS Step 1 content ───
const smsBody = `Hi Tim, it's Tim Haskins with Premier Mortgage Resources. Saw you requested info on buying your first home! Are you looking to buy in the next 3-6 months, or just starting to browse?`;

// ─── Send Email ───
console.log("=== Sending FTHB Email (Step 1) ===");
console.log(`To: timyourloanofficer@gmail.com`);
console.log(`From: noreply@lockinloans.com (Tim Haskins)`);
console.log(`Subject: ${emailSubject}`);

try {
  const emailResult = await dispatchEmail({
    to: "timyourloanofficer@gmail.com",
    subject: emailSubject,
    body: emailBody,
    from: "noreply@lockinloans.com",
    fromName: "Tim Haskins",
    accountId: 420001,
  });
  console.log("Email result:", JSON.stringify(emailResult, null, 2));
} catch (err) {
  console.error("Email error:", err);
}

// ─── Send SMS ───
console.log("\n=== Sending FTHB SMS (Step 1) ===");
console.log(`To: +16619927005`);
console.log(`From: +18444233013 (PMR Twilio)`);

try {
  const smsResult = await dispatchSMS({
    to: "+16619927005",
    body: smsBody,
    from: "+18444233013",
    accountId: 420001,
    skipDndCheck: true, // Test message, skip DND
  });
  console.log("SMS result:", JSON.stringify(smsResult, null, 2));
} catch (err) {
  console.error("SMS error:", err);
}

console.log("\n=== Done ===");
process.exit(0);
