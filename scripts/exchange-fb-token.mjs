#!/usr/bin/env node
/**
 * Exchange a short-lived Facebook User Access Token for:
 * 1. A long-lived User Access Token (~60 days)
 * 2. A never-expiring Page Access Token
 *
 * Usage: node scripts/exchange-fb-token.mjs
 */

const SHORT_LIVED_TOKEN = "EAAvwgCNktpQBRNJQObxSORjhZARYlIZA9elkSBjYeocDPLhIU1AzJ82zDfdZBvmV0v5vrmMmQt5jICrI8d5BwjHt5lgKfQznNZC8mvv8zcv3LTpjaukxnMXZAomv0UnXAWvA6ACt2ke7Nl4jwzcwVhLe0oMaLVObCkPm22OO5cvQqgqn52caVqbvd0nJ3TgeOJHTAN9XZBUpYAFWji6qQhvZCkbVjDQpoD1aZC8qglexMXmk9Ti5LSPlZCJZBk0zcrco2dfvvBVc6HVZCPpDPvhjXTLFRlSfG1CfZAClSCX8eQZDZD";
const PAGE_ID = "500444413143324";

// Read env from the running server
const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error("ERROR: FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set");
  console.log("APP_ID:", APP_ID);
  console.log("APP_SECRET set:", !!APP_SECRET);
  process.exit(1);
}

async function main() {
  console.log("=== Facebook Token Exchange ===\n");
  console.log("App ID:", APP_ID);
  console.log("Page ID:", PAGE_ID);

  // Step 1: Exchange short-lived user token for long-lived user token
  console.log("\n--- Step 1: Exchange for Long-Lived User Token ---");
  const llUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_LIVED_TOKEN}`;

  const llRes = await fetch(llUrl);
  const llData = await llRes.json();

  if (llData.error) {
    console.error("Error exchanging token:", llData.error.message);
    console.log("\nThe short-lived token may have already expired.");
    console.log("Trying to use the token directly as it might already be long-lived...\n");

    // Try to get page token directly with the provided token
    await getPageToken(SHORT_LIVED_TOKEN);
    return;
  }

  const longLivedUserToken = llData.access_token;
  const expiresIn = llData.expires_in;
  console.log("Long-lived user token obtained!");
  console.log("Expires in:", expiresIn ? `${Math.round(expiresIn / 86400)} days` : "unknown");
  console.log("Token prefix:", longLivedUserToken.substring(0, 40) + "...");

  // Step 2: Get never-expiring Page Access Token
  await getPageToken(longLivedUserToken);
}

async function getPageToken(userToken) {
  console.log("\n--- Step 2: Get Page Access Token (never-expiring) ---");
  const pageUrl = `https://graph.facebook.com/v19.0/${PAGE_ID}?fields=access_token,name&access_token=${userToken}`;

  const pageRes = await fetch(pageUrl);
  const pageData = await pageRes.json();

  if (pageData.error) {
    console.error("Error getting page token:", pageData.error.message);
    return;
  }

  const pageToken = pageData.access_token;
  console.log("Page name:", pageData.name);
  console.log("Page token obtained!");
  console.log("Token prefix:", pageToken.substring(0, 40) + "...");
  console.log("Token length:", pageToken.length);

  // Step 3: Debug the page token to verify it's long-lived
  console.log("\n--- Step 3: Verify Page Token ---");
  const debugUrl = `https://graph.facebook.com/v19.0/debug_token?input_token=${pageToken}&access_token=${userToken}`;

  const debugRes = await fetch(debugUrl);
  const debugData = await debugRes.json();

  if (debugData.data) {
    const d = debugData.data;
    console.log("Type:", d.type);
    console.log("Is valid:", d.is_valid);
    console.log("Expires at:", d.expires_at === 0 ? "NEVER (permanent)" : new Date(d.expires_at * 1000).toISOString());
    console.log("Scopes:", d.scopes?.join(", "));
  }

  // Output the token for use
  console.log("\n=== RESULT ===");
  console.log("PAGE_ACCESS_TOKEN=" + pageToken);
}

main().catch(console.error);
