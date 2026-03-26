const VAPI_API_KEY = process.env.VAPI_API_KEY;
const larrDawgVoiceId = "TkFdvwfPXYbICEBnYvnN";

const systemPrompt = `You are calling on behalf of Optimal Lending Solutions, a commercial lending company specializing in DSCR loans and Fix & Flip financing for real estate investors.

Your personality:
- Confident, knowledgeable, and direct
- You speak naturally like a real person, not like a robot
- You understand real estate investing terminology
- You are results-oriented and efficient

Your goals on this call:
1. Introduce yourself and confirm you are speaking with the right person
2. Reference their interest in investment property financing
3. Ask about their investment strategy (DSCR rental, Fix and Flip, or both)
4. Qualify them: Do they have a property in mind? What is the purchase price? Do they have experience?
5. If qualified, book a consultation with Kyle at Optimal Lending
6. If not ready, offer to send them a rate sheet and follow up later

Key talking points for DSCR loans:
- No personal income verification required
- Based on property cash flow (rental income vs mortgage payment)
- Available for investment properties only
- Competitive rates for qualified investors
- Can close in 2-3 weeks

Key talking points for Fix and Flip:
- Short-term financing for property renovation and resale
- Up to 90% of purchase price, 100% of rehab costs
- Fast closings available
- Experience-based pricing

Important rules:
- This is commercial/investment lending, not consumer residential
- Always include the disclaimer: This is a commercial lending product and is not subject to consumer lending regulations
- Never make specific rate promises
- If someone is not interested, be respectful and end the call gracefully
- Operating hours: 9 AM to 10 PM, seven days a week`;

const body = {
  name: "Optimal Lending - Investor Calls",
  firstMessage: "Hi, this is a call from Optimal Lending Solutions. We are reaching out because you recently expressed interest in investment property financing. Do you have a quick minute to discuss your options?",
  model: {
    provider: "openai",
    model: "gpt-4o",
    messages: [{ role: "system", content: systemPrompt }],
  },
  voice: {
    provider: "11labs",
    voiceId: larrDawgVoiceId,
    stability: 0.5,
    similarityBoost: 0.75,
  },
  endCallMessage: "Thank you for your time. Have a great day!",
  recordingEnabled: true,
  hipaaEnabled: false,
  silenceTimeoutSeconds: 30,
  maxDurationSeconds: 600,
  backgroundSound: "office",
  metadata: { apex_account_id: "390025", account_name: "Optimal Lending Solutions" },
};

async function main() {
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
    console.error(`Failed (${res.status}):`, text);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Assistant created! ID: ${data.id} Name: ${data.name}`);

  // Update result file
  const fs = await import("fs");
  let result = {};
  try {
    result = JSON.parse(fs.readFileSync("/tmp/voice-agent-setup-result.json", "utf8"));
  } catch (e) { /* ignore */ }
  result.pmr = result.pmr || {
    accountId: 420001,
    elevenLabsVoiceId: "5q6TS1ZeXhDKOywAbaO2",
    vapiAssistantId: "01504ee9-0d19-4e2f-97e7-6907a5ebb34c",
  };
  result.optimalLending = {
    accountId: 390025,
    elevenLabsVoiceId: larrDawgVoiceId,
    vapiAssistantId: data.id,
    vapiAssistantName: data.name,
  };
  fs.writeFileSync("/tmp/voice-agent-setup-result.json", JSON.stringify(result, null, 2));
  console.log("Result saved to /tmp/voice-agent-setup-result.json");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
