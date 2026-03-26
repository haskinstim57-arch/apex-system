/**
 * Rename PMR voice agent from "Tim Haskins" to a generic assistant name.
 * Update the system prompt so it no longer claims to be Tim.
 */

const VAPI_API_KEY = "d29c2454-c99f-41ba-a644-e15b56cc5ff1";
const PMR_ASSISTANT_ID = "01504ee9-0d19-4e2f-97e7-6907a5ebb34c";

async function main() {
  console.log("=== Renaming PMR Voice Agent ===\n");
  
  // Get current config
  const getRes = await fetch(`https://api.vapi.ai/assistant/${PMR_ASSISTANT_ID}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  
  const current = await getRes.json();
  console.log(`Current name: ${current.name}`);
  console.log(`Current first message: ${current.firstMessage}`);
  
  const currentPrompt = current.model?.messages?.[0]?.content || "";
  
  // Update the system prompt: replace Tim Haskins identity with generic PMR assistant
  let updatedPrompt = currentPrompt
    .replace(
      "You are Tim Haskins, a licensed mortgage loan officer at Premier Mortgage Resources (NMLS #1116876). You are calling back a lead who expressed interest in a mortgage consultation.",
      "You are a mortgage consultation assistant calling on behalf of Premier Mortgage Resources (NMLS #1116876). You are calling back a lead who expressed interest in a mortgage consultation."
    )
    .replace(
      "- Premier Mortgage Resources offers competitive rates and personalized service",
      "- Premier Mortgage Resources offers competitive rates and personalized service\n- Tim Haskins is the lead loan officer and will be handling their consultation"
    );
  
  // Update the first message
  const newFirstMessage = "Hi, this is a call from Premier Mortgage Resources. I'm calling because you recently expressed interest in learning more about your mortgage options. Is this a good time to chat for a few minutes?";
  
  const updatePayload = {
    name: "PMR - Mortgage Consultation Assistant",
    firstMessage: newFirstMessage,
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
  
  const patchRes = await fetch(`https://api.vapi.ai/assistant/${PMR_ASSISTANT_ID}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updatePayload)
  });
  
  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error(`Failed: ${patchRes.status} ${text}`);
    return;
  }
  
  const updated = await patchRes.json();
  console.log(`\n✅ Updated!`);
  console.log(`New name: ${updated.name}`);
  console.log(`New first message: ${updated.firstMessage}`);
  console.log(`Tools preserved: ${updated.model?.tools?.length || 0}`);
  
  const newContent = updated.model?.messages?.[0]?.content || "";
  console.log(`Still says "Tim Haskins" as identity: ${newContent.includes("You are Tim Haskins")}`);
  console.log(`Says "mortgage consultation assistant": ${newContent.includes("mortgage consultation assistant")}`);
  console.log(`Mentions Tim as loan officer: ${newContent.includes("Tim Haskins is the lead loan officer")}`);
}

main().catch(console.error);
