/**
 * Resend FTHB Email Step 1 to:
 *   1) timyourloanofficer@gmail.com
 *   2) tariq2525@gmail.com
 * From Premier Mortgage Resources account (420001)
 */
import { config } from "dotenv";
config();

import { register } from "tsx/esm/api";
const unreg = register();

const { dispatchEmail } = await import("../server/services/messaging.js");

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

const recipients = [
  "timyourloanofficer@gmail.com",
  "tariq2525@gmail.com",
];

for (const to of recipients) {
  console.log(`\n=== Sending FTHB Email to ${to} ===`);
  try {
    const result = await dispatchEmail({
      to,
      subject: emailSubject,
      body: emailBody,
      from: "noreply@lockinloans.com",
      fromName: "Tim Haskins",
      accountId: 420001,
    });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

console.log("\n=== Done ===");
process.exit(0);
