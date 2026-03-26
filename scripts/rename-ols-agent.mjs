/**
 * Rename OLS voice agent to Larry's agent.
 * Update name, first message, and system prompt.
 */

const VAPI_API_KEY = "d29c2454-c99f-41ba-a644-e15b56cc5ff1";
const OLS_ASSISTANT_ID = "6cead709-383a-4dbe-943c-6d7b485fafe6";

async function main() {
  console.log("=== Renaming OLS Voice Agent to Larry's Agent ===\n");
  
  const getRes = await fetch(`https://api.vapi.ai/assistant/${OLS_ASSISTANT_ID}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  
  const current = await getRes.json();
  console.log(`Current name: ${current.name}`);
  console.log(`Current first message: ${current.firstMessage?.substring(0, 100)}...`);
  
  const currentPrompt = current.model?.messages?.[0]?.content || "";
  
  // Update the system prompt: replace any Kyle/generic identity with Larry
  let updatedPrompt = currentPrompt
    .replace(
      /You are (?:Kyle|a (?:mortgage|lending|investment)) .*?(?:at|from|with) Optimal Lending Solutions\./,
      "You are Larry's assistant calling on behalf of Optimal Lending Solutions."
    );
  
  // If the above didn't match, try a broader replacement
  if (updatedPrompt === currentPrompt) {
    // Just replace the first sentence identity line
    updatedPrompt = currentPrompt.replace(
      /^You are [^.]+\./m,
      "You are Larry's assistant calling on behalf of Optimal Lending Solutions."
    );
  }
  
  const newFirstMessage = current.firstMessage
    ?.replace(/Hi,? this is (?:Kyle|a call from|an assistant).*?\./, 
              "Hi, this is Larry's office calling from Optimal Lending Solutions.")
    || "Hi, this is Larry's office calling from Optimal Lending Solutions. I'm calling because you recently expressed interest in learning more about your investment lending options. Is this a good time to chat for a few minutes?";
  
  const updatePayload = {
    name: "OLS - Larry's Lending Assistant",
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
  
  const patchRes = await fetch(`https://api.vapi.ai/assistant/${OLS_ASSISTANT_ID}`, {
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
  console.log(`Mentions Larry: ${newContent.includes("Larry")}`);
}

main().catch(console.error);
