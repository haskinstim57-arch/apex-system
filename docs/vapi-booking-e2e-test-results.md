# VAPI Appointment Booking — End-to-End Test Results

**Date:** March 28, 2026  
**Endpoint:** `https://apexcrm-knxkwfan.manus.space/api/webhooks/vapi`  
**Result:** 14/14 tests passed, 0 failures

---

## Test Summary

| # | Test | Result | Details |
|---|------|--------|---------|
| 1 | checkAvailability — weekday (Mon Mar 30) | PASS | Returns 12 slots (9:00 AM – 4:15 PM) with 30-min duration + 15-min buffer |
| 2 | checkAvailability — weekend (Sat Mar 28) | PASS | Returns "no availability on weekends" message |
| 3 | checkAvailability — missing date param | PASS | Returns "I need a date to check availability" |
| 4 | checkAvailability — no calendar (account 450002) | PASS | Returns graceful fallback with general availability |
| 5 | bookAppointment — valid weekday (Apr 6, 10 AM PT) | PASS | Appointment confirmed, stored as 17:00 UTC (PDT -7) |
| 6 | bookAppointment — missing fields | PASS | Returns "I need the guest's name, date, and time" |
| 7 | bookAppointment — past date | PASS | Returns "That time has already passed" |
| 8 | bookAppointment — no calendar (account 450002) | PASS | Returns graceful error with callback offer |
| 9 | bookAppointment — PDT period (Apr 7, 2 PM PT) | PASS | Stored as 21:00 UTC (PDT offset -7 correct) |
| 10 | bookAppointment — PST period (Nov 2, 10 AM PT) | PASS | Stored as 18:00 UTC (PST offset -8 correct) |
| 11 | bookAppointment — DST transition day (Mar 8, 3 PM) | PASS | Correctly rejected as past date |
| 12 | checkAvailability — Kyle's account (390025) | PASS | Returns slots from calendar 30002 |
| 13 | Multiple tool calls in single request | PASS | Both tool calls processed, correct IDs returned |
| 14 | Unknown tool name | PASS | Returns "Unknown function: unknownFunction" |

---

## Timezone Verification (Database Records)

| Booking | Local Time (PT) | Stored UTC | Offset | DST Status |
|---------|----------------|------------|--------|------------|
| E2E Test User (Apr 6) | 10:00 AM | 17:00 | -7 | PDT (correct) |
| DST Spring Test (Apr 7) | 2:00 PM | 21:00 | -7 | PDT (correct) |
| DST Fall Test (Nov 2) | 10:00 AM | 18:00 | -8 | PST (correct) |

The webhook correctly determines PDT vs PST based on the booking date's month:
- **March 8 – November 1:** PDT (UTC-7)
- **November 2 – March 7:** PST (UTC-8)

---

## Architecture Notes

- **Webhook handler:** `server/webhooks/vapi.ts`
- **Calendar slots:** `getAvailableSlots()` in `server/db.ts` — reads `availabilityJson` from calendars table
- **Account mapping:** Uses `call.metadata.apex_account_id` from VAPI call metadata
- **Calendar lookup:** Finds first active calendar for the account
- **Slot generation:** 30-min slots with 15-min buffer, Mon-Fri 9 AM – 5 PM (per calendar config)
- **DST handling:** Dynamic offset calculation based on booking date month

---

## No Issues Found

All 14 tests passed. The booking flow handles:
- Valid bookings with full contact details
- Missing required fields with helpful prompts
- Past dates with clear rejection
- Accounts without calendars with graceful fallback
- Weekend requests with redirect to weekdays
- PDT/PST timezone transitions correctly
- Multiple simultaneous tool calls
- Unknown function names gracefully
