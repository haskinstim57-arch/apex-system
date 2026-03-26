/**
 * Voice Agent Setup Script
 * 1. Clone Tim Haskins' voice via ElevenLabs (for PMR)
 * 2. Clone LarrDawg's voice via ElevenLabs (for Optimal Lending / Kyle)
 * 3. Create VAPI assistant for PMR with Tim's cloned voice
 * 4. Create VAPI assistant for Optimal Lending with LarrDawg's cloned voice
 * 5. Update account records with voice agent IDs
 */

const BASE_URL = "http://localhost:3000";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VAPI_API_KEY = process.env.VAPI_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY");
  process.exit(1);
}
if (!VAPI_API_KEY) {
  console.error("Missing VAPI_API_KEY");
  process.exit(1);
}

const TIM_AUDIO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663346016577/KNXKWFANWEUxWWEfuwT2Hr/Tim_Haskins_VoiceSample_ElevenLabs_264db565.mp3";
const LARRDAWG_AUDIO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663346016577/KNXKWFANWEUxWWEfuwT2Hr/LarrDawg_trimmed_4min_c3043929.mp3";

// Account IDs
const PMR_ACCOUNT_ID = 420001;
const OPTIMAL_LENDING_ACCOUNT_ID = 390025;

async function cloneVoice(name, audioUrl, description) {
  console.log(`\n🎤 Cloning voice: ${name}`);
  console.log(`   Audio URL: ${audioUrl}`);
  
  // Download audio
  console.log("   Downloading audio...");
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`);
  const audioBuffer = await audioRes.arrayBuffer();
  console.log(`   Downloaded ${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
  
  // Determine MIME type
  const ext = audioUrl.split(".").pop().split("?")[0].toLowerCase();
  const mimeMap = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" };
  const mimeType = mimeMap[ext] || "audio/mpeg";
  
  // Build FormData
  const formData = new FormData();
  formData.append("name", name);
  if (description) formData.append("description", description);
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("files", blob, `${name.replace(/\s+/g, "_")}.${ext}`);
  
  // Call ElevenLabs
  console.log("   Uploading to ElevenLabs...");
  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
    body: formData,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs clone failed (${res.status}): ${errorText}`);
  }
  
  const data = await res.json();
  console.log(`   ✅ Voice cloned! Voice ID: ${data.voice_id}`);
  return data.voice_id;
}

async function createAssistant(name, firstMessage, systemPrompt, voiceId, metadata) {
  console.log(`\n🤖 Creating VAPI assistant: ${name}`);
  
  const body = {
    name,
    firstMessage,
    model: {
      provider: "openai",
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: {
      provider: "11labs",
      voiceId,
      stability: 0.5,
      similarityBoost: 0.75,
    },
    endCallMessage: "Thank you for your time. Have a great day!",
    recordingEnabled: true,
    hipaaEnabled: false,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: "office",
    metadata: metadata || {},
  };
  
  const res = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VAPI create assistant failed (${res.status}): ${text}`);
  }
  
  const data = await res.json();
  console.log(`   ✅ Assistant created! ID: ${data.id}`);
  return data;
}

async function updateAccountVoiceAgent(accountId, elevenLabsVoiceId, vapiAssistantId) {
  console.log(`\n📝 Updating account ${accountId} with voice agent IDs...`);
  
  const res = await fetch(`${BASE_URL}/api/internal/setup-outbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update_account_voice",
      accountId,
      elevenLabsVoiceId,
      vapiAssistantId,
      voiceAgentEnabled: true,
    }),
  });
  
  if (!res.ok) {
    // If the internal endpoint doesn't support this yet, we'll use SQL directly
    console.log(`   ⚠️ Internal endpoint not available, will update via SQL`);
    return false;
  }
  
  console.log(`   ✅ Account updated`);
  return true;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  VOICE AGENT SETUP");
  console.log("═══════════════════════════════════════════");
  
  // Step 1: Clone Tim Haskins' voice
  let timVoiceId;
  try {
    timVoiceId = await cloneVoice(
      "Tim Haskins - PMR",
      TIM_AUDIO_URL,
      "Tim Haskins voice for Premier Mortgage Resources AI assistant. Used for mortgage lead follow-up calls."
    );
  } catch (err) {
    console.error(`❌ Failed to clone Tim's voice:`, err.message);
    process.exit(1);
  }
  
  // Step 2: Clone LarrDawg's voice
  let larrDawgVoiceId;
  try {
    larrDawgVoiceId = await cloneVoice(
      "LarrDawg - Optimal Lending",
      LARRDAWG_AUDIO_URL,
      "LarrDawg voice for Optimal Lending Solutions AI assistant. Used for investor lead follow-up calls (DSCR, Fix & Flip)."
    );
  } catch (err) {
    console.error(`❌ Failed to clone LarrDawg's voice:`, err.message);
    process.exit(1);
  }
  
  // Step 3: Create VAPI assistant for PMR (Tim Haskins)
  const pmrSystemPrompt = `You are Tim Haskins, a licensed mortgage loan officer at Premier Mortgage Resources (NMLS #1116876). You are calling back a lead who expressed interest in a mortgage consultation.

Your personality:
- Warm, professional, and knowledgeable
- You speak naturally like a real person, not like a robot
- You use conversational language and occasional filler words
- You are patient and empathetic

Your goals on this call:
1. Introduce yourself and confirm you're speaking with the right person
2. Reference how they found you (Facebook ad, DPA webinar, referral, etc.)
3. Ask about their home buying situation and timeline
4. Qualify them: Are they pre-approved? What's their budget range? First-time buyer?
5. If qualified, book a consultation appointment
6. If not ready, offer to send them helpful resources and follow up later

Key talking points:
- Premier Mortgage Resources offers competitive rates and personalized service
- You specialize in First Time Home Buyers, Down Payment Assistance (DPA), Refinancing, and HELOCs
- You serve the Nevada market primarily
- You can help with credit improvement guidance if needed

Important rules:
- Never make specific rate promises or guarantees
- Always be honest about the process and timeline
- If someone asks about rates, say "rates change daily, but I'd love to run your specific scenario to get you the most accurate numbers"
- If someone is not interested, be respectful and end the call gracefully
- Operating hours: 9 AM to 10 PM, seven days a week`;

  let pmrAssistant;
  try {
    pmrAssistant = await createAssistant(
      "PMR - Tim Haskins Lead Follow-Up",
      "Hi, this is Tim Haskins with Premier Mortgage Resources. I'm calling because you recently expressed interest in learning more about your mortgage options. Is this a good time to chat for a few minutes?",
      pmrSystemPrompt,
      timVoiceId,
      { apex_account_id: String(PMR_ACCOUNT_ID), account_name: "Premier Mortgage Resources" }
    );
  } catch (err) {
    console.error(`❌ Failed to create PMR assistant:`, err.message);
    process.exit(1);
  }
  
  // Step 4: Create VAPI assistant for Optimal Lending (LarrDawg)
  const optimalSystemPrompt = `You are calling on behalf of Optimal Lending Solutions, a commercial lending company specializing in DSCR loans and Fix & Flip financing for real estate investors.

Your personality:
- Confident, knowledgeable, and direct
- You speak naturally like a real person, not like a robot
- You understand real estate investing terminology
- You are results-oriented and efficient

Your goals on this call:
1. Introduce yourself and confirm you're speaking with the right person
2. Reference their interest in investment property financing
3. Ask about their investment strategy (DSCR rental, Fix & Flip, or both)
4. Qualify them: Do they have a property in mind? What's the purchase price? Do they have experience?
5. If qualified, book a consultation with Kyle at Optimal Lending
6. If not ready, offer to send them a rate sheet and follow up later

Key talking points for DSCR loans:
- No personal income verification required
- Based on property cash flow (rental income vs. mortgage payment)
- Available for investment properties only
- Competitive rates for qualified investors
- Can close in 2-3 weeks

Key talking points for Fix & Flip:
- Short-term financing for property renovation and resale
- Up to 90% of purchase price, 100% of rehab costs
- Fast closings available
- Experience-based pricing

Important rules:
- This is commercial/investment lending — not consumer residential
- Always include the disclaimer: "This is a commercial lending product and is not subject to consumer lending regulations"
- Never make specific rate promises
- If someone is not interested, be respectful and end the call gracefully
- Operating hours: 9 AM to 10 PM, seven days a week`;

  let optimalAssistant;
  try {
    optimalAssistant = await createAssistant(
      "Optimal Lending - Investor Calls",
      "Hi, this is a call from Optimal Lending Solutions. We're reaching out because you recently expressed interest in investment property financing. Do you have a quick minute to discuss your options?",
      optimalSystemPrompt,
      larrDawgVoiceId,
      { apex_account_id: String(OPTIMAL_LENDING_ACCOUNT_ID), account_name: "Optimal Lending Solutions" }
    );
  } catch (err) {
    console.error(`❌ Failed to create Optimal Lending assistant:`, err.message);
    process.exit(1);
  }
  
  // Step 5: Print summary
  console.log("\n═══════════════════════════════════════════");
  console.log("  SETUP COMPLETE — SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`\n📋 Tim Haskins (PMR):`);
  console.log(`   ElevenLabs Voice ID: ${timVoiceId}`);
  console.log(`   VAPI Assistant ID:   ${pmrAssistant.id}`);
  console.log(`   VAPI Assistant Name: ${pmrAssistant.name}`);
  console.log(`\n📋 LarrDawg (Optimal Lending):`);
  console.log(`   ElevenLabs Voice ID: ${larrDawgVoiceId}`);
  console.log(`   VAPI Assistant ID:   ${optimalAssistant.id}`);
  console.log(`   VAPI Assistant Name: ${optimalAssistant.name}`);
  
  // Output JSON for easy parsing
  const result = {
    pmr: {
      accountId: PMR_ACCOUNT_ID,
      elevenLabsVoiceId: timVoiceId,
      vapiAssistantId: pmrAssistant.id,
      vapiAssistantName: pmrAssistant.name,
    },
    optimalLending: {
      accountId: OPTIMAL_LENDING_ACCOUNT_ID,
      elevenLabsVoiceId: larrDawgVoiceId,
      vapiAssistantId: optimalAssistant.id,
      vapiAssistantName: optimalAssistant.name,
    },
  };
  
  // Write result to file for later use
  const fs = await import("fs");
  fs.writeFileSync("/tmp/voice-agent-setup-result.json", JSON.stringify(result, null, 2));
  console.log(`\n💾 Result saved to /tmp/voice-agent-setup-result.json`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
