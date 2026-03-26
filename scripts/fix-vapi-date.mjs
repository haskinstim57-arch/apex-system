import fs from 'fs';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

const assistants = [
  {
    name: 'OLS',
    id: '6cead709-383a-4dbe-943c-6d7b485fafe6',
    promptFile: '/tmp/ols_prompt.txt'
  },
  {
    name: 'PMR',
    id: '01504ee9-0d19-4e2f-97e7-6907a5ebb34c',
    promptFile: '/tmp/pmr_prompt.txt'
  }
];

const DATE_BLOCK = `### Handling Date, Time, and Day
- Current Date and Time Variables:
  Current date: {{ "now" | date: "%B %d, %Y", "America/Los_Angeles" }}
  Current time: {{ "now" | date: "%I:%M %p", "America/Los_Angeles" }}
  Current day: {{ "now" | date: "%A", "America/Los_Angeles" }}
- CRITICAL: You MUST use these variables to determine today's date. NEVER guess or make up dates.
- When the customer asks to book an appointment, suggest dates starting from today or the next available day.
- NEVER suggest dates in the past. If a date sounds like it might be in the past, recalculate based on the current date above.
- Available appointment times are Monday through Sunday, 9:00 AM to 5:00 PM Pacific Time.
- Always confirm the full date (day of week, month, day, year) with the customer before booking.

`;

async function updateAssistant(assistant) {
  const currentPrompt = fs.readFileSync(assistant.promptFile, 'utf-8').trim();
  
  // Prepend the date block to the existing prompt
  const newPrompt = DATE_BLOCK + currentPrompt;
  
  console.log(`\n=== Updating ${assistant.name} ===`);
  console.log(`Prompt length: ${currentPrompt.length} -> ${newPrompt.length}`);
  
  const resp = await fetch(`https://api.vapi.ai/assistant/${assistant.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: newPrompt }
        ]
      }
    })
  });
  
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Failed to update ${assistant.name}:`, err);
    return;
  }
  
  const data = await resp.json();
  const updatedPrompt = data.model?.messages?.[0]?.content || '';
  
  // Verify the date variable is in the prompt
  if (updatedPrompt.includes('{{ "now" | date:')) {
    console.log(`✅ ${assistant.name} updated successfully with dynamic date variables`);
    // Show the first 500 chars to verify
    console.log(`First 500 chars:\n${updatedPrompt.substring(0, 500)}`);
  } else {
    console.error(`❌ ${assistant.name} update may have failed - date variable not found`);
    console.log(`First 500 chars:\n${updatedPrompt.substring(0, 500)}`);
  }
}

async function main() {
  for (const a of assistants) {
    await updateAssistant(a);
  }
  console.log('\n✅ Done! Both assistants now have dynamic date/time awareness.');
}

main().catch(console.error);
