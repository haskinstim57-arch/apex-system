/**
 * Update both VAPI assistants with:
 * 1. serverUrl pointing to our webhook
 * 2. bookAppointment tool for function calling
 * 3. checkAvailability tool for checking available slots
 */

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const SERVER_URL = "https://apexcrm-knxkwfan.manus.space/api/webhooks/vapi";

const assistants = [
  {
    id: "01504ee9-0d19-4e2f-97e7-6907a5ebb34c",
    name: "PMR - Tim Haskins",
    accountId: 420001,
    calendarId: 30001,
  },
  {
    id: "6cead709-383a-4dbe-943c-6d7b485fafe6",
    name: "OLS - Investor Calls",
    accountId: 390025,
    calendarId: 30002,
  },
];

const tools = [
  {
    type: "function",
    function: {
      name: "checkAvailability",
      description: "Check available appointment time slots for a specific date. Call this BEFORE booking to see what times are open. Always check availability before suggesting times to the caller.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to check availability for, in YYYY-MM-DD format (e.g., 2026-03-27)",
          },
        },
        required: ["date"],
      },
    },
    server: {
      url: SERVER_URL,
    },
  },
  {
    type: "function",
    function: {
      name: "bookAppointment",
      description: "Book a consultation appointment for the caller. You MUST collect the caller's full name, preferred date and time, and phone number before calling this function. Email is optional but preferred.",
      parameters: {
        type: "object",
        properties: {
          guestName: {
            type: "string",
            description: "The full name of the person booking the appointment",
          },
          guestEmail: {
            type: "string",
            description: "The email address of the person booking (if provided)",
          },
          guestPhone: {
            type: "string",
            description: "The phone number of the person booking",
          },
          date: {
            type: "string",
            description: "The appointment date in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "The appointment start time in HH:MM format (24-hour, e.g., 14:00 for 2 PM)",
          },
          notes: {
            type: "string",
            description: "Any notes about the appointment (e.g., loan type interest, property details)",
          },
        },
        required: ["guestName", "guestPhone", "date", "time"],
      },
    },
    server: {
      url: SERVER_URL,
    },
  },
];

async function updateAssistant(assistant) {
  console.log(`\nUpdating ${assistant.name} (${assistant.id})...`);

  // First get the current assistant config
  const getRes = await fetch(`https://api.vapi.ai/assistant/${assistant.id}`, {
    headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
  });
  const current = await getRes.json();

  // Update with tools and serverUrl
  const updatePayload = {
    serverUrl: SERVER_URL,
    serverMessages: [
      "end-of-call-report",
      "status-update",
      "tool-calls",
      "transfer-destination-request",
    ],
    model: {
      ...current.model,
      tools: tools,
    },
  };

  const res = await fetch(`https://api.vapi.ai/assistant/${assistant.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAILED: ${res.status} ${err}`);
    return false;
  }

  const updated = await res.json();
  console.log(`  ✅ Updated successfully`);
  console.log(`  serverUrl: ${updated.serverUrl}`);
  console.log(`  tools: ${updated.model?.tools?.length || 0} tools configured`);
  console.log(`  serverMessages: ${JSON.stringify(updated.serverMessages)}`);
  return true;
}

async function main() {
  console.log("=== Updating VAPI Assistants with Booking Tools ===\n");
  console.log(`Server URL: ${SERVER_URL}`);

  for (const assistant of assistants) {
    await updateAssistant(assistant);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
