/**
 * PMR Sequence Seeder
 *
 * Creates all 10 sequences, steps, trigger workflows, auto-stop workflows,
 * landing pages, and Belinda Osborne account setup for Premier Mortgage Resources.
 *
 * Run: pnpm seed:pmr
 */
import "dotenv/config";
import { getDb } from "../db";
import {
  createSequence,
  createSequenceStep,
  createWorkflow,
  createWorkflowStep,
  updateSequence,
} from "../db";
import { accounts, accountMembers, users, landingPages } from "../../drizzle/schema";
import { eq, like, or, and } from "drizzle-orm";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function findPMRAccount() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db
    .select()
    .from(accounts)
    .where(or(like(accounts.name, "%Premier Mortgage%"), like(accounts.name, "%PMR%")));
  if (results.length === 0) {
    throw new Error("❌ No PMR account found. Please create an account with 'Premier Mortgage Resources' or 'PMR' in the name first.");
  }
  if (results.length > 1) {
    console.log("⚠️  Multiple PMR accounts found:");
    results.forEach((a) => console.log(`   - ID: ${a.id}, Name: ${a.name}`));
    console.log(`   Using first match: ID ${results[0].id}`);
  }
  return results[0];
}

async function findPMROwner(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const members = await db
    .select()
    .from(accountMembers)
    .where(and(eq(accountMembers.accountId, accountId), eq(accountMembers.role, "owner")));
  if (members.length === 0) {
    // Fallback: get any member
    const anyMember = await db
      .select()
      .from(accountMembers)
      .where(eq(accountMembers.accountId, accountId));
    if (anyMember.length === 0) throw new Error("No members found for PMR account");
    return anyMember[0].userId;
  }
  return members[0].userId;
}

interface SeqDef {
  name: string;
  description?: string;
  triggerTag: string;
  steps: {
    position: number;
    delayDays: number;
    delayHours?: number;
    messageType: "sms" | "email";
    subject?: string;
    content: string;
  }[];
}

async function createSeqWithSteps(accountId: number, def: SeqDef): Promise<number> {
  const { id: seqId } = await createSequence({
    accountId,
    name: def.name,
    description: def.description || `Trigger tag: ${def.triggerTag}`,
    status: "active",
  });
  const numericId = Number(seqId);
  for (const step of def.steps) {
    await createSequenceStep({
      sequenceId: numericId,
      position: step.position,
      delayDays: step.delayDays,
      delayHours: step.delayHours || 0,
      messageType: step.messageType,
      subject: step.subject || null,
      content: step.content,
    });
  }
  console.log(`  ✅ Sequence "${def.name}" created (ID: ${numericId}, ${def.steps.length} steps)`);
  return numericId;
}

// ─────────────────────────────────────────────
// SEQUENCE DEFINITIONS
// ─────────────────────────────────────────────

const SEQUENCES: SeqDef[] = [
  // ─── SEQUENCE 1: 6-Month Home Anniversary Refi Check-In ───
  {
    name: "6-Month Home Anniversary - Refi Check-In",
    triggerTag: "refi-6mo-check",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "Hi {{firstName}}! It's Tim with Premier Mortgage Resources 👋 Happy 6-month home anniversary! 🏠 Rates have shifted since you closed — I'd love to run a free refi analysis to see if we can lower your payment. Interested? Just reply YES or call me anytime!",
      },
      {
        position: 2, delayDays: 0, delayHours: 1, messageType: "email",
        subject: "Happy 6-Month Home Anniversary, {{firstName}}! 🏡",
        content: "Hi {{firstName}},\n\nCongratulations on 6 months in your new home! 🎉\n\nA lot has changed in the mortgage market since you closed. Even a small rate reduction could save you hundreds every month — and over the life of your loan, that really adds up.\n\nI'd love to offer you a FREE refinance analysis — no cost, no obligation — just a clear picture of whether refinancing makes sense for you right now.\n\nHere's what we'll look at:\n✅ Your current rate vs. today's rates\n✅ Break-even timeline\n✅ Monthly payment savings\n✅ Cash-out equity options\n\nSimply reply to this email or click below to book a quick 15-minute call.\n\nCongratulations again on this milestone!\n\nTim Haskins\nPremier Mortgage Resources\n📞 Call or Text Anytime",
      },
      {
        position: 3, delayDays: 5, messageType: "sms",
        content: "Hey {{firstName}}, Tim from Premier Mortgage Resources following up! Have you had a chance to think about a refi analysis? Even a 0.5% rate reduction could save you $200-$400/month. Takes just 10 minutes to find out — want me to run the numbers? 📊",
      },
      {
        position: 4, delayDays: 10, messageType: "email",
        subject: "Could You Be Overpaying on Your Mortgage, {{firstName}}?",
        content: "Hi {{firstName}},\n\nQuick question: when did you last review your mortgage rate?\n\nIf you closed in the last few years, there's a good chance we can improve your situation — whether that means a lower rate, shorter term, or accessing your home equity for improvements or debt consolidation.\n\nThe average homeowner who refinances saves over $150/month. For most people, the break-even is under 24 months.\n\nI'm here if you want to explore it. No pressure — just real numbers.\n\nTim Haskins | Premier Mortgage Resources\nReply anytime or book a call at your convenience.",
      },
    ],
  },

  // ─── SEQUENCE 2: 12-Month Home Anniversary Refi Check-In ───
  {
    name: "12-Month Home Anniversary - Refi Check-In",
    triggerTag: "refi-12mo-check",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "Hi {{firstName}}! Tim Haskins here from Premier Mortgage Resources 🎉 Happy 1-Year Homeowner Anniversary! You've built equity, the market has moved — have you thought about refinancing or tapping into your home's value? Let's chat — it could be worth thousands!",
      },
      {
        position: 2, delayDays: 0, delayHours: 1, messageType: "email",
        subject: "One Year of Homeownership — Are You Leaving Money on the Table? 🏠",
        content: "Hi {{firstName}},\n\nOne full year as a homeowner — that's a huge milestone and you should be proud! 🎉\n\nHere's something most homeowners don't realize: after 12 months, you may have built significant equity and the market may have shifted enough to make refinancing very worthwhile.\n\nIn the past year you may have:\n🏡 Gained equity from market appreciation\n📉 Become eligible for better rates\n💰 Built enough equity to eliminate PMI\n🔧 Identified home improvements you could fund via cash-out refi\n\nI'd love to do a FREE 1-Year Mortgage Review for you. 15 minutes on the phone and I'll show you exactly where you stand and what options are available.\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 3, delayDays: 7, messageType: "sms",
        content: "Hey {{firstName}}, Tim at PMR again! Just checking in on that mortgage review. Home values in our area have really moved this year — you may have more equity than you think. Want a free snapshot of your options? Reply YES and I'll put together a quick analysis!",
      },
      {
        position: 4, delayDays: 14, messageType: "email",
        subject: "Your Equity Has Been Growing, {{firstName}} — Here's What That Means",
        content: "Hi {{firstName}},\n\nDid you know the average homeowner gained significant equity over the past year?\n\nThat equity is YOUR money sitting in your home — and there are smart ways to put it to work:\n\n💡 Consolidate high-interest debt\n🏠 Fund home improvements that add value\n📚 Pay for education\n🏖️ Build an emergency fund\n\nA cash-out refinance or HELOC could unlock that equity at a rate far lower than credit cards or personal loans.\n\nLet's explore what makes sense for your situation. Reply to book a no-obligation call.\n\nTim Haskins | Premier Mortgage Resources",
      },
    ],
  },

  // ─── SEQUENCE 3: Happy Birthday ───
  {
    name: "Happy Birthday Outreach",
    triggerTag: "happy-birthday",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "🎂 Happy Birthday {{firstName}}! Wishing you an amazing day! From your friends at Premier Mortgage Resources — Tim Haskins & the PMR Team 🎉",
      },
      {
        position: 2, delayDays: 0, delayHours: 1, messageType: "email",
        subject: "Happy Birthday, {{firstName}}! 🎉 From the PMR Team",
        content: "Happy Birthday {{firstName}}! 🎂\n\nOn your special day, the entire Premier Mortgage Resources team wants to wish you all the best.\n\nWhether you're celebrating with family, friends, or a quiet day to yourself — we hope it's everything you deserve.\n\nThank you for trusting us with one of the biggest financial decisions of your life. We're grateful for you!\n\nWith warm wishes,\nTim Haskins & The PMR Team\nPremier Mortgage Resources 🏡",
      },
    ],
  },

  // ─── SEQUENCE 4: Warm RE Agent Top of Mind ───
  {
    name: "Warm RE Agent - Stay Top of Mind",
    triggerTag: "warm-re-agent",
    steps: [
      {
        position: 1, delayDays: 1, messageType: "email",
        subject: "Quick Check-In, {{firstName}} — How Can We Help Your Clients?",
        content: "Hi {{firstName}},\n\nJust wanted to check in and see how things are going on your end!\n\nWe're closing purchase loans in 21 days or less right now and our pre-approval letters are holding up strong in competitive offer situations.\n\nA few things we're offering your buyers right now:\n✅ Same-day pre-approval letters\n✅ DPA programs — 0% to 3.5% down\n✅ One-Time Close construction loans\n✅ Bank statement programs for self-employed buyers\n\nGot any clients sitting on the fence? Send them our way — we'll take great care of them and reflect well on you.\n\nTim Haskins | Premier Mortgage Resources\n📞 Let's connect anytime",
      },
      {
        position: 2, delayDays: 1, delayHours: 2, messageType: "sms",
        content: "Hey {{firstName}}! Tim Haskins at PMR. Hope you're having a great week! We just launched a new DPA program that helps buyers get in with little to no down payment — could be a game changer for your fence-sitters. Worth a quick 10-min call? 🏡",
      },
      {
        position: 3, delayDays: 10, messageType: "email",
        subject: "Market Update + A Resource for Your Buyers, {{firstName}}",
        content: "Hi {{firstName}},\n\nHere's a quick market update and something useful for your buyers:\n\n📊 MARKET SNAPSHOT\nRates have been moving — buyers who lock early are protecting themselves from payment creep. We're advising all pre-approved buyers to move decisively when they find the right home.\n\n🛠️ RESOURCE FOR YOUR CLIENTS\nWe put together a simple First-Time Buyer Checklist your clients can use. Reply and I'll send it over — it's a great leave-behind for your open houses.\n\n💬 QUICK ASK\nGot any buyers who need pre-approval? We turn them around fast and keep you in the loop every step of the way.\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 4, delayDays: 10, messageType: "sms",
        content: "Hi {{firstName}}, Tim at PMR! We're averaging 21-day closings right now — your buyers can make strong offers knowing they'll actually close on time. Anyone you're working with looking for a lender? 💪",
      },
      {
        position: 5, delayDays: 14, messageType: "email",
        subject: "Competitive Edge for Your Buyers, {{firstName}} — TBD Underwriting",
        content: "Hi {{firstName}},\n\nIn today's market, your buyers need every edge they can get. Here's how we help your clients stand out:\n\n🏆 TBD Underwriting Approval — stronger than a standard pre-approval. Sellers love it.\n🔒 Rate Lock at Pre-Approval — no rate surprises at closing\n⚡ 21-Day Close Guarantee — we mean it\n📋 Fully Underwritten Letters — we do the work upfront\n\nBuyers with our letters are winning in competition against higher offers because sellers trust the deal will close.\n\nWant to set up a quick call so we can put a strategy together for your buyers?\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 6, delayDays: 10, messageType: "sms",
        content: "{{firstName}}, Tim at PMR. Quick win to share — helped a buyer compete against a cash offer last week using our TBD approval and DPA combo. The listing agent was impressed. Would love to help your buyers too! 🎯",
      },
    ],
  },

  // ─── SEQUENCE 5: Cold RE Agent New Relationship ───
  {
    name: "Cold RE Agent - Build New Relationship",
    triggerTag: "cold-re-agent",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "email",
        subject: "Helping {{firstName}}'s Clients Close Faster — Premier Mortgage Resources",
        content: "Hi {{firstName}},\n\nMy name is Tim Haskins and I'm a Loan Officer with Premier Mortgage Resources.\n\nI specialize in working with real estate agents to make sure their buyers are truly ready — not just pre-qualified, but fully underwritten and set up to win in any market condition.\n\nWhat sets us apart:\n✅ 21-day average closing time\n✅ Same-day pre-approval letters\n✅ Down Payment Assistance programs most lenders don't offer\n✅ Constant communication — you'll always know where your client's loan stands\n\nI'd love to introduce myself and see if there's a way we can work together to serve your clients better.\n\nWould you have 10-15 minutes this week for a quick intro call?\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 2, delayDays: 3, messageType: "sms",
        content: "Hi {{firstName}}, this is Tim Haskins from Premier Mortgage Resources. I work with local agents to help their buyers get pre-approved fast and close deals on time. Would love to connect briefly — do you have 10 minutes this week? 🤝",
      },
      {
        position: 3, delayDays: 7, messageType: "email",
        subject: "What Makes PMR Different From Other Lenders, {{firstName}}",
        content: "Hi {{firstName}},\n\nI know you have options when it comes to recommending a lender to your clients. Here's why agents who work with us keep coming back:\n\n📞 We answer the phone — weekends included\n⚡ Pre-approvals in 24 hours or less\n🏦 Access to 30+ lenders and unique programs\n📋 We do full TBD underwriting so your deals don't fall apart\n💬 We give you updates proactively — you never have to chase us\n\nOne of the biggest frustrations agents have with lenders is poor communication. We've built our entire process around keeping you informed and your clients confident.\n\nWorth a quick conversation?\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 4, delayDays: 7, messageType: "sms",
        content: "Hey {{firstName}}, Tim at PMR here. We have DPA programs that help buyers get in with 0% to 3.5% down — programs many agents don't even know exist. Could open doors for your clients who think they can't afford to buy yet. Worth a quick call? 🏡",
      },
      {
        position: 5, delayDays: 14, messageType: "email",
        subject: "Real Results: What Agents Are Saying About Working With PMR",
        content: "Hi {{firstName}},\n\nI want to share what agents who work with Premier Mortgage Resources are saying:\n\n'Tim and his team closed our deal in 18 days when another lender was dragging to 45. My clients were thrilled.' — Local Realtor\n\n'I send every buyer to Tim because I know he'll take care of them and close on time. He makes me look good.' — Top Producing Agent\n\n'Tim found a DPA program that saved my buyer $22,000 out of pocket. I had no idea it existed.' — Realtor Partner\n\nI'd love to add you to this group of agents who have a reliable lending partner in their corner.\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 6, delayDays: 14, messageType: "sms",
        content: "{{firstName}}, last message from Tim at PMR. I genuinely believe we can help your buyers succeed. If you ever have a client who needs fast, reliable pre-approval — I'm just a text away. No pressure, just an open door. 🙏",
      },
    ],
  },

  // ─── SEQUENCE 6: Credit Repair Borrower Nurture ───
  {
    name: "Credit Repair - Long Term Nurture",
    triggerTag: "credit-repair-nurture",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "Hi {{firstName}}! Tim Haskins here from Premier Mortgage Resources 🏠 You're taking an amazing step toward homeownership by working on your credit. We're in your corner! Questions anytime — just text me. We'll be checking in to cheer you on! 💪",
      },
      {
        position: 2, delayDays: 0, delayHours: 1, messageType: "email",
        subject: "We're With You Every Step of the Way, {{firstName}}! 🏡",
        content: "Hi {{firstName}},\n\nFirst — congratulations on taking a huge step toward homeownership by addressing your credit. It shows real commitment and we respect that.\n\nWhile you're working through the credit repair process, here are a few tips to keep you moving forward:\n\n📈 PAY ON TIME — Even one late payment can set you back months\n💳 KEEP BALANCES LOW — Try to stay under 30% of your credit limit\n🚫 DON'T OPEN NEW ACCOUNTS — New credit inquiries can temporarily lower your score\n🗂️ DISPUTE ERRORS — Old or incorrect items can be removed faster than you think\n\nWe'll check in periodically, but never hesitate to reach out. When your score is ready, we can move FAST on your pre-approval.\n\nRooting for you!\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 3, delayDays: 30, messageType: "sms",
        content: "Hi {{firstName}}, Tim from PMR checking in! 30 days in — how is the credit repair journey going? Even small wins add up. Remember, once you hit your target score we can get your pre-approval done quickly. What's your score looking like? 📈",
      },
      {
        position: 4, delayDays: 15, messageType: "email",
        subject: "You're 45 Days In — Here's How to Accelerate Your Credit Score",
        content: "Hi {{firstName}},\n\nYou're making real progress! Here's what you can do right now to potentially boost your score faster:\n\n🚀 RAPID RESCORE — Once negative items are removed, we can request a rapid rescore that updates your credit in days, not months\n💰 PAY DOWN REVOLVING DEBT — Getting cards below 10% utilization can add 20-50 points\n📋 AUTHORIZED USER — Being added to a family member's old, good-standing account can boost your score quickly\n\nThe goal is to get you into your home as soon as possible — and we're ready to move the moment you give us the green light.\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 5, delayDays: 15, messageType: "sms",
        content: "Hey {{firstName}}! Tim at PMR. 60 days into your credit journey — you've got this! Once you reach your target score, we can have a pre-approval ready in 24 hours. What's your current score? Let's map out the finish line! 🎯",
      },
      {
        position: 6, delayDays: 30, messageType: "email",
        subject: "3 Months In — Are You Ready to Get Pre-Approved, {{firstName}}?",
        content: "Hi {{firstName}},\n\n3 months is a major milestone in credit repair. Many of our clients are getting close to pre-approval territory right around now.\n\nWould you like to do a soft credit check (no impact to your score) to see exactly where you stand? We can map out:\n\n✅ Your current score vs. minimum qualification\n✅ Exactly what needs to happen to get you approved\n✅ A realistic timeline to your pre-approval\n\nNo pressure — just information to help you plan.\n\nTim Haskins | Premier Mortgage Resources\nReply anytime to schedule a free check-in call.",
      },
      {
        position: 7, delayDays: 30, messageType: "sms",
        content: "Hi {{firstName}}, Tim at PMR — 4 months in! Homeownership is within reach. If your credit is close to where it needs to be, let's talk. We have programs starting at 580 credit score for some loan types. Ready for a free check-in? 🏠",
      },
      {
        position: 8, delayDays: 30, messageType: "email",
        subject: "Ready When You Are, {{firstName}} — Let's Map Your Path to Pre-Approval",
        content: "Hi {{firstName}},\n\nI just want you to know — we haven't forgotten about you and we're cheering for you every step of the way.\n\nWhen you're ready — whether that's today or 6 months from now — Premier Mortgage Resources is here to help you cross the finish line into homeownership.\n\nJust reply to this email or text me directly and we'll pick up right where we left off.\n\nYou've got this. 🏡\n\nTim Haskins | Premier Mortgage Resources",
      },
    ],
  },

  // ─── SEQUENCE 7: HELOC Lead Nurture ───
  {
    name: "HELOC Lead - Didn't Answer Nurture",
    triggerTag: "heloc-nurture",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "Hi {{firstName}}! This is Tim with Premier Mortgage Resources. You recently asked about HELOC options — I tried to reach you but missed you! 📞 A HELOC lets you access your home's equity for improvements, debt consolidation, and more — often at much lower rates. When's a good time to connect?",
      },
      {
        position: 2, delayDays: 0, delayHours: 2, messageType: "email",
        subject: "Your HELOC Request — Let's Talk About Your Home's Equity!",
        content: "Hi {{firstName}},\n\nThank you for your interest in a HELOC! I tried reaching you and wanted to follow up.\n\nA Home Equity Line of Credit (HELOC) is one of the smartest financial tools a homeowner has:\n\n🏠 USE YOUR EQUITY — Access funds you've already built up\n💰 LOWER RATES — Typically much lower than personal loans or credit cards\n🔄 FLEXIBLE — Draw what you need, when you need it, and pay interest only on what you use\n🔨 POPULAR USES: Home renovations, debt consolidation, tuition, emergency fund\n\nWould you like a FREE equity analysis? We'll show you exactly how much you could access and what your payment options would look like.\n\nTim Haskins | Premier Mortgage Resources\nReply or call to get started!",
      },
      {
        position: 3, delayDays: 2, messageType: "sms",
        content: "Hey {{firstName}}, Tim at PMR here. Still thinking about your HELOC options? Rates move — would hate for you to miss a good window. Takes just 10 minutes to get the numbers. Want me to run a quick analysis for you? 📊",
      },
      {
        position: 4, delayDays: 5, messageType: "email",
        subject: "HELOC vs. Cash-Out Refinance — Which Is Right for You, {{firstName}}?",
        content: "Hi {{firstName}},\n\nNot sure if a HELOC is the right move? Let's break down your options:\n\n🔄 HELOC\n• Flexible line of credit\n• Variable rate (but often starts low)\n• Great for ongoing projects or emergency fund\n• Keep your current mortgage intact\n\n💵 CASH-OUT REFINANCE\n• Get a lump sum upfront\n• Fixed rate option available\n• Replaces your current mortgage\n• Great for large one-time needs\n\nEither way, you're putting YOUR equity to work — not paying high-interest rates to banks.\n\nLet's find the right fit. 15-minute call, no obligation.\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 5, delayDays: 6, messageType: "sms",
        content: "Hi {{firstName}}! Tim at PMR. We can typically get HELOC approvals done in under 2 weeks. If you have a project or goal in mind, now is a great time to explore your options. Book a free consultation here: [CALENDAR LINK]",
      },
      {
        position: 6, delayDays: 7, messageType: "email",
        subject: "How Much Equity Could You Access, {{firstName}}?",
        content: "Hi {{firstName}},\n\nHere's a quick equity estimate example:\n\nIf your home is worth $350,000 and you owe $220,000:\n➡️ You have ~$130,000 in equity\n➡️ With an 80% CLTV HELOC, you could access up to $60,000\n\nThat's real money — and it's yours. Whether you use it for renovations that increase your home's value, eliminate high-interest debt, or keep as a safety net — a HELOC puts you in control.\n\nReady to see your actual numbers?\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 7, delayDays: 7, messageType: "sms",
        content: "{{firstName}}, final follow-up from Tim at PMR on your HELOC inquiry. If the timing isn't right, no worries at all! I'll be here when you're ready. Just text me anytime. Reply STOP to opt out of these messages. 🏡",
      },
    ],
  },

  // ─── SEQUENCE 8: Purchase Lead Nurture ───
  {
    name: "Purchase Lead - Didn't Book Nurture",
    triggerTag: "purchase-nurture",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "Hi {{firstName}}! Tim Haskins here from Premier Mortgage Resources 👋 I see you're interested in purchasing a home — exciting stuff! I tried reaching you but missed you. When's the best time for a quick 10-min intro call? We make getting pre-approved fast and painless! 🏡",
      },
      {
        position: 2, delayDays: 0, delayHours: 2, messageType: "email",
        subject: "Ready to Start Your Home Buying Journey, {{firstName}}? Let's Talk!",
        content: "Hi {{firstName}},\n\nThank you for your interest in purchasing a home! I tried to reach you and would love to connect.\n\nAt Premier Mortgage Resources, we make the mortgage process simple, fast, and stress-free:\n\n⚡ Pre-approval in 24 hours or less\n🏦 Access to 30+ lenders for the best rates\n💰 Down payment as low as 0-3.5%\n✅ We guide you every step of the way\n\nGetting pre-approved is completely free and doesn't hurt your credit. And knowing your budget BEFORE you start shopping saves you time and heartache.\n\nWould you like to schedule a free 15-minute call this week?\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 3, delayDays: 2, messageType: "sms",
        content: "Hey {{firstName}}, Tim at PMR checking in! The purchase market moves fast — buyers with pre-approval letters are winning. Getting yours takes about 24 hours and costs nothing. Want to get started? 🏠",
      },
      {
        position: 4, delayDays: 5, messageType: "email",
        subject: "What Can You Actually Afford, {{firstName}}? Let's Find Out for Free",
        content: "Hi {{firstName}},\n\nOne of the most common things I hear from first-time buyers is 'I don't know if I can afford it.'\n\nHere's the truth: most people can afford MORE than they think — especially with the programs available today.\n\n✅ FHA Loans — 3.5% down, flexible credit requirements\n✅ Conventional — as low as 3% down with good credit\n✅ DPA Programs — up to 5% in down payment assistance (some fully forgivable)\n✅ VA Loans — 0% down for veterans\n\nThe only way to know for sure is to run the numbers. It's free, it's fast, and there's no obligation.\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 5, delayDays: 6, messageType: "sms",
        content: "Hi {{firstName}}, Tim at PMR. Did you know we have programs with $0 down options? Could save you $20,000-$40,000 upfront. Worth a 10-min call to see if you qualify! 💰 Book here: [CALENDAR LINK]",
      },
      {
        position: 6, delayDays: 7, messageType: "email",
        subject: "Real Buyers, Real Results — Stories From PMR Clients",
        content: "Hi {{firstName}},\n\nSometimes it helps to see what's possible. Here's what our recent clients have experienced:\n\n🏡 'We didn't think we had enough saved, but Tim found a DPA program that covered our entire down payment. We moved in last month!' — First-Time Buyer\n\n🏡 'Tim got our pre-approval done in ONE day. We made an offer that night and won!' — New PMR Client\n\n🏡 'Smoothest mortgage process I've ever been through. Tim kept us informed every single step.' — Repeat Client\n\nYou could be our next success story. Let's talk.\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 7, delayDays: 7, messageType: "sms",
        content: "{{firstName}}, final message from Tim at PMR. We're here when you're ready to take the next step into homeownership. Book a free consultation anytime: [CALENDAR LINK] — or just reply to this text! Reply STOP to opt out. 🏡",
      },
    ],
  },

  // ─── SEQUENCE 9: DPA Webinar Registration ───
  {
    name: "DPA Webinar - Registration Sequence [TEMPLATE]",
    description: "TEMPLATE — Update [WEBINAR DATE], [WEBINAR TIME], [WEBINAR LINK] before each event",
    triggerTag: "dpa-webinar-registered",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "You're registered! 🎉 Down Payment Assistance Webinar with Tim Haskins — [WEBINAR DATE] at [WEBINAR TIME]. We'll show you programs that help buyers purchase homes with little to no money down. See you there! — PMR Team",
      },
      {
        position: 2, delayDays: 0, delayHours: 1, messageType: "email",
        subject: "You're Registered! DPA Webinar — [WEBINAR DATE] ✅",
        content: "Hi {{firstName}},\n\nYou're officially registered for our FREE Down Payment Assistance Webinar!\n\n📅 DATE: [WEBINAR DATE]\n⏰ TIME: [WEBINAR TIME]\n🔗 JOIN LINK: [WEBINAR LINK]\n\nWhat you'll learn:\n✅ Down payment assistance programs available right now\n✅ How to buy a home with 0-3.5% down\n✅ Programs that include forgivable grants (free money!)\n✅ How to qualify even if you think you can't\n✅ Live Q&A with Tim Haskins\n\nAdd this to your calendar now so you don't forget!\n\nSee you there,\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 3, delayDays: 4, messageType: "email",
        subject: "One Week Away — Your DPA Webinar Reminder, {{firstName}}",
        content: "Hi {{firstName}},\n\nJust one week until our Down Payment Assistance Webinar and we're SO excited to share these strategies with you!\n\n📅 [WEBINAR DATE] at [WEBINAR TIME]\n🔗 [WEBINAR LINK]\n\nWe'll be covering programs that have helped real families in our area purchase homes they didn't think they could afford. These are programs that most buyers — and even many real estate agents — don't know exist.\n\nMark your calendar and we'll see you there!\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 4, delayDays: 3, messageType: "sms",
        content: "{{firstName}}! Just 3 days until our DPA Webinar on [WEBINAR DATE] 🏡 We'll cover programs that have helped buyers purchase homes with $0 down. Don't miss it! [WEBINAR LINK]",
      },
      {
        position: 5, delayDays: 2, messageType: "email",
        subject: "Tomorrow: Your Path to Homeownership Starts at Our Webinar, {{firstName}}",
        content: "Hi {{firstName}},\n\nTomorrow is the day! 🎉\n\n📅 [WEBINAR DATE] at [WEBINAR TIME]\n🔗 JOIN HERE: [WEBINAR LINK]\n\nIn just one hour you'll learn:\n• Programs with 0% to 5% down payment assistance\n• Which programs are fully forgivable (you never pay them back!)\n• How to get pre-approved and start shopping FAST\n• Live answers to your specific questions\n\nWe'll see you tomorrow!\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 6, delayDays: 1, messageType: "sms",
        content: "Good morning {{firstName}}! Today's the day — DPA Webinar at [WEBINAR TIME] 🏠 Dozens of families have already used these programs to buy homes with little to no money down. Join us: [WEBINAR LINK]",
      },
      {
        position: 7, delayDays: 0, delayHours: 23, messageType: "sms",
        content: "{{firstName}} — just 1 HOUR until we start! 🕐 Jump in here: [WEBINAR LINK] We'll be covering programs that could save you $20,000+ at closing. See you in 60 minutes! — Tim, PMR",
      },
      {
        position: 8, delayDays: 0, delayHours: 1, messageType: "sms",
        content: "We're starting in 5 MINUTES, {{firstName}}! Join NOW — it's not too late! 🚀 [WEBINAR LINK] Don't miss these down payment strategies from Tim Haskins at PMR!",
      },
      {
        position: 9, delayDays: 1, messageType: "email",
        subject: "Thank You for Attending — Here Are Your Next Steps, {{firstName}}",
        content: "Hi {{firstName}},\n\nThank you so much for joining our Down Payment Assistance Webinar!\n\nWe hope you left feeling inspired and informed about your path to homeownership.\n\n🎯 YOUR NEXT STEP:\nBook a FREE 15-minute strategy call with Tim to find out exactly which programs you qualify for and what your path to pre-approval looks like.\n\nSpots are limited — book now while this is top of mind:\n[CALENDAR LINK]\n\nThank you again — we can't wait to help you get into your new home!\n\nTim Haskins | Premier Mortgage Resources",
      },
    ],
  },

  // ─── SEQUENCE 10: RE Agent Webinar Registration ───
  {
    name: "RE Agent Webinar - Registration Sequence [TEMPLATE]",
    description: "TEMPLATE — Update [WEBINAR DATE], [WEBINAR TIME], [WEBINAR LINK] before each event",
    triggerTag: "re-agent-webinar-registered",
    steps: [
      {
        position: 1, delayDays: 0, messageType: "sms",
        content: "You're registered! 🎉 Exclusive RE Agent Program Webinar with Tim Haskins — [WEBINAR DATE] at [WEBINAR TIME]. We'll share little-known programs that help YOUR buyers qualify and close. See you there! — PMR Team",
      },
      {
        position: 2, delayDays: 0, delayHours: 1, messageType: "email",
        subject: "You're Registered! RE Agent Exclusive Webinar — [WEBINAR DATE] ✅",
        content: "Hi {{firstName}},\n\nYou're officially registered for our Exclusive RE Agent Programs Webinar!\n\n📅 DATE: [WEBINAR DATE]\n⏰ TIME: [WEBINAR TIME]\n🔗 JOIN LINK: [WEBINAR LINK]\n\nWhat you'll learn:\n✅ Specialized programs your buyers probably don't know about (DPA, one-time close, bank statement, VA)\n✅ How to use these programs to win more listings and close more deals\n✅ Co-marketing strategies that generate leads for both of us\n✅ Live Q&A with Tim Haskins\n\nThis is exclusively for real estate professionals — bring your questions!\n\nSee you there,\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 3, delayDays: 4, messageType: "email",
        subject: "One Week Away — RE Agent Webinar Reminder, {{firstName}}",
        content: "Hi {{firstName}},\n\nJust one week until our Exclusive RE Agent Programs Webinar!\n\n📅 [WEBINAR DATE] at [WEBINAR TIME]\n🔗 [WEBINAR LINK]\n\nWe'll be covering programs and strategies that top-producing agents are using to close more deals and serve more buyers. These are tools that give your clients a competitive edge — and make you look like a hero.\n\nMark your calendar and we'll see you there!\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 4, delayDays: 3, messageType: "sms",
        content: "{{firstName}}! Just 3 days until our RE Agent Webinar on [WEBINAR DATE] 🏡 We'll cover programs that help YOUR buyers qualify and close faster. Don't miss it! [WEBINAR LINK]",
      },
      {
        position: 5, delayDays: 2, messageType: "email",
        subject: "Tomorrow: Grow Your Business at Our RE Agent Webinar, {{firstName}}",
        content: "Hi {{firstName}},\n\nTomorrow is the day! 🎉\n\n📅 [WEBINAR DATE] at [WEBINAR TIME]\n🔗 JOIN HERE: [WEBINAR LINK]\n\nIn just one hour you'll learn:\n• Programs that help your buyers get in with 0-3.5% down\n• How to use lender programs as a listing tool\n• Co-marketing opportunities to grow your business\n• Live answers to your specific questions\n\nWe'll see you tomorrow!\n\nTim Haskins | Premier Mortgage Resources",
      },
      {
        position: 6, delayDays: 1, messageType: "sms",
        content: "Good morning {{firstName}}! Today's the day — RE Agent Webinar at [WEBINAR TIME] 🏠 Top agents are using these programs to close more deals. Join us: [WEBINAR LINK]",
      },
      {
        position: 7, delayDays: 0, delayHours: 23, messageType: "sms",
        content: "{{firstName}} — just 1 HOUR until we start! 🕐 Jump in here: [WEBINAR LINK] We'll be covering programs that help your buyers qualify and close faster. See you in 60 minutes! — Tim, PMR",
      },
      {
        position: 8, delayDays: 0, delayHours: 1, messageType: "sms",
        content: "We're starting in 5 MINUTES, {{firstName}}! Join NOW — it's not too late! 🚀 [WEBINAR LINK] Don't miss these agent-exclusive strategies from Tim Haskins at PMR!",
      },
      {
        position: 9, delayDays: 1, messageType: "email",
        subject: "Thank You for Attending — Let's Build Something Together, {{firstName}}",
        content: "Hi {{firstName}},\n\nThank you so much for joining our RE Agent Programs Webinar!\n\nWe hope you left with actionable strategies to help your buyers and grow your business.\n\n🎯 YOUR NEXT STEP:\nBook a FREE co-marketing meeting with Tim to explore how we can work together — co-branded materials, joint open houses, shared lead generation, and more.\n\nSpots are limited — book now while this is top of mind:\n[CALENDAR LINK]\n\nLooking forward to partnering with you!\n\nTim Haskins | Premier Mortgage Resources",
      },
    ],
  },
];

// ─────────────────────────────────────────────
// WORKFLOW DEFINITIONS
// ─────────────────────────────────────────────

interface WorkflowDef {
  name: string;
  triggerType: string;
  triggerConfig: string | null;
  actionType: string;
  /** Will be set dynamically after sequences are created */
  sequenceId?: number;
}

// ─────────────────────────────────────────────
// LANDING PAGE HTML
// ─────────────────────────────────────────────

const DPA_WEBINAR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Free Down Payment Assistance Webinar | Premier Mortgage Resources</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;line-height:1.6}
.header{background:linear-gradient(135deg,#0a1628,#1a3a5c);color:#fff;padding:20px 0;text-align:center}
.header .badge{display:inline-block;background:#e8b923;color:#0a1628;padding:6px 18px;border-radius:20px;font-weight:700;font-size:14px;margin-bottom:10px;text-transform:uppercase}
.header h1{font-size:18px;font-weight:400;letter-spacing:1px}
.hero{background:linear-gradient(135deg,#0d2137,#1a4a6e);color:#fff;padding:60px 20px;text-align:center}
.hero h2{font-size:clamp(24px,5vw,42px);max-width:800px;margin:0 auto 20px;line-height:1.2}
.hero .date-box{display:inline-block;background:rgba(255,255,255,0.15);border:2px solid #e8b923;border-radius:12px;padding:15px 30px;margin:20px 0;font-size:20px}
.hero .date-box strong{color:#e8b923}
.section{max-width:800px;margin:0 auto;padding:50px 20px}
.section h3{font-size:28px;color:#0a1628;margin-bottom:20px;text-align:center}
.learn-list{list-style:none;padding:0}
.learn-list li{padding:12px 0 12px 40px;position:relative;font-size:17px}
.learn-list li::before{content:'✅';position:absolute;left:0;top:12px}
.about{background:#f8f9fa;padding:50px 20px}
.about-inner{max-width:800px;margin:0 auto;display:flex;gap:30px;align-items:center;flex-wrap:wrap}
.about-photo{width:150px;height:150px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:14px;color:#666;flex-shrink:0}
.about-text h3{margin-bottom:10px;color:#0a1628}
.form-section{background:linear-gradient(135deg,#0a1628,#1a3a5c);color:#fff;padding:60px 20px;text-align:center}
.form-section h3{color:#fff;margin-bottom:30px;font-size:28px}
.form-box{max-width:500px;margin:0 auto;display:flex;flex-direction:column;gap:15px}
.form-box input{padding:14px 18px;border:2px solid rgba(255,255,255,0.3);border-radius:8px;font-size:16px;background:rgba(255,255,255,0.1);color:#fff}
.form-box input::placeholder{color:rgba(255,255,255,0.6)}
.form-box button{padding:16px;background:#e8b923;color:#0a1628;border:none;border-radius:8px;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.2s}
.form-box button:hover{transform:scale(1.02)}
.footer{background:#0a1628;color:rgba(255,255,255,0.7);text-align:center;padding:30px 20px;font-size:14px}
@media(max-width:600px){.about-inner{flex-direction:column;text-align:center}.about-photo{margin:0 auto}}
</style>
</head>
<body>
<div class="header">
<div class="badge">FREE WEBINAR</div>
<h1>PREMIER MORTGAGE RESOURCES</h1>
</div>
<div class="hero">
<h2>Discover How to Buy a Home With Little to No Money Down</h2>
<div class="date-box">📅 <strong>[WEBINAR DATE]</strong> at ⏰ <strong>[WEBINAR TIME]</strong></div>
<p style="margin-top:15px;font-size:18px;opacity:0.9">Join Tim Haskins for a FREE live session on Down Payment Assistance programs</p>
</div>
<div class="section">
<h3>What You'll Learn</h3>
<ul class="learn-list">
<li>Down payment assistance programs available right now in your area</li>
<li>How to buy a home with 0% to 3.5% down — yes, really</li>
<li>Programs that include forgivable grants (free money you never pay back!)</li>
<li>Qualification requirements — you may already qualify and not know it</li>
<li>Live Q&A with Tim Haskins — get your specific questions answered</li>
</ul>
</div>
<div class="about">
<div class="about-inner">
<div class="about-photo">[Photo]</div>
<div class="about-text">
<h3>About Tim Haskins</h3>
<p>Tim Haskins is a Loan Officer with Premier Mortgage Resources, specializing in helping first-time homebuyers and families access programs that make homeownership affordable. With access to 30+ lenders and deep expertise in DPA programs, Tim has helped hundreds of families achieve their dream of homeownership.</p>
</div>
</div>
</div>
<div class="form-section">
<h3>Reserve Your Spot Now</h3>
<div class="form-box">
<input type="text" placeholder="First Name" required>
<input type="text" placeholder="Last Name" required>
<input type="email" placeholder="Email Address" required>
<input type="tel" placeholder="Phone Number" required>
<button type="submit">Reserve My Spot Now →</button>
</div>
</div>
<div class="footer">
<p>Premier Mortgage Resources | Tim Haskins, Loan Officer</p>
<p style="margin-top:8px">📞 Call or Text Anytime | 📧 tim@pmr.com</p>
</div>
</body>
</html>`;

const RE_AGENT_WEBINAR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exclusive RE Agent Programs Webinar | Premier Mortgage Resources</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;line-height:1.6}
.header{background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:20px 0;text-align:center}
.header .badge{display:inline-block;background:#00b4d8;color:#fff;padding:6px 18px;border-radius:20px;font-weight:700;font-size:14px;margin-bottom:10px;text-transform:uppercase}
.header h1{font-size:18px;font-weight:400;letter-spacing:1px}
.hero{background:linear-gradient(135deg,#16213e,#0f3460);color:#fff;padding:60px 20px;text-align:center}
.hero h2{font-size:clamp(24px,5vw,42px);max-width:800px;margin:0 auto 20px;line-height:1.2}
.hero .date-box{display:inline-block;background:rgba(255,255,255,0.15);border:2px solid #00b4d8;border-radius:12px;padding:15px 30px;margin:20px 0;font-size:20px}
.hero .date-box strong{color:#00b4d8}
.section{max-width:800px;margin:0 auto;padding:50px 20px}
.section h3{font-size:28px;color:#1a1a2e;margin-bottom:20px;text-align:center}
.learn-list{list-style:none;padding:0}
.learn-list li{padding:12px 0 12px 40px;position:relative;font-size:17px}
.learn-list li::before{content:'✅';position:absolute;left:0;top:12px}
.about{background:#f8f9fa;padding:50px 20px}
.about-inner{max-width:800px;margin:0 auto;display:flex;gap:30px;align-items:center;flex-wrap:wrap}
.about-photo{width:150px;height:150px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:14px;color:#666;flex-shrink:0}
.about-text h3{margin-bottom:10px;color:#1a1a2e}
.form-section{background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:60px 20px;text-align:center}
.form-section h3{color:#fff;margin-bottom:30px;font-size:28px}
.form-box{max-width:500px;margin:0 auto;display:flex;flex-direction:column;gap:15px}
.form-box input{padding:14px 18px;border:2px solid rgba(255,255,255,0.3);border-radius:8px;font-size:16px;background:rgba(255,255,255,0.1);color:#fff}
.form-box input::placeholder{color:rgba(255,255,255,0.6)}
.form-box button{padding:16px;background:#00b4d8;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.2s}
.form-box button:hover{transform:scale(1.02)}
.footer{background:#1a1a2e;color:rgba(255,255,255,0.7);text-align:center;padding:30px 20px;font-size:14px}
@media(max-width:600px){.about-inner{flex-direction:column;text-align:center}.about-photo{margin:0 auto}}
</style>
</head>
<body>
<div class="header">
<div class="badge">EXCLUSIVE FOR RE AGENTS</div>
<h1>PREMIER MORTGAGE RESOURCES</h1>
</div>
<div class="hero">
<h2>Discover Little-Known Programs That Help Your Clients Qualify and Close</h2>
<div class="date-box">📅 <strong>[WEBINAR DATE]</strong> at ⏰ <strong>[WEBINAR TIME]</strong></div>
<p style="margin-top:15px;font-size:18px;opacity:0.9">An exclusive session for real estate professionals with Tim Haskins</p>
</div>
<div class="section">
<h3>What You'll Learn</h3>
<ul class="learn-list">
<li>Specialized programs most agents don't know about (DPA, one-time close, bank statement, VA)</li>
<li>How to use lender programs as a competitive listing tool</li>
<li>Co-marketing strategies that generate leads for both of us</li>
<li>How to help buyers who think they can't afford to buy</li>
<li>Live Q&A with Tim Haskins — bring your toughest scenarios</li>
</ul>
</div>
<div class="about">
<div class="about-inner">
<div class="about-photo">[Photo]</div>
<div class="about-text">
<h3>About Tim Haskins</h3>
<p>Tim Haskins is a Loan Officer with Premier Mortgage Resources who partners with top-producing real estate agents to help their clients close faster and more reliably. With 21-day average closings, same-day pre-approvals, and access to 30+ lenders, Tim makes agents look great and buyers feel confident.</p>
</div>
</div>
</div>
<div class="form-section">
<h3>Reserve Your Spot Now</h3>
<div class="form-box">
<input type="text" placeholder="First Name" required>
<input type="text" placeholder="Last Name" required>
<input type="email" placeholder="Email Address" required>
<input type="tel" placeholder="Phone Number" required>
<button type="submit">Reserve My Spot Now →</button>
</div>
</div>
<div class="footer">
<p>Premier Mortgage Resources | Tim Haskins, Loan Officer</p>
<p style="margin-top:8px">📞 Call or Text Anytime | 📧 tim@pmr.com</p>
</div>
</body>
</html>`;

// ─────────────────────────────────────────────
// MAIN SEEDER
// ─────────────────────────────────────────────

async function seedPMRSequences() {
  console.log("🚀 Starting PMR Sequence Seeder...\n");

  // Step 1: Find PMR account
  const pmrAccount = await findPMRAccount();
  const PMR_ACCOUNT_ID = pmrAccount.id;
  console.log(`📋 PMR Account: "${pmrAccount.name}" (ID: ${PMR_ACCOUNT_ID})\n`);

  // Step 2: Find PMR owner user for createdById
  const ownerId = await findPMROwner(PMR_ACCOUNT_ID);
  console.log(`👤 PMR Owner User ID: ${ownerId}\n`);

  // Step 3: Create all 10 sequences
  console.log("📝 Creating sequences...");
  const sequenceIds: number[] = [];
  for (const seqDef of SEQUENCES) {
    const seqId = await createSeqWithSteps(PMR_ACCOUNT_ID, seqDef);
    sequenceIds.push(seqId);
  }
  console.log(`\n✅ ${sequenceIds.length} sequences created\n`);

  // Step 4: Create trigger workflows (one per sequence)
  console.log("⚡ Creating trigger workflows...");
  const triggerWorkflows: { name: string; tag: string; seqId: number }[] = [
    { name: "Auto: Enroll — 6Mo Refi Check-In", tag: "refi-6mo-check", seqId: sequenceIds[0] },
    { name: "Auto: Enroll — 12Mo Refi Check-In", tag: "refi-12mo-check", seqId: sequenceIds[1] },
    { name: "Auto: Enroll — Happy Birthday", tag: "happy-birthday", seqId: sequenceIds[2] },
    { name: "Auto: Enroll — Warm RE Agent", tag: "warm-re-agent", seqId: sequenceIds[3] },
    { name: "Auto: Enroll — Cold RE Agent", tag: "cold-re-agent", seqId: sequenceIds[4] },
    { name: "Auto: Enroll — Credit Repair", tag: "credit-repair-nurture", seqId: sequenceIds[5] },
    { name: "Auto: Enroll — HELOC Nurture", tag: "heloc-nurture", seqId: sequenceIds[6] },
    { name: "Auto: Enroll — Purchase Nurture", tag: "purchase-nurture", seqId: sequenceIds[7] },
    { name: "Auto: Enroll — DPA Webinar", tag: "dpa-webinar-registered", seqId: sequenceIds[8] },
    { name: "Auto: Enroll — RE Agent Webinar", tag: "re-agent-webinar-registered", seqId: sequenceIds[9] },
  ];

  let workflowCount = 0;
  for (const tw of triggerWorkflows) {
    const { id: wfId } = await createWorkflow({
      accountId: PMR_ACCOUNT_ID,
      name: tw.name,
      triggerType: "tag_added",
      triggerConfig: JSON.stringify({ tag: tw.tag }),
      isActive: true,
      createdById: ownerId,
    });
    await createWorkflowStep({
      workflowId: Number(wfId),
      stepType: "action",
      stepOrder: 1,
      actionType: "enroll_in_sequence",
      config: JSON.stringify({ sequenceId: tw.seqId }),
    });
    workflowCount++;
    console.log(`  ✅ Workflow "${tw.name}" → Sequence ID ${tw.seqId}`);
  }
  console.log(`\n✅ ${workflowCount} trigger workflows created\n`);

  // Step 5: Create auto-stop workflows
  console.log("🛑 Creating auto-stop workflows...");

  // Workflow 11: Unenroll on Qualified
  const { id: wf11Id } = await createWorkflow({
    accountId: PMR_ACCOUNT_ID,
    name: "Auto: Unenroll All Sequences on Qualified",
    triggerType: "pipeline_stage_changed",
    triggerConfig: JSON.stringify({ stageName: "qualified" }),
    isActive: true,
    createdById: ownerId,
  });
  await createWorkflowStep({
    workflowId: Number(wf11Id),
    stepType: "action",
    stepOrder: 1,
    actionType: "unenroll_from_sequence",
    config: JSON.stringify({}),
  });
  console.log("  ✅ Auto: Unenroll All Sequences on Qualified");

  // Workflow 12: Unenroll on Appointment Booked
  const { id: wf12Id } = await createWorkflow({
    accountId: PMR_ACCOUNT_ID,
    name: "Auto: Unenroll All Sequences on Appointment Booked",
    triggerType: "appointment_booked",
    triggerConfig: null,
    isActive: true,
    createdById: ownerId,
  });
  await createWorkflowStep({
    workflowId: Number(wf12Id),
    stepType: "action",
    stepOrder: 1,
    actionType: "unenroll_from_sequence",
    config: JSON.stringify({}),
  });
  console.log("  ✅ Auto: Unenroll All Sequences on Appointment Booked");
  console.log("\n✅ 2 auto-stop workflows created\n");

  // Step 6: Create landing pages
  console.log("📄 Creating landing pages...");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(landingPages).values({
    accountId: PMR_ACCOUNT_ID,
    slug: "dpa-webinar",
    title: "Free Down Payment Assistance Webinar",
    metaDescription: "Join Tim Haskins for a FREE live webinar on Down Payment Assistance programs. Learn how to buy a home with little to no money down.",
    htmlContent: DPA_WEBINAR_HTML,
    status: "published",
    publishedAt: new Date(),
  });
  console.log("  ✅ Landing Page: DPA Borrower Webinar (slug: dpa-webinar)");

  await db.insert(landingPages).values({
    accountId: PMR_ACCOUNT_ID,
    slug: "re-agent-webinar",
    title: "Exclusive RE Agent Programs Webinar",
    metaDescription: "Exclusive webinar for real estate agents — discover little-known programs that help your clients qualify and close faster.",
    htmlContent: RE_AGENT_WEBINAR_HTML,
    status: "published",
    publishedAt: new Date(),
  });
  console.log("  ✅ Landing Page: RE Agent Webinar (slug: re-agent-webinar)");
  console.log("\n✅ 2 landing pages created\n");

  // Step 7: Belinda Osborne account setup
  console.log("👩 Setting up Belinda Osborne...");
  const belindaAccounts = await db
    .select()
    .from(accounts)
    .where(or(like(accounts.name, "%Belinda%"), like(accounts.name, "%Osborne%")));

  if (belindaAccounts.length === 0) {
    console.log("  ⚠️  No Belinda Osborne account found. Skipping Belinda setup.");
    console.log("     Create an account with 'Belinda' or 'Osborne' in the name to enable this.");
  } else {
    const belindaAccount = belindaAccounts[0];
    console.log(`  📋 Belinda's Account: "${belindaAccount.name}" (ID: ${belindaAccount.id})`);

    // Find Belinda's user
    const belindaMembers = await db
      .select()
      .from(accountMembers)
      .where(eq(accountMembers.accountId, belindaAccount.id));

    if (belindaMembers.length === 0) {
      console.log("  ⚠️  No members found in Belinda's account. Skipping user association.");
    } else {
      const belindaUserId = belindaMembers[0].userId;
      console.log(`  👤 Belinda's User ID: ${belindaUserId}`);

      // Check if Belinda is already a member of PMR
      const existingMembership = await db
        .select()
        .from(accountMembers)
        .where(
          and(
            eq(accountMembers.accountId, PMR_ACCOUNT_ID),
            eq(accountMembers.userId, belindaUserId)
          )
        );

      if (existingMembership.length > 0) {
        console.log("  ℹ️  Belinda is already a member of the PMR account. Skipping insert.");
      } else {
        await db.insert(accountMembers).values({
          accountId: PMR_ACCOUNT_ID,
          userId: belindaUserId,
          role: "employee",
          isActive: true,
        });
        console.log("  ✅ Belinda added as employee to PMR account");
      }

      // Create lead routing workflow
      // TODO: Full contact sync to Belinda account requires cross-account contact copy — implemented via notification for now.
      const { id: routeWfId } = await createWorkflow({
        accountId: PMR_ACCOUNT_ID,
        name: "Auto: Route New Leads to Belinda's Account",
        triggerType: "contact_created",
        triggerConfig: null,
        isActive: true,
        createdById: ownerId,
      });

      // Step 1: Tag as routed-to-belinda
      await createWorkflowStep({
        workflowId: Number(routeWfId),
        stepType: "action",
        stepOrder: 1,
        actionType: "add_tag",
        config: JSON.stringify({ tag: "routed-to-belinda" }),
      });

      // Step 2: Notify Belinda
      await createWorkflowStep({
        workflowId: Number(routeWfId),
        stepType: "action",
        stepOrder: 2,
        actionType: "notify_user",
        config: JSON.stringify({
          message: "New lead assigned to you: {{firstName}} {{lastName}} — {{phone}} / {{email}}",
          userId: belindaUserId,
        }),
      });

      console.log("  ✅ Lead routing workflow created (tag + notify Belinda)");
    }
  }

  // Summary
  const totalSteps = SEQUENCES.reduce((sum, s) => sum + s.steps.length, 0);
  console.log("\n" + "═".repeat(50));
  console.log("📊 SEEDER SUMMARY");
  console.log("═".repeat(50));
  console.log(`  Sequences created:       ${sequenceIds.length}`);
  console.log(`  Total sequence steps:     ${totalSteps}`);
  console.log(`  Trigger workflows:        ${workflowCount}`);
  console.log(`  Auto-stop workflows:      2`);
  console.log(`  Landing pages:            2`);
  console.log("═".repeat(50));
}

// ─────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────

seedPMRSequences()
  .then(() => {
    console.log("\n✅ PMR sequences seeded successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Seeder failed:", err);
    process.exit(1);
  });
