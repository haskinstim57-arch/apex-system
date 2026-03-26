/**
 * 3-Account Sales Engine Setup Script
 * Creates campaigns, phone scripts, and workflow automations for:
 * 1. Apex System (450002) - Cold Outreach workflow
 * 2. Optimal Lending Solutions (390025) - DSCR + Fix & Flip
 * 3. Premier Mortgage Resources (420001) - 5 campaign sequences
 */
import http from "http";

const BASE = "http://localhost:3000/api/internal/setup-outbound";

function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        try { resolve(JSON.parse(buf)); } catch { resolve({ raw: buf }); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════
// ACCOUNT IDs & USER IDs
// ═══════════════════════════════════════════════════════════
const APEX = { accountId: 450002, userId: 1110566 }; // Tariq
const KYLE = { accountId: 390025, userId: 903188 };  // Kyle
const PMR  = { accountId: 420001, userId: 1110566 };  // Tim (using Tariq's userId since no member exists)

// Track created campaign IDs for workflow references
const campaignIds = {};

// ═══════════════════════════════════════════════════════════
// 1. APEX SYSTEM — Cold Outreach Workflow
// (Campaigns already exist: email 30001-30004, sms 30005-30008)
// ═══════════════════════════════════════════════════════════
async function setupApexSystem() {
  console.log("\n═══ ACCOUNT 1: APEX SYSTEM (Cold Outreach Workflow) ═══");

  // Create workflow: When contact created/imported with tag "Cold Outreach"
  const wf = await post({
    action: "create_workflow",
    ...APEX,
    name: "Cold Outreach Auto-Enrollment",
    description: "Triggers when a contact is created or imported with the tag 'Cold Outreach'. Assigns to Cold Outreach pipeline stage, enrolls in Email + SMS campaigns, and notifies assigned user to begin Power Dialer sequence.",
    triggerType: "tag_added",
    triggerConfig: { tag: "Cold Outreach" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "assign_pipeline_stage",
        config: { pipelineStage: "Cold Outreach" },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: 30001 }, // Apex Cold Outreach — Email Step 1
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: 30005 }, // Apex Cold Outreach — SMS Step 1
      },
      {
        stepOrder: 4,
        stepType: "action",
        actionType: "notify_user",
        config: {
          title: "New Cold Outreach Lead — Start Power Dialer",
          body: "{{firstName}} {{lastName}} has been enrolled in the Cold Outreach sequence. Begin the Power Dialer sequence now.",
          notificationType: "lead_action_required",
        },
      },
    ],
  });
  console.log("  Workflow:", JSON.stringify(wf));
}

// ═══════════════════════════════════════════════════════════
// 2. OPTIMAL LENDING SOLUTIONS (Kyle)
// ═══════════════════════════════════════════════════════════
async function setupOptimalLending() {
  console.log("\n═══ ACCOUNT 2: OPTIMAL LENDING SOLUTIONS (Kyle) ═══");

  const DISCLAIMER = "\n\n---\nOptimal Lending Solutions is a commercial loan advisory firm. All loans are for business and investment purposes only. We do not provide personal residential mortgages. Borrowers must close in an LLC or other legal business entity. No owner-occupied properties.";
  const SIGN_DSCR_1 = "\n\nBest,\nKyle Dombecki\nFounder, Optimal Lending Solutions\nWhere smart lending meets real solutions.";
  const SIGN = "\n\nBest,\nKyle Dombecki\nOptimal Lending Solutions";

  // ── DSCR Email Campaign ──
  console.log("  Creating DSCR Email Campaign...");
  const dscrEmail = await post({
    action: "create_email_campaign",
    ...KYLE,
    campaignName: "Optimal Lending - DSCR Email",
    fromAddress: "info@optimallendingsolutions.com",
    steps: [
      {
        stepNum: 1, dayOffset: 1,
        subject: "Your DSCR Loan Info (No W2s required)",
        body: `Hi {{firstName}},\n\nThanks for requesting information on our DSCR loan programs at Optimal Lending Solutions.\n\nIf you are looking to scale your rental portfolio, the DSCR (Debt Service Coverage Ratio) loan is the most powerful tool available. Traditional banks look at your personal income, tax returns, and debt-to-income ratio. We don't.\n\nWe qualify the loan based entirely on the property's ability to generate rental income. If the rent covers the mortgage payment, you qualify.\n\nHere is what you need to know:\n- No personal income verification (No W2s, No Tax Returns)\n- Close in the name of your LLC\n- Fast 2-3 week closings\n- Single-Family and Multi-Family properties eligible\n\nAre you currently looking at a specific property, or just getting your financing lined up for your next move?${SIGN_DSCR_1}${DISCLAIMER}`,
      },
      {
        stepNum: 2, dayOffset: 3,
        subject: "How we calculate your DSCR loan",
        body: `Hi {{firstName}},\n\nA lot of investors ask me exactly how we calculate the numbers for a DSCR loan, so I wanted to break it down simply.\n\nWe look at one main metric: Does the monthly rental income cover the monthly mortgage payment (Principal, Interest, Taxes, and Insurance)?\n\nIf the property generates 25% more income than the mortgage payment (a 1.25 ratio), it is considered a highly qualified deal. Even if it just breaks even (a 1.00 ratio), we can often still get it funded.\n\nBecause we don't look at your personal debt-to-income ratio, there is no limit to how many properties you can finance this way.\n\nIf you have a property in mind, reply to this email with the purchase price and the estimated monthly rent, and I will run the numbers for you today.${SIGN}${DISCLAIMER}`,
      },
      {
        stepNum: 3, dayOffset: 6,
        subject: "Speed and reliability in your next deal",
        body: `Hi {{firstName}},\n\nIn real estate investing, the lowest rate doesn't matter if the lender can't close the deal on time.\n\nAt Optimal Lending Solutions, we are commercial loan advisors. We don't just take applications; we structure deals strategically to ensure they actually cross the finish line. We know that losing a deal because of a slow bank is the most frustrating experience for an investor.\n\nWe are currently closing DSCR loans in 2 to 3 weeks.\n\nIf you want to review your current portfolio or discuss a new acquisition, let's schedule a quick 10-minute call. You can book a time directly on my calendar here: [Insert Calendar Link]${SIGN}${DISCLAIMER}`,
      },
    ],
  });
  console.log("  DSCR Email IDs:", JSON.stringify(dscrEmail));
  campaignIds.kyle_dscr_email = dscrEmail.campaignIds;

  // ── DSCR SMS Campaign ──
  console.log("  Creating DSCR SMS Campaign...");
  const dscrSms = await post({
    action: "create_sms_campaign",
    ...KYLE,
    campaignName: "Optimal Lending - DSCR SMS",
    steps: [
      {
        stepNum: 1, dayOffset: 0,
        body: "Hey {{firstName}}, it's Kyle with Optimal Lending Solutions. Saw you just requested info on our DSCR loans. Are you looking to purchase a new rental property or refinance an existing one?",
      },
      {
        stepNum: 2, dayOffset: 2,
        body: "Hey {{firstName}}, following up on the DSCR info. The biggest advantage right now is we don't need your tax returns or W2s to qualify — we just look at the property's cash flow. Do you have a specific property under contract right now?",
      },
      {
        stepNum: 3, dayOffset: 4,
        body: "Just a quick heads up {{firstName}}, we are currently closing DSCR loans in 2-3 weeks inside an LLC. If you want me to run some quick numbers on a deal you're looking at, just reply with the purchase price and estimated rent.",
      },
      {
        stepNum: 4, dayOffset: 7,
        body: "Hey {{firstName}}, I'll stop bugging you after this. If you ever need fast, reliable capital to scale your rental portfolio without the traditional bank headaches, keep my number saved. Have a great week!",
      },
    ],
  });
  console.log("  DSCR SMS IDs:", JSON.stringify(dscrSms));
  campaignIds.kyle_dscr_sms = dscrSms.campaignIds;

  // ── Fix & Flip Email Campaign ──
  console.log("  Creating Fix & Flip Email Campaign...");
  const ffEmail = await post({
    action: "create_email_campaign",
    ...KYLE,
    campaignName: "Optimal Lending - Fix & Flip Email",
    fromAddress: "info@optimallendingsolutions.com",
    steps: [
      {
        stepNum: 1, dayOffset: 1,
        subject: "Your Fix & Flip Financing Info",
        body: `Hi {{firstName}},\n\nThanks for reaching out regarding our Fix & Flip loan programs at Optimal Lending Solutions.\n\nIn the flipping business, speed is your biggest advantage. If you can't close quickly, you lose the deal to a cash buyer. Our Fix & Flip loans are designed to give you the leverage of a bank with the speed of hard money.\n\nHere is what our program looks like:\n- Up to 90% of the Purchase Price covered\n- Up to 100% of the Rehab Costs covered\n- Interest-Only Payments to keep your holding costs low\n- Fast 2-3 week closings\n- 6 to 24-month loan terms\n\nWe do not require personal income verification. We base the loan on the After Repair Value (ARV) of the property and your scope of work.\n\nAre you currently bidding on a property, or just getting your capital ready?${SIGN_DSCR_1}${DISCLAIMER}`,
      },
      {
        stepNum: 2, dayOffset: 3,
        subject: "How we fund your rehab costs",
        body: `Hi {{firstName}},\n\nOne of the biggest hurdles for flippers is managing cash flow during the renovation.\n\nWith our Fix & Flip program, we can fund up to 100% of your rehab budget. The funds are held in escrow and released to you in "draws" as you complete different stages of the construction.\n\nThis means you can keep your own liquid capital in the bank for emergencies or use it to acquire your next property, rather than tying it all up in drywall and plumbing.\n\nIf you have a deal you are analyzing right now, reply with the Purchase Price, the Rehab Budget, and the estimated After Repair Value (ARV), and I will tell you exactly how much capital we can provide.${SIGN}${DISCLAIMER}`,
      },
      {
        stepNum: 3, dayOffset: 6,
        subject: "Stop losing deals to cash buyers",
        body: `Hi {{firstName}},\n\nThe market moves fast, and sellers want certainty. When you partner with Optimal Lending Solutions, you can make offers with confidence knowing you have reliable capital backing you up.\n\nWe close deals in 2 to 3 weeks, allowing you to compete directly with all-cash offers.\n\nWe are commercial loan advisors, which means we don't just process paperwork. We review your scope of work, analyze the ARV, and structure the capital so your project is profitable.\n\nLet's jump on a quick 10-minute call to discuss your investment strategy and get you pre-approved for your next flip. You can grab a time on my calendar here: [Insert Calendar Link]${SIGN}${DISCLAIMER}`,
      },
    ],
  });
  console.log("  Fix & Flip Email IDs:", JSON.stringify(ffEmail));
  campaignIds.kyle_ff_email = ffEmail.campaignIds;

  // ── Fix & Flip SMS Campaign ──
  console.log("  Creating Fix & Flip SMS Campaign...");
  const ffSms = await post({
    action: "create_sms_campaign",
    ...KYLE,
    campaignName: "Optimal Lending - Fix & Flip SMS",
    steps: [
      {
        stepNum: 1, dayOffset: 0,
        body: "Hey {{firstName}}, it's Kyle with Optimal Lending Solutions. Saw you requested info on our Fix & Flip financing. Are you looking to fund a new acquisition or do you already own the property?",
      },
      {
        stepNum: 2, dayOffset: 2,
        body: "Hey {{firstName}}, just following up. We are currently funding up to 90% of the purchase price and 100% of the rehab costs for flip projects. Do you have a specific property under contract right now?",
      },
      {
        stepNum: 3, dayOffset: 4,
        body: "Quick reminder {{firstName}} — our Fix & Flip loans close in 2-3 weeks, which helps you stop losing deals to all-cash buyers. If you have a scope of work and a purchase price, reply here and I can give you a quick estimate on leverage.",
      },
      {
        stepNum: 4, dayOffset: 7,
        body: "Hey {{firstName}}, I'll close out your file for now. If you ever need fast capital to take down a distressed property and fund the rehab, keep my contact info handy. Let's get a deal done in the future!",
      },
    ],
  });
  console.log("  Fix & Flip SMS IDs:", JSON.stringify(ffSms));
  campaignIds.kyle_ff_sms = ffSms.campaignIds;

  // ── Phone Script ──
  console.log("  Creating Kyle's Phone Script...");
  const script = await post({
    action: "create_dialer_script",
    ...KYLE,
    name: "Optimal Lending - Investor Call Script",
    content: `THE OPENER (Within 5 minutes of lead submission):
"Hey {{firstName}}, this is Kyle with Optimal Lending Solutions. I saw you just requested some information online about our [DSCR / Fix & Flip] loan programs. I know you're probably busy, but I wanted to reach out immediately to see what kind of project you are working on right now?"

DISCOVERY QUESTIONS (Listen more than you talk):
• "Are you currently looking at a specific property, or just getting your financing lined up?"
• "What is your primary investment strategy right now? Are you holding for rental income or flipping for fast capital?"
• "Have you used private commercial lending before, or have you mostly worked with traditional banks?"

HANDLING THE "RATE" OBJECTION:
Investor: "What are your rates right now? I want the lowest rate."
Kyle: "I completely understand, everyone wants the best rate possible. What most investors find, though, is that the lowest rate isn't always the best deal if the lender can't close quickly or reliably. Our focus is making sure the deal actually closes on time in 2 to 3 weeks so you don't lose the property. Tell me a bit about the numbers on the deal you're looking at."

HANDLING THE "SHOPPING AROUND" OBJECTION:
Investor: "I'm just shopping around right now."
Kyle: "That's completely normal. Most investors talk to a few lenders before deciding. My goal is just to understand your deal and see if we can structure something that makes sense for your investment. What kind of property are you looking at right now?"

THE CLOSE (Moving to the next step):
"It sounds like we can definitely help you structure the capital for this. The next step is simple — if you can send over the property address, the purchase price, and [estimated rent / rehab budget], I can run the numbers on my end and give you a clear breakdown of the leverage and terms we can offer. Does that sound fair?"`,
  });
  console.log("  Phone Script:", JSON.stringify(script));

  // ── DSCR Workflow ──
  console.log("  Creating DSCR Routing Workflow...");
  const dscrWf = await post({
    action: "create_workflow",
    ...KYLE,
    name: "DSCR Lead Routing",
    description: "Routes Meta Ad leads tagged 'DSCR' to the DSCR sequence and notifies Kyle to call within 5 minutes.",
    triggerType: "tag_added",
    triggerConfig: { tag: "DSCR" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "assign_pipeline_stage",
        config: { pipelineStage: "New Lead" },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.kyle_dscr_email[0] },
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.kyle_dscr_sms[0] },
      },
      {
        stepOrder: 4,
        stepType: "action",
        actionType: "notify_user",
        config: {
          title: "🔥 New DSCR Lead — Call within 5 minutes",
          body: "{{firstName}} {{lastName}} just submitted a DSCR loan inquiry via Meta Ads. Call them immediately!",
          notificationType: "lead_action_required",
        },
      },
    ],
  });
  console.log("  DSCR Workflow:", JSON.stringify(dscrWf));

  // ── Fix & Flip Workflow ──
  console.log("  Creating Fix & Flip Routing Workflow...");
  const ffWf = await post({
    action: "create_workflow",
    ...KYLE,
    name: "Fix & Flip Lead Routing",
    description: "Routes Meta Ad leads tagged 'Fix & Flip' to the Fix & Flip sequence and notifies Kyle to call within 5 minutes.",
    triggerType: "tag_added",
    triggerConfig: { tag: "Fix & Flip" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "assign_pipeline_stage",
        config: { pipelineStage: "New Lead" },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.kyle_ff_email[0] },
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.kyle_ff_sms[0] },
      },
      {
        stepOrder: 4,
        stepType: "action",
        actionType: "notify_user",
        config: {
          title: "🔥 New Fix & Flip Lead — Call within 5 minutes",
          body: "{{firstName}} {{lastName}} just submitted a Fix & Flip loan inquiry via Meta Ads. Call them immediately!",
          notificationType: "lead_action_required",
        },
      },
    ],
  });
  console.log("  Fix & Flip Workflow:", JSON.stringify(ffWf));
}

// ═══════════════════════════════════════════════════════════
// 3. PREMIER MORTGAGE RESOURCES (Tim Haskins)
// ═══════════════════════════════════════════════════════════
async function setupPMR() {
  console.log("\n═══ ACCOUNT 3: PREMIER MORTGAGE RESOURCES (Tim Haskins) ═══");

  const FOOTER = "\n\n---\n© Copyright 2025 Premier Mortgage Resources, LLC | Equal Housing Opportunity | NMLS ID 1169 | PMR is not affiliated with or an agency of the federal government. Not an offer to extend credit or a commitment to lend. Terms subject to change without notice. Not all branches or MLOs are licensed in all states. Tim Haskins NMLS #1116876.";
  const SIGN = "\n\nBest,\nTim Haskins\nPremier Mortgage Resources\nNMLS #1116876";
  const SIGN_SHORT = "\n\nBest,\nTim Haskins";

  // ═══ 1. FTHB Campaign ═══
  console.log("  Creating FTHB Email Campaign...");
  const fthbEmail = await post({
    action: "create_email_campaign",
    ...PMR,
    campaignName: "PMR - FTHB Email",
    fromAddress: "lockin@lockinloans.com",
    steps: [
      {
        stepNum: 1, dayOffset: 1,
        subject: "Your First Home: Where to start",
        body: `Hi {{firstName}},\n\nCongratulations on taking the first step toward buying your first home! I'm Tim Haskins with Premier Mortgage Resources, and my team specializes in helping first-time buyers navigate the market without the stress.\n\nThe biggest myth in real estate is that you need a 20% down payment. We have access to multiple loan programs designed specifically for first-time buyers that require significantly less down—sometimes as low as 3% or 3.5%.\n\nThe best way to start is to figure out exactly how much home you can comfortably afford. If you have 10 minutes this week, I'd love to run some quick numbers for you.\n\nYou can book a quick intro call on my calendar here: [Insert Calendar Link]${SIGN}${FOOTER}`,
      },
      {
        stepNum: 2, dayOffset: 3,
        subject: "The pre-approval advantage",
        body: `Hi {{firstName}},\n\nWhen you find the perfect house, you want to be able to make an offer immediately. In today's market, sellers won't even look at an offer unless you have a pre-approval letter in hand.\n\nGetting pre-approved is simple, free, and gives you a massive advantage. It tells you exactly what your monthly payment will be and shows sellers you are a serious buyer.\n\nYou can start the secure application process right on my website here: https://timhaskins.floify.com/\n\nLet me know if you have any questions!${SIGN_SHORT}${FOOTER}`,
      },
    ],
  });
  console.log("  FTHB Email IDs:", JSON.stringify(fthbEmail));
  campaignIds.pmr_fthb_email = fthbEmail.campaignIds;

  console.log("  Creating FTHB SMS Campaign...");
  const fthbSms = await post({
    action: "create_sms_campaign",
    ...PMR,
    campaignName: "PMR - FTHB SMS",
    steps: [
      {
        stepNum: 1, dayOffset: 0,
        body: "Hi {{firstName}}, it's Tim Haskins with Premier Mortgage Resources. Saw you requested info on buying your first home! Are you looking to buy in the next 3-6 months, or just starting to browse?",
      },
      {
        stepNum: 2, dayOffset: 2,
        body: "Hey {{firstName}}, a lot of first-time buyers think they need 20% down, but we have programs that require much less. Do you have a specific area or neighborhood you're looking at?",
      },
      {
        stepNum: 3, dayOffset: 4,
        body: "Just a quick heads up {{firstName}}, I'm hosting a free Homebuyer Workshop online soon that covers exactly how to get pre-approved and find hidden down payment assistance. Want me to send you the link to register?",
      },
    ],
  });
  console.log("  FTHB SMS IDs:", JSON.stringify(fthbSms));
  campaignIds.pmr_fthb_sms = fthbSms.campaignIds;

  // ═══ 2. DPA Webinar Campaign ═══
  console.log("  Creating DPA Webinar Email Campaign...");
  const dpaEmail = await post({
    action: "create_email_campaign",
    ...PMR,
    campaignName: "PMR - DPA Webinar Email",
    fromAddress: "lockin@lockinloans.com",
    steps: [
      {
        stepNum: 1, dayOffset: 0,
        subject: "Registration Confirmed: Down Payment Assistance Workshop",
        body: `Hi {{firstName}},\n\nYour spot is saved! Thank you for registering for our upcoming Down Payment Assistance Workshop.\n\nDuring this webinar, we are going to cover:\n- How to qualify for state and local DPA grants\n- Why you don't need 20% down to buy a home\n- The exact steps to get pre-approved this month\n\nI will send you the Zoom link the morning of the event. If you want to get a head start and see what you qualify for right now, you can apply securely here: https://timhaskins.floify.com/\n\nSee you soon,\nTim Haskins\nPremier Mortgage Resources\nNMLS #1116876${FOOTER}`,
      },
    ],
  });
  console.log("  DPA Email IDs:", JSON.stringify(dpaEmail));
  campaignIds.pmr_dpa_email = dpaEmail.campaignIds;

  console.log("  Creating DPA Webinar SMS Campaign...");
  const dpaSms = await post({
    action: "create_sms_campaign",
    ...PMR,
    campaignName: "PMR - DPA Webinar SMS",
    steps: [
      {
        stepNum: 1, dayOffset: 0,
        body: "Hi {{firstName}}, Tim Haskins here with PMR. Thanks for registering for the Down Payment Assistance Webinar! I'll send the link over shortly. Are you currently renting right now?",
      },
      {
        stepNum: 2, dayOffset: "webinar_day",
        body: "Hey {{firstName}}, our DPA Homebuyer Workshop is tonight! We'll be covering how to qualify for grants that cover your down payment. See you there!",
      },
      {
        stepNum: 3, dayOffset: "post_webinar",
        body: "Hey {{firstName}}, thanks for attending the workshop! Did you want me to run your numbers to see exactly how much down payment assistance you qualify for?",
      },
    ],
  });
  console.log("  DPA SMS IDs:", JSON.stringify(dpaSms));
  campaignIds.pmr_dpa_sms = dpaSms.campaignIds;

  // ═══ 3. Refinance Campaign ═══
  console.log("  Creating Refinance Email Campaign...");
  const refiEmail = await post({
    action: "create_email_campaign",
    ...PMR,
    campaignName: "PMR - Refinance Email",
    fromAddress: "lockin@lockinloans.com",
    steps: [
      {
        stepNum: 1, dayOffset: 1,
        subject: "Your Refinance Options",
        body: `Hi {{firstName}},\n\nThanks for requesting information on refinancing your home. I'm Tim Haskins with Premier Mortgage Resources.\n\nWhether your goal is to lower your monthly payment, shorten your loan term, or tap into your home's equity to pay off high-interest debt, we can structure a refinance that meets your financial goals.\n\nTo give you accurate numbers, I just need to know your estimated home value and your current mortgage balance.\n\nReply to this email with those two numbers, and I'll put together a custom savings analysis for you today.${SIGN}${FOOTER}`,
      },
    ],
  });
  console.log("  Refinance Email IDs:", JSON.stringify(refiEmail));
  campaignIds.pmr_refi_email = refiEmail.campaignIds;

  console.log("  Creating Refinance SMS Campaign...");
  const refiSms = await post({
    action: "create_sms_campaign",
    ...PMR,
    campaignName: "PMR - Refinance SMS",
    steps: [
      {
        stepNum: 1, dayOffset: 0,
        body: "Hi {{firstName}}, Tim Haskins with PMR here. Saw you requested info on refinancing. Are you looking to lower your rate, or pull cash out for home improvements/debt consolidation?",
      },
      {
        stepNum: 2, dayOffset: 2,
        body: "Hey {{firstName}}, just following up. If you can text me your estimated home value and current loan balance, I can run a quick scenario to show you how much you could save monthly.",
      },
    ],
  });
  console.log("  Refinance SMS IDs:", JSON.stringify(refiSms));
  campaignIds.pmr_refi_sms = refiSms.campaignIds;

  // ═══ 4. HELOC Campaign ═══
  console.log("  Creating HELOC Email Campaign...");
  const helocEmail = await post({
    action: "create_email_campaign",
    ...PMR,
    campaignName: "PMR - HELOC Email",
    fromAddress: "lockin@lockinloans.com",
    steps: [
      {
        stepNum: 1, dayOffset: 1,
        subject: "Unlocking your home's equity (HELOC info)",
        body: `Hi {{firstName}},\n\nThanks for reaching out about a Home Equity Line of Credit (HELOC). I'm Tim Haskins with Premier Mortgage Resources.\n\nA HELOC is one of the smartest financial tools available to homeowners. It allows you to tap into the equity you've built up in your home without touching the low interest rate on your primary mortgage.\n\nMost of our clients use a HELOC to:\n- Fund major home renovations\n- Consolidate high-interest credit card debt\n- Keep a safety net of liquid capital available\n\nIf you'd like to see exactly how much equity you can access, let's schedule a quick 5-minute call. You can book a time here: [Insert Calendar Link]${SIGN}${FOOTER}`,
      },
    ],
  });
  console.log("  HELOC Email IDs:", JSON.stringify(helocEmail));
  campaignIds.pmr_heloc_email = helocEmail.campaignIds;

  console.log("  Creating HELOC SMS Campaign...");
  const helocSms = await post({
    action: "create_sms_campaign",
    ...PMR,
    campaignName: "PMR - HELOC SMS",
    steps: [
      {
        stepNum: 1, dayOffset: 0,
        body: "Hi {{firstName}}, Tim Haskins with PMR. Saw you requested info on a Home Equity Line of Credit (HELOC). Are you looking to fund a renovation, or just want access to emergency capital?",
      },
      {
        stepNum: 2, dayOffset: 2,
        body: "Hey {{firstName}}, the great thing about a HELOC is you only pay interest on the money you actually draw. Do you know roughly how much equity you have in your home right now?",
      },
    ],
  });
  console.log("  HELOC SMS IDs:", JSON.stringify(helocSms));
  campaignIds.pmr_heloc_sms = helocSms.campaignIds;

  // ═══ 5. RE Agent Outreach Campaign ═══
  console.log("  Creating RE Agent Outreach Email Campaign...");
  const agentEmail = await post({
    action: "create_email_campaign",
    ...PMR,
    campaignName: "PMR - RE Agent Outreach Email",
    fromAddress: "lockin@lockinloans.com",
    steps: [
      {
        stepNum: 1, dayOffset: 1,
        subject: "Connecting regarding local buyers",
        body: `Hi {{firstName}},\n\nI'm Tim Haskins, a Loan Officer with Premier Mortgage Resources. I've been following your recent production in the area and wanted to reach out.\n\nMy team specializes in First-Time Homebuyer programs and Down Payment Assistance. We are currently running campaigns that generate a high volume of buyer leads, and I am looking to partner with a few proactive agents to help get these buyers into homes.\n\nI'd love to grab 10 minutes on a quick call to see if there's a mutual fit for us to do some business together.\n\nAre you available for a quick intro call this Thursday?${SIGN}${FOOTER}`,
      },
      {
        stepNum: 2, dayOffset: 4,
        subject: "Invite: Agent Workshop on DPA Programs",
        body: `Hi {{firstName}},\n\nOne of the biggest hurdles agents face right now is buyers who have the income, but lack the 20% down payment.\n\nNext week, I am hosting a private webinar specifically for Real Estate Agents. I'll be breaking down the newest Down Payment Assistance (DPA) programs and showing you exactly how to use them to turn your renter leads into closed buyer transactions.\n\nIf you'd like to attend, you can register here: [Insert Webinar Link]\n\nHope to see you there!${SIGN_SHORT}${FOOTER}`,
      },
    ],
  });
  console.log("  RE Agent Email IDs:", JSON.stringify(agentEmail));
  campaignIds.pmr_agent_email = agentEmail.campaignIds;

  console.log("  Creating RE Agent Outreach SMS Campaign...");
  const agentSms = await post({
    action: "create_sms_campaign",
    ...PMR,
    campaignName: "PMR - RE Agent Outreach SMS",
    steps: [
      {
        stepNum: 1, dayOffset: 1,
        body: "Hi {{firstName}}, Tim Haskins with Premier Mortgage Resources here. I work with a lot of buyers in your area and wanted to connect. Are you taking on new buyer clients right now?",
      },
      {
        stepNum: 2, dayOffset: 3,
        body: "Hey {{firstName}}, I'm hosting a webinar for local agents next week covering new Down Payment Assistance programs that are helping renters become buyers. Want me to send you the invite?",
      },
    ],
  });
  console.log("  RE Agent SMS IDs:", JSON.stringify(agentSms));
  campaignIds.pmr_agent_sms = agentSms.campaignIds;

  // ── Tim's Phone Script for RE Agent calls ──
  console.log("  Creating Tim's RE Agent Phone Script...");
  const timScript = await post({
    action: "create_dialer_script",
    ...PMR,
    name: "PMR - RE Agent Call Script",
    content: `THE OPENER (Call RE Agents after Day 4 of email/SMS sequence):
"Hey {{firstName}}, it's Tim Haskins with Premier Mortgage Resources. I sent you an email earlier this week about some of the buyer programs we're running. I know you're busy, but I'm looking for a solid agent partner in your market to help handle some of the first-time buyer volume we're seeing. Are you currently looking to expand your buyer pipeline, or are you strictly focused on listings right now?"

KEY TALKING POINTS:
• We specialize in First-Time Homebuyer programs and Down Payment Assistance
• We are currently running Meta Ad campaigns generating high-volume buyer leads
• Looking for proactive agents to partner with on getting these buyers into homes
• Can provide pre-approved buyers ready to make offers

THE CLOSE:
"I'd love to set up a quick 10-minute call this week to walk you through exactly what we're doing and see if there's a mutual fit. What does your Thursday look like?"`,
  });
  console.log("  Tim's Script:", JSON.stringify(timScript));

  // ═══ WORKFLOWS ═══

  // ── FTHB Workflow ──
  console.log("  Creating FTHB Routing Workflow...");
  const fthbWf = await post({
    action: "create_workflow",
    ...PMR,
    name: "FTHB Lead Routing",
    description: "Routes leads tagged 'First Time Home Buyer' to the FTHB email + SMS sequences and notifies Tim.",
    triggerType: "tag_added",
    triggerConfig: { tag: "First Time Home Buyer" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_fthb_email[0] },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_fthb_sms[0] },
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "notify_user",
        config: {
          title: "New FTHB Lead",
          body: "{{firstName}} {{lastName}} just submitted a First Time Home Buyer inquiry. Follow up soon!",
          notificationType: "lead_action_required",
        },
      },
    ],
  });
  console.log("  FTHB Workflow:", JSON.stringify(fthbWf));

  // ── DPA Webinar Workflow ──
  console.log("  Creating DPA Webinar Routing Workflow...");
  const dpaWf = await post({
    action: "create_workflow",
    ...PMR,
    name: "DPA Webinar Lead Routing",
    description: "Routes leads tagged 'DPA For First Time Homebuyers Webinar' to the DPA sequence.",
    triggerType: "tag_added",
    triggerConfig: { tag: "DPA For First Time Homebuyers Webinar" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_dpa_email[0] },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_dpa_sms[0] },
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "notify_user",
        config: {
          title: "New DPA Webinar Registration",
          body: "{{firstName}} {{lastName}} registered for the DPA Homebuyer Workshop.",
          notificationType: "lead_action_required",
        },
      },
    ],
  });
  console.log("  DPA Workflow:", JSON.stringify(dpaWf));

  // ── Refinance Workflow ──
  console.log("  Creating Refinance Routing Workflow...");
  const refiWf = await post({
    action: "create_workflow",
    ...PMR,
    name: "Refinance Lead Routing",
    description: "Routes leads tagged 'Refinance' to the Refinance email + SMS sequences and notifies Tim.",
    triggerType: "tag_added",
    triggerConfig: { tag: "Refinance" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_refi_email[0] },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_refi_sms[0] },
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "notify_user",
        config: {
          title: "New Refinance Lead",
          body: "{{firstName}} {{lastName}} just submitted a Refinance inquiry. Follow up soon!",
          notificationType: "lead_action_required",
        },
      },
    ],
  });
  console.log("  Refinance Workflow:", JSON.stringify(refiWf));

  // ── HELOC Workflow ──
  console.log("  Creating HELOC Routing Workflow...");
  const helocWf = await post({
    action: "create_workflow",
    ...PMR,
    name: "HELOC Lead Routing",
    description: "Routes leads tagged 'Heloc' to the HELOC email + SMS sequences and notifies Tim.",
    triggerType: "tag_added",
    triggerConfig: { tag: "Heloc" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_heloc_email[0] },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_heloc_sms[0] },
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "notify_user",
        config: {
          title: "New HELOC Lead",
          body: "{{firstName}} {{lastName}} just submitted a HELOC inquiry. Follow up soon!",
          notificationType: "lead_action_required",
        },
      },
    ],
  });
  console.log("  HELOC Workflow:", JSON.stringify(helocWf));

  // ── RE Agent Outreach Workflow ──
  console.log("  Creating RE Agent Outreach Routing Workflow...");
  const agentWf = await post({
    action: "create_workflow",
    ...PMR,
    name: "RE Agent Outreach Routing",
    description: "Routes contacts tagged 'Real Estate Agent' (imported from Model Match) to the RE Agent Outreach sequence and creates a follow-up task for Tim on Day 4.",
    triggerType: "tag_added",
    triggerConfig: { tag: "Real Estate Agent" },
    isActive: true,
    steps: [
      {
        stepOrder: 1,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_agent_email[0] },
      },
      {
        stepOrder: 2,
        stepType: "action",
        actionType: "add_to_campaign",
        config: { campaignId: campaignIds.pmr_agent_sms[0] },
      },
      {
        stepOrder: 3,
        stepType: "action",
        actionType: "create_task",
        config: {
          title: "Call Agent {{firstName}} {{lastName}} to book partnership meeting",
          description: "After 4 days of email/SMS nurture, call this RE Agent to discuss partnership opportunities. Use the PMR - RE Agent Call Script in the Power Dialer.",
          priority: "high",
          dueInDays: 4,
        },
      },
    ],
  });
  console.log("  RE Agent Workflow:", JSON.stringify(agentWf));
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  3-ACCOUNT SALES ENGINE SETUP                            ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  await setupApexSystem();
  await sleep(500);
  await setupOptimalLending();
  await sleep(500);
  await setupPMR();

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║  SETUP COMPLETE                                           ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("\nAll campaign IDs:", JSON.stringify(campaignIds, null, 2));
}

main().catch(console.error);
