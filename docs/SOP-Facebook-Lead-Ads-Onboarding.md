# SOP: Facebook Lead Ads Client Onboarding

**Version:** 1.0
**Last Updated:** March 24, 2026
**Author:** Apex System Engineering

---

## Overview

This document outlines the standard operating procedure for connecting a new client sub-account to Facebook Lead Ads in Apex System. The process is divided into two parts: a **one-time agency setup** (done once for Sterling Marketing) and a **per-client setup** (done for each new sub-account).

---

## Part 1: One-Time Agency Setup (Already Completed)

These steps have already been completed for the Sterling Marketing Facebook App. They only need to be repeated if a new Facebook App is created.

### 1.1 Facebook App Configuration

| Setting | Value |
|---|---|
| **App Name** | Sterling Marketing |
| **App ID** | 3360657884100244 |
| **Callback URL** | `https://apexcrm-knxkwfan.manus.space/api/webhooks/facebook` |
| **Verify Token** | `apexwebtoken` |
| **Subscribed Fields** | `leadgen` (under Page product) |

### 1.2 Required Permissions

The Facebook App must have the following permissions approved:

| Permission | Purpose |
|---|---|
| `leads_retrieval` | Fetch lead form data from the Graph API |
| `pages_manage_ads` | Access ad-related page data |
| `pages_read_engagement` | Read page engagement metrics |
| `pages_show_list` | List all pages the user manages |
| `pages_manage_metadata` | Subscribe pages to webhook events |

### 1.3 Environment Variables

The following environment variables must be set in the Apex System deployment:

| Variable | Description |
|---|---|
| `FACEBOOK_APP_ID` | The Facebook App ID (3360657884100244) |
| `FACEBOOK_APP_SECRET` | The Facebook App Secret (stored securely) |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | The verify token used for webhook verification (`apexwebtoken`) |

---

## Part 2: Per-Client Setup (For Each New Sub-Account)

This is the process that happens for every new client. It is **fully automated** through the Apex System Settings page.

### Step 1: Create the Sub-Account

1. Log in to Apex System as an Agency Admin
2. Navigate to **Admin → Sub-Accounts**
3. Create a new sub-account for the client (e.g., "Kyle's Mortgage Co")
4. Assign an owner user to the sub-account

### Step 2: Connect Facebook (Automated)

1. Switch to the client's sub-account using the account selector in the sidebar
2. Navigate to **Settings → Integrations**
3. Click **"Connect Facebook"** under "Facebook & Instagram Leads"
4. A Facebook OAuth popup will open — the client (or admin) must:
   - Log in to Facebook (if not already logged in)
   - Select the Facebook Page(s) they want to connect
   - Grant all requested permissions
5. After approving, the popup closes and the system **automatically**:
   - Exchanges the short-lived token for a **60-day long-lived token**
   - Fetches all Facebook Pages the user manages
   - Stores each page with its **Page Access Token** in the database
   - Subscribes each page to the `leadgen` webhook via the Graph API
   - Creates a **page mapping** so incoming leads route to the correct sub-account
   - Logs the connection in the audit trail

### Step 3: Verify the Connection

After connecting, the Settings page should show:

- A **green "Connected" badge** with the Facebook user's name
- A list of **linked pages** with their subscription status (green dot = Subscribed)
- A **"Webhook Setup"** button showing the callback URL and verify token

### Step 4: Test with a Real Lead

1. Go to the [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing)
2. Select the client's Facebook Page
3. Select the form to test
4. Click **"Create lead"**
5. Click **"Track status"** — the Sterling Marketing app should show **"Success"**
6. Check the client's sub-account in Apex System → **Contacts** — the lead should appear within 30-60 seconds

---

## Troubleshooting Guide

### Lead shows "Success" in Meta but doesn't appear in Apex

| Check | How to Verify | Fix |
|---|---|---|
| Page mapping exists | Check Settings → Integrations → Facebook shows "Connected" with pages listed | Re-connect Facebook via Settings |
| Page is subscribed | Page shows green dot "Subscribed" next to its name | Disconnect and re-connect Facebook |
| Webhook URL is correct | Click "Webhook Setup" — URL should be `https://apexcrm-knxkwfan.manus.space/api/webhooks/facebook` | Update in Facebook App settings |
| Verify token matches | Click "Webhook Setup" — token should match what's in Facebook App | Update in Facebook App settings |
| App is published | Facebook App Dashboard should show "Published" status | Publish the app in Facebook Developer Console |
| Permissions approved | All 5 permissions should be approved in App Review | Submit for App Review if needed |

### Settings page shows "Connect Facebook" even though it was connected

This means the OAuth flow did not complete successfully. Common causes:

1. **Popup was blocked** — ensure the browser allows popups from the Apex System domain
2. **User closed the popup before completing** — try connecting again
3. **Facebook returned an error** — check the browser console for error messages

**Fix:** Simply click "Connect Facebook" again and complete the full OAuth flow.

### Lead arrives but with no name/email/phone

This means the **Page Access Token** is missing or expired. The system falls back to creating a "Facebook Lead" contact with no details.

**Fix:** Disconnect Facebook in Settings, then re-connect to get a fresh Page Access Token.

---

## Token Refresh Schedule

Facebook long-lived tokens expire after **60 days**. The system stores the expiration date. Before the token expires, the admin should:

1. Navigate to the client's sub-account Settings
2. Disconnect Facebook
3. Re-connect Facebook to get a fresh 60-day token

A future improvement will add automatic token refresh notifications.

---

## Architecture Summary

```
Meta Lead Ads Testing Tool / Real Ad
         │
         ▼
Facebook Webhook (POST /api/webhooks/facebook)
         │
         ▼
Apex System Webhook Handler
         │
         ├── Look up page_id in account_facebook_pages table
         │   (maps page to sub-account)
         │
         ├── Fetch full lead data from Graph API
         │   (using stored Page Access Token)
         │
         ├── Create contact in the sub-account
         │   (name, email, phone, source: "facebook")
         │
         └── Trigger workflow engine
             (lead assignment, notifications, automations)
```

---

## Checklist for New Client Onboarding

- [ ] Sub-account created in Apex System
- [ ] Owner user assigned to sub-account
- [ ] Facebook connected via Settings → Integrations
- [ ] Pages show as "Subscribed" in Settings
- [ ] Test lead sent from Meta Lead Ads Testing Tool
- [ ] Test lead appears in sub-account Contacts
- [ ] Client notified of successful setup
