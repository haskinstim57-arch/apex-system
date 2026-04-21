# API Key Rotation Procedure

> Step-by-step instructions for rotating each third-party API key used by Apex System.

## General Process

For each key: **(1)** Generate new key in provider dashboard → **(2)** Update in Manus deployment via Secrets panel → **(3)** Verify service works with smoke test → **(4)** Revoke old key in provider dashboard → **(5)** Log rotation in KEY_ROTATION_LOG.md.

**Order matters:** Always update the deployment BEFORE revoking the old key to avoid downtime.

---

## 1. SENDGRID_API_KEY

1. Log in to [SendGrid](https://app.sendgrid.com)
2. Go to **Settings → API Keys → Create API Key**
3. Name it `apex-system-prod-YYYYMMDD`, grant **Full Access** (or same scopes as current key)
4. Copy the new key (shown only once)
5. Update in Manus Secrets panel
6. Run smoke test: send test email
7. Delete the old API key in SendGrid dashboard

## 2. GEMINI_API_KEY

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API Key** → select the same GCP project
3. Copy the new key
4. Update in Manus Secrets panel
5. Run smoke test: invoke LLM completion
6. Delete the old key in Google AI Studio

## 3. FACEBOOK_APP_SECRET

1. Go to [Meta Developer Console](https://developers.facebook.com)
2. Select the Apex System app → **Settings → Basic**
3. Click **Show** next to App Secret, then **Reset App Secret**
4. Copy the new secret
5. Update in Manus Secrets panel
6. Run smoke test: verify webhook signature validation
7. **Note:** Resetting automatically revokes the old secret

## 4. FACEBOOK_WEBHOOK_VERIFY_TOKEN

1. Generate a new random token: `openssl rand -hex 32`
2. Update in Manus Secrets panel
3. Go to Meta Developer Console → **Webhooks → Edit Subscription**
4. Update the Verify Token field with the new value
5. Click **Verify and Save**

## 5. GOOGLE_CLIENT_SECRET

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Click the OAuth 2.0 Client ID used by Apex System
4. Click **Reset Secret** (or create a new client)
5. Copy the new secret
6. Update in Manus Secrets panel
7. Run smoke test: test Google Calendar OAuth flow
8. **Note:** Resetting automatically revokes the old secret

## 6. MICROSOFT_CLIENT_SECRET

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory → App Registrations**
2. Select the Apex System app → **Certificates & Secrets**
3. Click **New client secret**, set expiry
4. Copy the new secret value (shown only once)
5. Update in Manus Secrets panel
6. Delete the old secret in the same panel

## 7. SQUARE_ACCESS_TOKEN

1. Go to [Square Developer Dashboard](https://developer.squareup.com)
2. Select the Apex System application → **Production** tab
3. Under **Access Token**, click **Replace** or generate a new token
4. Copy the new token
5. Update in Manus Secrets panel
6. Run smoke test: create a test payment intent
7. **Note:** Replacing automatically revokes the old token

## 8. SQUARE_WEBHOOK_SIGNATURE_KEY

1. In Square Developer Dashboard → **Webhooks**
2. Click the webhook subscription → **Signature Key**
3. Click **Rotate** to generate a new signature key
4. Copy the new key
5. Update in Manus Secrets panel

## 9. VAPI_API_KEY

1. Go to [VAPI Dashboard](https://dashboard.vapi.ai)
2. Navigate to **Settings → API Keys**
3. Create a new API key or rotate the existing one
4. Copy the new key
5. Update in Manus Secrets panel
6. Delete/revoke the old key

## 10. ELEVENLABS_API_KEY

1. Go to [ElevenLabs](https://elevenlabs.io)
2. Click your profile → **API Keys**
3. Create a new API key
4. Copy the new key
5. Update in Manus Secrets panel
6. Delete the old key

## 11. BLOOIO_API_KEY

1. Log in to [Blooio Dashboard](https://app.blooio.com)
2. Navigate to **Settings → API Keys**
3. Generate a new API key
4. Copy the new key
5. Update in Manus Secrets panel
6. Run smoke test: send test SMS
7. Revoke the old key

## 12. ENCRYPTION_KEY

> **CAUTION:** This key encrypts stored OAuth tokens (Google, Microsoft, Facebook page tokens) in the database. Rotating it requires re-encrypting ALL stored tokens.

1. Generate a new 32-byte hex key: `openssl rand -hex 32`
2. **Before updating:** Run the re-encryption migration script (see below)
3. Update in Manus Secrets panel
4. Verify all stored tokens can be decrypted with the new key

**Re-encryption script needed:** A migration script must decrypt all tokens with the old key and re-encrypt with the new key in a single transaction.

## 13. VAPID_PRIVATE_KEY + VAPID_PUBLIC_KEY

> **Note:** Rotating VAPID keys invalidates ALL existing push notification subscriptions. Users will need to re-subscribe.

1. Generate new VAPID keypair: `npx web-push generate-vapid-keys`
2. Update both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Manus Secrets panel
3. Also update VITE_VAPID_PUBLIC_KEY (frontend)
4. Clear all push subscriptions from the database
5. Users will be prompted to re-subscribe on next visit

---

## Platform-Managed Keys

These keys are managed by the Manus platform and require separate rotation procedures:

| Key | Action Required |
|-----|----------------|
| BUILT_IN_FORGE_API_KEY | Contact Manus support at https://help.manus.im |
| JWT_SECRET | Contact Manus support — **WARNING: logs out all users** |
| DATABASE_URL | Rotate via Manus DB panel in Settings |

---

## Post-Rotation Checklist

- [ ] All 13 third-party keys rotated
- [ ] All old keys revoked in provider dashboards
- [ ] Smoke tests pass for all services
- [ ] KEY_ROTATION_LOG.md updated with timestamps
- [ ] Platform keys flagged for Manus support
- [ ] Server restarted after all updates
