/**
 * Fix VAPI assistants - Add bookAppointment and checkAvailability tools
 * 
 * VAPI expects tools as model.tools array with type "function" and a server object.
 * The tools were never saved because the original setup script didn't include them.
 */

const VAPI_API_KEY = "d29c2454-c99f-41ba-a644-e15b56cc5ff1";
const SERVER_URL = "https://apexcrm-knxkwfan.manus.space/api/webhooks/vapi";

const PMR_ASSISTANT_ID = "01504ee9-0d19-4e2f-97e7-6907a5ebb34c";
const OLS_ASSISTANT_ID = "6cead709-383a-4dbe-943c-6d7b485fafe6";

// Define the tools in VAPI's expected format
const tools = [
  {
    type: "function",
    function: {
      name: "bookAppointment",
      description: "Book an appointment for the customer. You MUST call this function when the customer agrees to schedule an appointment. Do NOT just verbally confirm - you must actually call this function to create the booking in the system.",
      parameters: {
        type: "object",
        properties: {
          guestName: {
            type: "string",
            description: "The full name of the person booking the appointment"
          },
          guestEmail: {
            type: "string",
            description: "The email address of the person booking (optional)"
          },
          guestPhone: {
            type: "string",
            description: "The phone number of the person booking"
          },
          date: {
            type: "string",
            description: "The appointment date in YYYY-MM-DD format (e.g., 2026-03-28)"
          },
          time: {
            type: "string",
            description: "The appointment time in HH:MM 24-hour format (e.g., 14:00 for 2 PM)"
          },
          notes: {
            type: "string",
            description: "Any additional notes about the appointment (optional)"
          }
        },
        required: ["guestName", "guestPhone", "date", "time"]
      }
    },
    server: {
      url: SERVER_URL
    },
    messages: [
      {
        type: "request-start",
        content: "Let me book that appointment for you right now."
      },
      {
        type: "request-complete",
        content: ""
      },
      {
        type: "request-failed",
        content: "I'm having trouble with the booking system. Let me have someone call you back to confirm the appointment."
      }
    ]
  },
  {
    type: "function",
    function: {
      name: "checkAvailability",
      description: "Check available appointment slots for a specific date. Call this function when the customer asks about available times or when you need to suggest available slots before booking.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to check availability for in YYYY-MM-DD format (e.g., 2026-03-28)"
          }
        },
        required: ["date"]
      }
    },
    server: {
      url: SERVER_URL
    },
    messages: [
      {
        type: "request-start",
        content: "Let me check what times are available."
      },
      {
        type: "request-complete",
        content: ""
      },
      {
        type: "request-failed",
        content: "I'm having trouble checking the schedule. Generally, we have availability Monday through Friday, 9 AM to 5 PM Pacific Time."
      }
    ]
  }
];

async function updateAssistant(assistantId, name) {
  console.log(`\nUpdating ${name} (${assistantId})...`);
  
  // First, get current config
  const getRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  
  if (!getRes.ok) {
    const text = await getRes.text();
    console.error(`  Failed to get assistant: ${getRes.status} ${text}`);
    return;
  }
  
  const current = await getRes.json();
  console.log(`  Current model.tools count: ${current.model?.tools?.length || 0}`);
  console.log(`  Current serverMessages: ${JSON.stringify(current.serverMessages)}`);
  
  // Update with tools - VAPI uses model.tools for function definitions
  const updatePayload = {
    model: {
      ...current.model,
      tools: tools
    },
    // Ensure tool-calls is in serverMessages
    serverMessages: [
      "end-of-call-report",
      "status-update",
      "tool-calls",
      "transfer-destination-request"
    ],
    serverUrl: SERVER_URL
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
    console.error(`  Failed to update: ${patchRes.status} ${text}`);
    return;
  }
  
  const updated = await patchRes.json();
  console.log(`  ✅ Updated successfully!`);
  console.log(`  model.tools count: ${updated.model?.tools?.length || 0}`);
  
  // Verify tools are there
  for (const tool of (updated.model?.tools || [])) {
    console.log(`    - ${tool.function?.name} (type: ${tool.type}, server: ${tool.server?.url || 'none'})`);
  }
}

async function main() {
  console.log("=== Fixing VAPI Assistant Tools ===");
  console.log(`Server URL: ${SERVER_URL}`);
  
  await updateAssistant(PMR_ASSISTANT_ID, "PMR - Tim Haskins");
  await updateAssistant(OLS_ASSISTANT_ID, "OLS - Investor Calls");
  
  console.log("\n=== Done! ===");
  console.log("Both assistants should now have bookAppointment and checkAvailability tools.");
  console.log("The AI will call these functions via the server URL when a customer wants to book.");
}

main().catch(console.error);
