# Trigger Source Audit — All Call Sites

## Summary of All Trigger Functions (from workflowTriggers.ts)

| Function | Canonical Trigger Type |
|---|---|
| onContactCreated | contact_created |
| onTagAdded | tag_added |
| onPipelineStageChanged | pipeline_stage_changed |
| onFacebookLeadReceived | facebook_lead_received |
| onCallCompleted | call_completed |
| onInboundMessageReceived | inbound_message_received |
| onAppointmentBooked | appointment_booked |
| onAppointmentCancelled | appointment_cancelled |
| onMissedCall | missed_call |
| onFormSubmitted | form_submitted |

## Call Site Analysis

### 1. server/webhooks/facebookLeads.ts — fireTriggers()
- **Fires**: onFacebookLeadReceived ONLY ✅ (fixed in previous prompt)
- **Verdict**: CLEAN

### 2. server/routers/contacts.ts — create mutation
- **Fires**: onContactCreated ✅
- **Also fires**: onFacebookLeadReceived IF leadSource contains "facebook" ✅
- **Verdict**: CLEAN — manual contact creation fires contact_created. If source is facebook, also fires facebook_lead_received. These are two DIFFERENT trigger types matching different workflows, not duplicates.

### 3. server/routers/contacts.ts — update mutation
- **Fires**: onPipelineStageChanged (only when status changes) ✅
- **Verdict**: CLEAN

### 4. server/routers/contacts.ts — addTag mutation
- **Fires**: onTagAdded ✅
- **Verdict**: CLEAN

### 5. server/routers/contacts.ts — create mutation (tags on creation)
- **Fires**: onTagAdded for each tag ✅
- **Verdict**: CLEAN — tags added during creation fire tag_added, which is correct

### 6. server/routers/automations.ts — testFacebookLead mutation
- **Fires**: onFacebookLeadReceived ✅
- **Verdict**: CLEAN — test endpoint fires only the facebook trigger

### 7. server/routers/calendar.ts — cancel appointment
- **Fires**: onAppointmentCancelled ✅
- **Verdict**: CLEAN

### 8. server/routers/calendar.ts — book appointment (public booking)
- **Fires**: onAppointmentBooked ✅
- **Verdict**: CLEAN

### 9. server/routers/forms.ts — form submission
- **Fires**: onFormSubmitted ✅
- **Verdict**: CLEAN

### 10. server/routers/pipeline.ts — move deal stage
- **Fires**: onPipelineStageChanged ✅
- **Verdict**: CLEAN

### 11. server/webhooks/twilioVoiceStatus.ts — missed call
- **Fires**: onMissedCall ✅
- **Verdict**: CLEAN

### 12. server/webhooks/twilioVoiceStatus.ts — call completed
- **Fires**: onCallCompleted ✅
- **Verdict**: CLEAN

### 13. server/webhooks/inboundMessages.ts — inbound SMS
- **Fires**: onInboundMessageReceived(accountId, contactId, "sms") ✅
- **Verdict**: CLEAN

### 14. server/webhooks/inboundMessages.ts — inbound email
- **Fires**: onInboundMessageReceived(accountId, contactId, "email") ✅
- **Verdict**: CLEAN

### 15. server/webhooks/inboundApi.ts — API contact creation
- **Fires**: onContactCreated ✅
- **Verdict**: CLEAN — API-created contacts fire contact_created only

### 16. server/webhooks/vapi.ts — AI appointment booked
- **Fires**: onAppointmentBooked ✅
- **Verdict**: CLEAN

### 17. server/webhooks/vapi.ts — AI call completed
- **Fires**: onCallCompleted ✅
- **Verdict**: CLEAN

### 18. server/webhooks/webchat.ts — webchat visitor creates contact
- **Fires**: onContactCreated + onFormSubmitted ⚠️ CROSS-FIRE
- **Issue**: Webchat visitor info capture fires BOTH contact_created AND form_submitted.
  A workflow listening on contact_created AND another on form_submitted would both fire.
  If the SAME workflow listens on both triggers, the dedup guard catches it.
  But if a user has a "Welcome Email" on contact_created AND a "Form Follow-up" on form_submitted,
  the contact gets BOTH — which may or may not be intended.
- **Risk**: MEDIUM — webchat is a form-like interaction, so form_submitted is arguably correct.
  But it also creates a contact, so contact_created is also correct.
  The question is: should webchat fire BOTH or just one?

### 19. server/webhooks/webchat.ts — webchat message received
- **Fires**: onInboundMessageReceived(accountId, contactId, "email") ⚠️ WRONG CHANNEL
- **Issue**: Webchat messages are fired as channel "email" but webchat is not email.
  This means a workflow filtering on channel="email" would incorrectly match webchat messages.
- **Risk**: LOW-MEDIUM — if no workflows filter by channel, no impact. But semantically wrong.

## Issues Found

### Issue A: webchat.ts fires onContactCreated + onFormSubmitted (cross-fire)
- Lines 68-75 in webchat.ts
- Recommendation: Remove onContactCreated — webchat is a form-like interaction, so form_submitted is the canonical trigger. The contact creation is a side effect, not the user action.

### Issue B: webchat.ts fires onInboundMessageReceived with channel "email" for webchat messages
- Line 228 in webchat.ts
- Recommendation: This should use a "webchat" channel or just not fire inbound_message_received for webchat messages (since webchat has its own flow). However, changing the channel type requires updating the type definition.
