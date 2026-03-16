/**
 * Seed script: Prebuilt campaign templates for mortgage & loan officers.
 * These are "global" templates (accountId = 0, createdById = 0) available to all accounts.
 * Run: node server/seed-templates.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const templates = [
  // ── EMAIL TEMPLATES ──────────────────────────────
  {
    accountId: 0,
    name: "New Lead Introduction",
    type: "email",
    subject: "Thanks for your mortgage inquiry",
    body: `Hi {{first_name}},

Thank you for reaching out about your mortgage options! My name is {{agent_name}} from {{company_name}}, and I'd love to help you find the best loan program for your needs.

Whether you're looking to purchase a new home, refinance your current mortgage, or explore investment property financing, I'm here to guide you through every step of the process.

Would you be available for a quick 15-minute call this week? I'd like to learn more about your goals and walk you through the options available to you.

Feel free to reply to this email or call me directly at your convenience.

Looking forward to connecting,
{{agent_name}}
{{company_name}}`,
    createdById: 0,
  },
  {
    accountId: 0,
    name: "Follow-Up Reminder",
    type: "email",
    subject: "Just checking in",
    body: `Hi {{first_name}},

I hope this message finds you well. I wanted to follow up on your recent mortgage inquiry and see if you still have questions about your options.

The mortgage landscape is always changing, and I want to make sure you have the most up-to-date information to make the best decision for your situation.

Here are a few things I can help you with:
- Pre-qualification for a mortgage
- Rate comparisons across different loan programs
- Understanding your buying power
- Refinancing options for your current home

No pressure at all — I'm here whenever you're ready. Just reply to this email or give me a call, and we can pick up right where we left off.

Best regards,
{{agent_name}}
{{company_name}}`,
    createdById: 0,
  },
  {
    accountId: 0,
    name: "Rate Update",
    type: "email",
    subject: "Mortgage rate update",
    body: `Hi {{first_name}},

I wanted to reach out with an important update — mortgage rates have recently shifted, and this could impact your home financing plans.

As your trusted mortgage advisor, I keep a close eye on market trends so you don't have to. Here's what you should know:

- Rates are currently trending in a direction that may benefit your situation
- Locking in a rate sooner rather than later could save you significantly over the life of your loan
- Several new loan programs have become available that you may qualify for

I'd love to schedule a quick consultation to review how these changes affect your specific goals. Whether you're buying, refinancing, or just exploring, now is a great time to have the conversation.

Would you be available for a brief call this week?

Best,
{{agent_name}}
{{company_name}}`,
    createdById: 0,
  },
  {
    accountId: 0,
    name: "Appointment Confirmation",
    type: "email",
    subject: "Your mortgage consultation",
    body: `Hi {{first_name}},

This is a confirmation of your upcoming mortgage consultation with me, {{agent_name}} from {{company_name}}.

During our call, we'll cover:
- Your current financial situation and goals
- Available mortgage programs you may qualify for
- Estimated rates and monthly payment scenarios
- Next steps in the pre-approval process

To make the most of our time together, it would be helpful if you could have the following ready:
- Recent pay stubs or proof of income
- A general idea of your budget or target price range
- Any questions you'd like answered

If you need to reschedule, please don't hesitate to reach out. I'm looking forward to helping you take the next step toward your homeownership goals.

See you soon,
{{agent_name}}
{{company_name}}`,
    createdById: 0,
  },

  // ── SMS TEMPLATES ────────────────────────────────
  {
    accountId: 0,
    name: "New Lead SMS",
    type: "sms",
    subject: null,
    body: `Hi {{first_name}}, this is {{agent_name}} from {{company_name}}. I saw your mortgage inquiry and would love to help. When would be a good time to talk?`,
    createdById: 0,
  },
  {
    accountId: 0,
    name: "Follow-Up SMS",
    type: "sms",
    subject: null,
    body: `Hi {{first_name}}, just checking in to see if you're still interested in exploring mortgage options. I'm here to help whenever you're ready — {{agent_name}}, {{company_name}}.`,
    createdById: 0,
  },
  {
    accountId: 0,
    name: "Appointment Reminder SMS",
    type: "sms",
    subject: null,
    body: `Reminder: We have a call scheduled today regarding your mortgage options. Looking forward to speaking with you! — {{agent_name}}, {{company_name}}`,
    createdById: 0,
  },
  {
    accountId: 0,
    name: "Quick Qualification SMS",
    type: "sms",
    subject: null,
    body: `Hi {{first_name}}, this is {{agent_name}} from {{company_name}}. I can help you check what mortgage programs you qualify for — it only takes a few minutes. Interested?`,
    createdById: 0,
  },
];

async function seed() {
  const connection = await createConnection(DATABASE_URL);
  const db = drizzle(connection);

  // Idempotency check: skip if global templates already exist
  const [rows] = await connection.execute(
    "SELECT COUNT(*) as cnt FROM campaign_templates WHERE accountId = 0"
  );
  const existingCount = rows[0]?.cnt ?? 0;
  if (existingCount >= templates.length) {
    console.log(`\n⏭  Seed skipped — ${existingCount} global templates already exist.`);
    await connection.end();
    return;
  }

  console.log("Seeding prebuilt campaign templates...\n");

  // Clear any existing global templates (accountId = 0) to avoid partial state
  await connection.execute("DELETE FROM campaign_templates WHERE accountId = 0");

  for (const t of templates) {
    await connection.execute(
      `INSERT INTO campaign_templates (accountId, name, type, subject, body, createdById)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [t.accountId, t.name, t.type, t.subject, t.body, t.createdById]
    );
    console.log(`  ✓ ${t.type.toUpperCase()} — ${t.name}`);
  }

  console.log(`\n✅ Seeded ${templates.length} templates successfully.`);
  await connection.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
