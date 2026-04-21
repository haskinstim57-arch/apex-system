# API Key Rotation Log

> **CONFIDENTIAL** — Do NOT log actual key values. This file tracks rotation events only.

## Rotation Event: 2026-04-21 — Vercel Next.js Security Breach Response

**Trigger:** Potential exposure of server-side environment variables via Vercel/Next.js security vulnerability.
**Initiated by:** Tariq (Head of Marketing / Founder)
**Executed by:** Apex System engineering

### Third-Party API Keys — Rotation Status

| # | Key Name | Provider | Rotation Status | Rotated At | Notes |
|---|----------|----------|----------------|------------|-------|
| 1 | SENDGRID_API_KEY | SendGrid | PENDING | — | Generate new key in SendGrid → Settings → API Keys |
| 2 | GEMINI_API_KEY | Google AI Studio | PENDING | — | Generate new key in Google AI Studio → API Keys |
| 3 | FACEBOOK_APP_SECRET | Meta Developer Console | PENDING | — | App Settings → Basic → Show/Reset App Secret |
| 4 | FACEBOOK_WEBHOOK_VERIFY_TOKEN | Self-generated | PENDING | — | Generate new random token, update in Meta webhook config |
| 5 | GOOGLE_CLIENT_SECRET | Google Cloud Console | PENDING | — | APIs & Services → Credentials → OAuth 2.0 Client |
| 6 | MICROSOFT_CLIENT_SECRET | Azure AD | PENDING | — | App registrations → Certificates & Secrets |
| 7 | SQUARE_ACCESS_TOKEN | Square Developer Dashboard | PENDING | — | Applications → Production → Access Token |
| 8 | SQUARE_WEBHOOK_SIGNATURE_KEY | Square Developer Dashboard | PENDING | — | Webhooks → Signature Key |
| 9 | VAPI_API_KEY | VAPI Dashboard | PENDING | — | Settings → API Keys |
| 10 | ELEVENLABS_API_KEY | ElevenLabs Dashboard | PENDING | — | Profile → API Keys |
| 11 | BLOOIO_API_KEY | Blooio Dashboard | PENDING | — | Settings → API Keys |
| 12 | ENCRYPTION_KEY | Internal (self-generated) | PENDING | — | **CAUTION:** Requires re-encrypting all stored tokens in DB |
| 13 | VAPID_PRIVATE_KEY | Internal (web-push) | PENDING | — | Regenerate VAPID keypair; existing push subscriptions invalidated |

### Platform-Managed Keys — Flagged for Separate Rotation

| Key Name | Owner | Rotation Status | Notes |
|----------|-------|----------------|-------|
| BUILT_IN_FORGE_API_KEY | Manus Platform | FLAGGED | Contact Manus support for rotation |
| JWT_SECRET | Manus Platform | FLAGGED | Rotation logs out ALL active sessions |
| DATABASE_URL | Manus Platform | FLAGGED | Rotate via Manus DB panel; requires connection string update |

### Config Values — No Rotation Needed (public identifiers / non-secrets)

FACEBOOK_APP_ID, GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID, SQUARE_LOCATION_ID, VITE_SQUARE_APPLICATION_ID, VITE_SQUARE_ENVIRONMENT, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME, VAPID_PUBLIC_KEY, VAPID_SUBJECT, VAPI_AGENT_ID, VAPI_AGENT_ID_REALTOR, VAPI_AGENT_ID_INSTAGRAM, SUPPORT_NOTIFICATION_EMAILS, VITE_APP_URL

### Smoke Test Results

| Service | Test | Status | Tested At |
|---------|------|--------|-----------|
| SendGrid | Test email send | PENDING | — |
| Gemini | LLM completion call | PENDING | — |
| Facebook | Webhook signature validation | PENDING | — |
| Square | Payment intent creation | PENDING | — |
| Blooio | SMS send test | PENDING | — |

---

*This log is append-only. Do not delete entries. Add new rotation events below.*
