/**
 * Send FTHB SMS Step 1 to:
 *   1) +16619927005
 *   2) +16262316410
 * From Premier Mortgage Resources account (420001)
 */
import { config } from "dotenv";
config();

import { register } from "tsx/esm/api";
const unreg = register();

const { dispatchSMS } = await import("../server/services/messaging.js");

const smsBody = `Hi Tim, it's Tim Haskins with Premier Mortgage Resources. Saw you requested info on buying your first home! Are you looking to buy in the next 3-6 months, or just starting to browse?`;

const recipients = [
  "+16619927005",
  "+16262316410",
];

for (const to of recipients) {
  console.log(`\n=== Sending FTHB SMS to ${to} ===`);
  try {
    const result = await dispatchSMS({
      to,
      body: smsBody,
      from: "+18444233013",
      accountId: 420001,
      skipDndCheck: true,
    });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

console.log("\n=== Done ===");
process.exit(0);
