/**
 * Seed built-in custom field templates.
 * Run via: node server/seed-cf-templates.mjs
 * Uses DATABASE_URL from env.
 */
import mysql from "mysql2/promise";

const TEMPLATES = [
  {
    name: "Mortgage LO",
    description:
      "Custom fields for mortgage loan officers — track loan details, credit scores, and closing timelines.",
    industry: "Mortgage",
    isSystem: true,
    fields: [
      { label: "Loan Amount", slug: "loan_amount", type: "number", required: false, sortOrder: 0 },
      {
        label: "Loan Type",
        slug: "loan_type",
        type: "dropdown",
        options: ["Conventional", "FHA", "VA", "USDA", "Jumbo"],
        required: false,
        sortOrder: 1,
      },
      { label: "Pre-Approved", slug: "pre_approved", type: "checkbox", required: false, sortOrder: 2 },
      { label: "Close Date", slug: "close_date", type: "date", required: false, sortOrder: 3 },
      { label: "Property Address", slug: "property_address", type: "text", required: false, sortOrder: 4 },
      { label: "Credit Score", slug: "credit_score", type: "number", required: false, sortOrder: 5 },
      { label: "Lender", slug: "lender", type: "text", required: false, sortOrder: 6 },
    ],
  },
  {
    name: "Real Estate Agent",
    description:
      "Custom fields for real estate agents — track property details, MLS numbers, and listing dates.",
    industry: "Real Estate",
    isSystem: true,
    fields: [
      {
        label: "Property Type",
        slug: "property_type",
        type: "dropdown",
        options: ["Single Family", "Condo", "Townhome", "Multi-Family", "Land"],
        required: false,
        sortOrder: 0,
      },
      { label: "Price Range", slug: "price_range", type: "text", required: false, sortOrder: 1 },
      { label: "Bedrooms", slug: "bedrooms", type: "number", required: false, sortOrder: 2 },
      { label: "Pre-Qualified", slug: "pre_qualified", type: "checkbox", required: false, sortOrder: 3 },
      { label: "Listing Date", slug: "listing_date", type: "date", required: false, sortOrder: 4 },
      { label: "MLS Number", slug: "mls_number", type: "text", required: false, sortOrder: 5 },
    ],
  },
  {
    name: "Insurance Agent",
    description:
      "Custom fields for insurance agents — track policy types, premiums, renewal dates, and coverage.",
    industry: "Insurance",
    isSystem: true,
    fields: [
      {
        label: "Policy Type",
        slug: "policy_type",
        type: "dropdown",
        options: ["Auto", "Home", "Life", "Health", "Commercial"],
        required: false,
        sortOrder: 0,
      },
      { label: "Premium Amount", slug: "premium_amount", type: "number", required: false, sortOrder: 1 },
      { label: "Renewal Date", slug: "renewal_date", type: "date", required: false, sortOrder: 2 },
      { label: "Current Carrier", slug: "current_carrier", type: "text", required: false, sortOrder: 3 },
      { label: "Coverage Amount", slug: "coverage_amount", type: "number", required: false, sortOrder: 4 },
    ],
  },
  {
    name: "Solar Sales",
    description:
      "Custom fields for solar sales reps — track roof type, electric bills, system size, and installation.",
    industry: "Solar",
    isSystem: true,
    fields: [
      {
        label: "Roof Type",
        slug: "roof_type",
        type: "dropdown",
        options: ["Shingle", "Tile", "Metal", "Flat"],
        required: false,
        sortOrder: 0,
      },
      { label: "Electric Bill", slug: "electric_bill", type: "number", required: false, sortOrder: 1 },
      { label: "Panel Count", slug: "panel_count", type: "number", required: false, sortOrder: 2 },
      { label: "System Size", slug: "system_size", type: "text", required: false, sortOrder: 3 },
      { label: "Installation Date", slug: "installation_date", type: "date", required: false, sortOrder: 4 },
      { label: "Utility Company", slug: "utility_company", type: "text", required: false, sortOrder: 5 },
    ],
  },
  {
    name: "General Sales",
    description:
      "General-purpose custom fields for any sales team — track deal sources, budgets, and competitors.",
    industry: "General",
    isSystem: true,
    fields: [
      {
        label: "Deal Source",
        slug: "deal_source",
        type: "dropdown",
        options: ["Referral", "Website", "Cold Call", "Social Media", "Ad"],
        required: false,
        sortOrder: 0,
      },
      { label: "Budget", slug: "budget", type: "number", required: false, sortOrder: 1 },
      { label: "Decision Date", slug: "decision_date", type: "date", required: false, sortOrder: 2 },
      { label: "Competitor", slug: "competitor", type: "text", required: false, sortOrder: 3 },
      { label: "Notes", slug: "notes", type: "textarea", required: false, sortOrder: 4 },
    ],
  },
];

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);

  console.log("Seeding custom field templates...\n");

  for (const t of TEMPLATES) {
    // Check if template already exists
    const [rows] = await conn.execute(
      "SELECT id FROM custom_field_templates WHERE name = ? AND is_system = 1 LIMIT 1",
      [t.name]
    );
    if (/** @type {any[]} */ (rows).length > 0) {
      console.log(`  ✓ Template "${t.name}" already exists, skipping.`);
      continue;
    }

    await conn.execute(
      `INSERT INTO custom_field_templates (name, description, industry, fields, is_system)
       VALUES (?, ?, ?, ?, ?)`,
      [t.name, t.description, t.industry, JSON.stringify(t.fields), t.isSystem ? 1 : 0]
    );
    console.log(`  ✓ Seeded template: ${t.name}`);
  }

  await conn.end();
  console.log("\n✅ Done seeding custom field templates.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
