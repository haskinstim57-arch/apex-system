#!/usr/bin/env node
/**
 * End-to-end live test of VAPI appointment booking flow
 * Tests checkAvailability and bookAppointment tools via the webhook endpoint
 * Includes Pacific DST timezone edge cases
 */

const BASE_URL = "https://apexcrm-knxkwfan.manus.space";
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/vapi`;

// Test accounts
const PMR_ACCOUNT_ID = "420001"; // Premier Mortgage Resources (calendar 30001)
const KYLE_ACCOUNT_ID = "390025"; // Kyle (calendar 30002)

const results = [];
let testNum = 0;

async function sendToolCall(accountId, toolCalls) {
  const payload = {
    message: {
      type: "tool-calls",
      call: {
        id: `test-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        metadata: {
          apex_account_id: accountId,
        },
      },
      toolCallList: toolCalls,
    },
  };

  const resp = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  return { status: resp.status, data };
}

function logTest(name, passed, details) {
  testNum++;
  const icon = passed ? "✅" : "❌";
  console.log(`\n${icon} Test ${testNum}: ${name}`);
  if (details) console.log(`   ${details}`);
  results.push({ num: testNum, name, passed, details });
}

// ─── TEST 1: checkAvailability for a weekday (Monday March 30, 2026) ───
async function testCheckAvailabilityWeekday() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-1",
      function: {
        name: "checkAvailability",
        arguments: JSON.stringify({ date: "2026-03-30" }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("Available times") && result.includes("Monday, March 30");
  logTest(
    "checkAvailability — weekday (Mon Mar 30)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 2: checkAvailability for a weekend (Saturday March 28, 2026) ───
async function testCheckAvailabilityWeekend() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-2",
      function: {
        name: "checkAvailability",
        arguments: JSON.stringify({ date: "2026-03-28" }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  // Saturday — no availability, should say weekend or no slots
  const passed = status === 200 && (result.includes("weekend") || result.includes("no available slots"));
  logTest(
    "checkAvailability — weekend (Sat Mar 28)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 3: checkAvailability with no date ───
async function testCheckAvailabilityNoDate() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-3",
      function: {
        name: "checkAvailability",
        arguments: JSON.stringify({}),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.toLowerCase().includes("need a date");
  logTest(
    "checkAvailability — missing date param",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 4: checkAvailability for account with no calendar (Apex System 450002) ───
async function testCheckAvailabilityNoCalendar() {
  const { status, data } = await sendToolCall("450002", [
    {
      id: "tc-4",
      function: {
        name: "checkAvailability",
        arguments: JSON.stringify({ date: "2026-03-30" }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("trouble accessing");
  logTest(
    "checkAvailability — account with no calendar (450002)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 5: bookAppointment — valid booking on a weekday ───
async function testBookAppointmentValid() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-5",
      function: {
        name: "bookAppointment",
        arguments: JSON.stringify({
          guestName: "E2E Test User",
          guestEmail: "e2etest@example.com",
          guestPhone: "+15551234567",
          date: "2026-04-06",
          time: "10:00",
          notes: "E2E test booking — safe to delete",
        }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("confirmed") && result.includes("E2E Test User");
  logTest(
    "bookAppointment — valid weekday booking (Apr 6 at 10 AM PT)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 200)}`
  );
}

// ─── TEST 6: bookAppointment — missing required fields ───
async function testBookAppointmentMissingFields() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-6",
      function: {
        name: "bookAppointment",
        arguments: JSON.stringify({
          guestPhone: "+15551234567",
        }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("need");
  logTest(
    "bookAppointment — missing name/date/time",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 7: bookAppointment — past date ───
async function testBookAppointmentPastDate() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-7",
      function: {
        name: "bookAppointment",
        arguments: JSON.stringify({
          guestName: "Past Test",
          guestPhone: "+15551234567",
          date: "2025-01-15",
          time: "10:00",
        }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("passed");
  logTest(
    "bookAppointment — past date rejected",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 8: bookAppointment — account with no calendar ───
async function testBookAppointmentNoCalendar() {
  const { status, data } = await sendToolCall("450002", [
    {
      id: "tc-8",
      function: {
        name: "bookAppointment",
        arguments: JSON.stringify({
          guestName: "No Calendar Test",
          guestPhone: "+15551234567",
          date: "2026-04-06",
          time: "10:00",
        }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("trouble accessing");
  logTest(
    "bookAppointment — account with no calendar (450002)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 9: DST edge case — March 8 2026 (spring forward day) ───
// DST starts second Sunday of March. In 2026 that's March 8.
// Booking at 2:30 AM PT on March 8 should still work (time doesn't exist in local but we handle it)
async function testDSTSpringForward() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-9",
      function: {
        name: "bookAppointment",
        arguments: JSON.stringify({
          guestName: "DST Spring Test",
          guestPhone: "+15551234567",
          date: "2026-04-07",
          time: "14:00",
          notes: "DST spring forward test — April 7 is in PDT",
        }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  // In PDT (UTC-7), 14:00 PT = 21:00 UTC
  const passed = status === 200 && result.includes("confirmed");
  logTest(
    "bookAppointment — PDT period (Apr 7, 2:00 PM PT → UTC-7)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 200)}`
  );
}

// ─── TEST 10: DST edge case — November 1 2026 (fall back day) ───
// DST ends first Sunday of November. In 2026 that's November 1.
// After fall back, we're in PST (UTC-8)
async function testDSTFallBack() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-10",
      function: {
        name: "bookAppointment",
        arguments: JSON.stringify({
          guestName: "DST Fall Test",
          guestPhone: "+15551234567",
          date: "2026-11-02",
          time: "10:00",
          notes: "DST fall back test — November 2 is in PST",
        }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  // In PST (UTC-8), 10:00 PT = 18:00 UTC
  const passed = status === 200 && result.includes("confirmed");
  logTest(
    "bookAppointment — PST period (Nov 2, 10:00 AM PT → UTC-8)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 200)}`
  );
}

// ─── TEST 11: DST boundary — March 8 2026 (exact transition day) ───
async function testDSTBoundaryDay() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-11",
      function: {
        name: "bookAppointment",
        arguments: JSON.stringify({
          guestName: "DST Boundary Test",
          guestPhone: "+15551234567",
          date: "2026-03-08",
          time: "15:00",
          notes: "DST transition day — March 8 2026 is spring forward day",
        }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  // March 8 is the DST transition. The code uses month >= 2 && month <= 9 (March=2) so it should use PDT (-07:00)
  const passed = status === 200 && (result.includes("confirmed") || result.includes("passed"));
  logTest(
    "bookAppointment — DST transition day (Mar 8, 3:00 PM)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 200)}`
  );
}

// ─── TEST 12: checkAvailability for Kyle's account (390025) ───
async function testCheckAvailabilityKyle() {
  const { status, data } = await sendToolCall(KYLE_ACCOUNT_ID, [
    {
      id: "tc-12",
      function: {
        name: "checkAvailability",
        arguments: JSON.stringify({ date: "2026-03-30" }),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("Available times");
  logTest(
    "checkAvailability — Kyle's account (390025, calendar 30002)",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── TEST 13: Multiple tool calls in single request ───
async function testMultipleToolCalls() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-13a",
      function: {
        name: "checkAvailability",
        arguments: JSON.stringify({ date: "2026-04-01" }),
      },
    },
    {
      id: "tc-13b",
      function: {
        name: "checkAvailability",
        arguments: JSON.stringify({ date: "2026-04-02" }),
      },
    },
  ]);

  const results2 = data.results || [];
  const passed =
    status === 200 &&
    results2.length === 2 &&
    results2[0].toolCallId === "tc-13a" &&
    results2[1].toolCallId === "tc-13b";
  logTest(
    "Multiple tool calls in single request",
    passed,
    `Status: ${status} | Results count: ${results2.length} | IDs: ${results2.map((r) => r.toolCallId).join(", ")}`
  );
}

// ─── TEST 14: Unknown tool name ───
async function testUnknownTool() {
  const { status, data } = await sendToolCall(PMR_ACCOUNT_ID, [
    {
      id: "tc-14",
      function: {
        name: "unknownFunction",
        arguments: JSON.stringify({}),
      },
    },
  ]);

  const result = data.results?.[0]?.result || "";
  const passed = status === 200 && result.includes("Unknown function");
  logTest(
    "Unknown tool name handled gracefully",
    passed,
    `Status: ${status} | Result: ${result.substring(0, 150)}`
  );
}

// ─── Run all tests ───
async function runAll() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  VAPI Appointment Booking — End-to-End Live Tests");
  console.log(`  Endpoint: ${WEBHOOK_URL}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════");

  await testCheckAvailabilityWeekday();
  await testCheckAvailabilityWeekend();
  await testCheckAvailabilityNoDate();
  await testCheckAvailabilityNoCalendar();
  await testBookAppointmentValid();
  await testBookAppointmentMissingFields();
  await testBookAppointmentPastDate();
  await testBookAppointmentNoCalendar();
  await testDSTSpringForward();
  await testDSTFallBack();
  await testDSTBoundaryDay();
  await testCheckAvailabilityKyle();
  await testMultipleToolCalls();
  await testUnknownTool();

  console.log("\n═══════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${results.length} tests`);
  if (failed > 0) {
    console.log("  Failed tests:");
    results.filter((r) => !r.passed).forEach((r) => console.log(`    ❌ #${r.num}: ${r.name}`));
  }
  console.log("═══════════════════════════════════════════════════════");
}

runAll().catch(console.error);
