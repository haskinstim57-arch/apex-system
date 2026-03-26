/**
 * Update VAPI assistant system prompts to reflect new business hours:
 * 7 AM - 10 PM Eastern Time, 7 days a week
 */

const VAPI_API_KEY = "d29c2454-c99f-41ba-a644-e15b56cc5ff1";

const PMR_ASSISTANT_ID = "01504ee9-0d19-4e2f-97e7-6907a5ebb34c";
const OLS_ASSISTANT_ID = "6cead709-383a-4dbe-943c-6d7b485fafe6";

async function updateHours(assistantId, name) {
  console.log(`\nUpdating ${name}...`);
  
  const getRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  
  const current = await getRes.json();
  const currentPrompt = current.model?.messages?.[0]?.content || "";
  
  // Replace the old hours references
  let updatedPrompt = currentPrompt
    // Replace "9 AM to 10 PM, seven days a week" with new hours
    .replace(/Operating hours: 9 AM to 10 PM, seven days a week/g, 
             "Operating hours: 7 AM to 10 PM Eastern Time, seven days a week")
    // Replace appointment availability line
    .replace(/Available appointment times are Monday through Sunday, 9:00 AM to 5:00 PM Pacific Time/g,
             "Available appointment times are Monday through Sunday, 7:00 AM to 10:00 PM Eastern Time")
    // Replace any remaining PT references for appointment hours
    .replace(/Available appointment days are Monday through Friday, 9:00 AM to 5:00 PM Pacific Time/g,
             "Available appointment days are Monday through Sunday, 7:00 AM to 10:00 PM Eastern Time");
  
  // Also update the LiquidJS timezone from Los_Angeles to New_York
  updatedPrompt = updatedPrompt
    .replace(/"America\/Los_Angeles"/g, '"America/New_York"');
  
  if (updatedPrompt === currentPrompt) {
    console.log(`  No changes needed.`);
    return;
  }
  
  const updatePayload = {
    model: {
      ...current.model,
      messages: [
        {
          role: "system",
          content: updatedPrompt
        }
      ]
    }
  };
  
  const patchRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updatePayload)
  });
  
  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error(`  Failed: ${patchRes.status} ${text}`);
    return;
  }
  
  const updated = await patchRes.json();
  const newContent = updated.model?.messages?.[0]?.content || "";
  
  console.log(`  ✅ Updated!`);
  console.log(`  Tools preserved: ${updated.model?.tools?.length || 0}`);
  console.log(`  Has ET timezone: ${newContent.includes("America/New_York")}`);
  console.log(`  Has 7 AM hours: ${newContent.includes("7 AM to 10 PM Eastern")}`);
  console.log(`  Has 7:00 AM appointment: ${newContent.includes("7:00 AM to 10:00 PM Eastern")}`);
}

async function main() {
  console.log("=== Updating VAPI Business Hours to 7 AM - 10 PM ET ===");
  
  await updateHours(PMR_ASSISTANT_ID, "PMR - Tim Haskins");
  await updateHours(OLS_ASSISTANT_ID, "OLS - Investor Calls");
  
  console.log("\n=== Done! ===");
}

main().catch(console.error);
