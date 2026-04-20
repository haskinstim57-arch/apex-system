/**
 * Demo Onboarding Data Seeder
 *
 * Seeds 5 fake contacts with notes, dispositions, and fake messages
 * into a given account for the onboarding "aha moment" phase.
 *
 * All seeded records are flagged with isDemoData: true on the contacts table
 * so they can be filtered from real queries and cleaned up later.
 */

import { getDb } from "../db";
import { contacts, contactNotes, messages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/** The 5 demo contacts for onboarding */
export const DEMO_CONTACTS = [
  {
    firstName: "Sarah",
    lastName: "Mitchell",
    email: "sarah.mitchell@demo.apex",
    phone: "+15551001001",
    leadSource: "Facebook Lead Ad",
    status: "qualified" as const,
    company: "Mitchell Family Trust",
    title: "First-time Homebuyer",
    city: "Phoenix",
    state: "AZ",
    leadScore: 82,
    notes: [
      {
        content: "Inbound from Facebook ad — pre-approved for $350K, looking in Scottsdale area. Wants to close within 60 days.",
        disposition: "Interested",
      },
      {
        content: "Left VM — called back within 2 hours. Very engaged, asked about rate lock options.",
        disposition: "Callback Requested",
      },
      {
        content: "Jarvis called and confirmed appointment for Thursday 2pm. Sent calendar invite.",
        disposition: "Appointment Set",
      },
    ],
    messages: [
      {
        type: "sms" as const,
        direction: "outbound" as const,
        status: "delivered" as const,
        body: "Hi Sarah! This is Apex System confirming your appointment for Thursday at 2pm. Reply YES to confirm or call us to reschedule.",
        toAddress: "+15551001001",
      },
      {
        type: "sms" as const,
        direction: "inbound" as const,
        status: "delivered" as const,
        body: "YES! Looking forward to it. Can I bring my husband?",
        toAddress: "+15559990001",
      },
    ],
  },
  {
    firstName: "Marcus",
    lastName: "Johnson",
    email: "marcus.j@demo.apex",
    phone: "+15551002002",
    leadSource: "Facebook Lead Ad",
    status: "contacted" as const,
    company: "Johnson Properties LLC",
    title: "Real Estate Investor",
    city: "Dallas",
    state: "TX",
    leadScore: 65,
    notes: [
      {
        content: "Investor lead — owns 4 rental properties, looking to refi 2 of them. Mentioned cash-out for a 5th purchase.",
        disposition: "Interested",
      },
      {
        content: "Left VM x3, no callback yet. High-value lead — keep trying.",
        disposition: "Left VM",
      },
    ],
    messages: [
      {
        type: "email" as const,
        direction: "outbound" as const,
        status: "delivered" as const,
        subject: "Your Investment Property Refinance Options",
        body: "Hi Marcus,\n\nI wanted to follow up on your inquiry about refinancing your rental properties. Based on current rates, I can likely save you $400-600/month across both properties.\n\nWould you have 15 minutes this week to discuss?\n\nBest regards",
        toAddress: "marcus.j@demo.apex",
      },
    ],
  },
  {
    firstName: "Jennifer",
    lastName: "Reyes",
    email: "jen.reyes@demo.apex",
    phone: "+15551003003",
    leadSource: "Website Form",
    status: "new" as const,
    company: "",
    title: "VA Loan Applicant",
    city: "San Antonio",
    state: "TX",
    leadScore: 45,
    notes: [
      {
        content: "New lead from website — active duty military, interested in VA loan. No contact attempt yet.",
        disposition: null,
      },
    ],
    messages: [],
  },
  {
    firstName: "David",
    lastName: "Park",
    email: "david.park@demo.apex",
    phone: "+15551004004",
    leadSource: "Referral",
    status: "proposal" as const,
    company: "Park & Associates",
    title: "Business Owner",
    city: "Austin",
    state: "TX",
    leadScore: 91,
    notes: [
      {
        content: "Referred by existing client Tom Chen. Needs jumbo loan for $1.2M property. Excellent credit (780+).",
        disposition: "Interested",
      },
      {
        content: "Sent rate sheet and pre-approval letter. Waiting on signed disclosure.",
        disposition: "Proposal Sent",
      },
      {
        content: "Jarvis follow-up call — David confirmed he'll sign disclosures by Friday. Pipeline value: $1.2M.",
        disposition: "Appointment Set",
      },
    ],
    messages: [
      {
        type: "email" as const,
        direction: "outbound" as const,
        status: "delivered" as const,
        subject: "Your Pre-Approval Letter & Rate Options",
        body: "Hi David,\n\nAttached is your pre-approval letter for up to $1.2M. I've included three rate scenarios for your review.\n\nPlease sign the disclosures at your earliest convenience so we can lock your rate.\n\nBest regards",
        toAddress: "david.park@demo.apex",
      },
      {
        type: "sms" as const,
        direction: "inbound" as const,
        status: "delivered" as const,
        body: "Got the email, thanks! I'll have the disclosures signed by Friday.",
        toAddress: "+15559990001",
      },
    ],
  },
  {
    firstName: "Lisa",
    lastName: "Thompson",
    email: "lisa.t@demo.apex",
    phone: "+15551005005",
    leadSource: "Facebook Lead Ad",
    status: "contacted" as const,
    company: "",
    title: "Refinance Prospect",
    city: "Chandler",
    state: "AZ",
    leadScore: 58,
    notes: [
      {
        content: "Facebook lead — current rate is 7.2%, wants to explore refinance options. Owes $280K on home worth ~$420K.",
        disposition: "Interested",
      },
      {
        content: "Left VM twice. Sent follow-up SMS. No response yet.",
        disposition: "Left VM",
      },
    ],
    messages: [
      {
        type: "sms" as const,
        direction: "outbound" as const,
        status: "delivered" as const,
        body: "Hi Lisa, this is your loan officer following up on your refinance inquiry. Based on your current rate of 7.2%, I may be able to save you $200+/month. Would you like to chat?",
        toAddress: "+15551005005",
      },
    ],
  },
];

/**
 * Seed demo contacts, notes, and messages for the onboarding aha moment.
 * Returns the IDs of created contacts for reference.
 */
export async function seedDemoOnboardingData(
  accountId: number,
  userId: number
): Promise<{ contactIds: number[] }> {
  const db = await getDb();
  const contactIds: number[] = [];

  for (const demo of DEMO_CONTACTS) {
    // Insert contact with isDemoData flag
    const [result] = await db.insert(contacts).values({
      accountId,
      firstName: demo.firstName,
      lastName: demo.lastName,
      email: demo.email,
      phone: demo.phone,
      leadSource: demo.leadSource,
      status: demo.status,
      company: demo.company || undefined,
      title: demo.title || undefined,
      city: demo.city,
      state: demo.state,
      leadScore: demo.leadScore,
      isDemoData: true,
    });
    const contactId = result.insertId;
    contactIds.push(contactId);

    // Insert notes
    for (const note of demo.notes) {
      await db.insert(contactNotes).values({
        contactId,
        authorId: userId,
        content: note.content,
        disposition: note.disposition,
      });
    }

    // Insert messages
    for (const msg of demo.messages) {
      await db.insert(messages).values({
        accountId,
        contactId,
        userId,
        type: msg.type,
        direction: msg.direction,
        status: msg.status,
        subject: (msg as any).subject || null,
        body: msg.body,
        toAddress: msg.toAddress,
        fromAddress: msg.direction === "outbound" ? "+15559990001" : msg.toAddress,
        sentAt: new Date(),
        deliveredAt: msg.status === "delivered" ? new Date() : null,
      });
    }
  }

  return { contactIds };
}

/**
 * Clean up demo data for an account.
 * Called when the user finishes onboarding and connects real data.
 */
export async function cleanupDemoData(accountId: number): Promise<void> {
  const db = await getDb();

  // Get demo contact IDs
  const demoContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), eq(contacts.isDemoData, true)));

  const demoIds = demoContacts.map((c) => c.id);

  if (demoIds.length === 0) return;

  // Delete messages for demo contacts
  for (const cid of demoIds) {
    await db.delete(messages).where(eq(messages.contactId, cid));
    await db.delete(contactNotes).where(eq(contactNotes.contactId, cid));
  }

  // Delete demo contacts
  await db
    .delete(contacts)
    .where(and(eq(contacts.accountId, accountId), eq(contacts.isDemoData, true)));
}

/**
 * Check if demo data already exists for an account.
 */
export async function hasDemoData(accountId: number): Promise<boolean> {
  const db = await getDb();
  const [result] = await db
    .select({ cnt: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), eq(contacts.isDemoData, true)))
    .limit(1);
  return !!result;
}
