import { Router } from "express";
import crypto from "crypto";
import { getDb } from "../db";
import { apiKeys, contacts, inboundRequestLogs } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { onContactCreated } from "../services/workflowTriggers";

export const inboundApiRouter = Router();

// ─── Rate limiting (simple in-memory) ─────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per API key

function checkRateLimit(keyPrefix: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(keyPrefix);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyPrefix, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ─── API Key authentication middleware ────────────────────────
async function authenticateApiKey(
  apiKeyHeader: string | undefined,
  requiredPermission: string
): Promise<{ accountId: number; apiKeyId: number; keyPrefix: string } | { error: string; status: number }> {
  if (!apiKeyHeader) {
    return { error: "Missing X-API-Key header", status: 401 };
  }

  const db = await getDb();
  if (!db) {
    return { error: "Service unavailable", status: 503 };
  }

  // Hash the provided key and look it up
  const keyHash = crypto.createHash("sha256").update(apiKeyHeader).digest("hex");
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt)
      )
    );

  if (!key) {
    return { error: "Invalid or revoked API key", status: 401 };
  }

  // Check rate limit
  if (!checkRateLimit(key.keyPrefix)) {
    return { error: "Rate limit exceeded. Max 60 requests per minute.", status: 429 };
  }

  // Check permissions
  const permissions = key.permissions as string[];
  if (!permissions.includes(requiredPermission) && !permissions.includes("*")) {
    return { error: `API key does not have '${requiredPermission}' permission`, status: 403 };
  }

  // Update last used
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .catch(() => {}); // fire-and-forget

  return { accountId: key.accountId, apiKeyId: key.id, keyPrefix: key.keyPrefix };
}

// ─── Log inbound request ──────────────────────────────────────
async function logInboundRequest(
  accountId: number | null,
  apiKeyId: number | null,
  endpoint: string,
  method: string,
  requestBody: unknown,
  responseStatus: number,
  success: boolean,
  errorMessage: string | null,
  ipAddress: string | null
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(inboundRequestLogs).values({
      accountId,
      apiKeyId,
      endpoint,
      method,
      requestBody: requestBody as any,
      responseStatus,
      success,
      errorMessage,
      ipAddress,
    });
  } catch (err) {
    console.error("[InboundAPI] Failed to log request:", err);
  }
}

// ─── POST /api/inbound/contacts ───────────────────────────────
inboundApiRouter.post("/api/inbound/contacts", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || null;
  const auth = await authenticateApiKey(
    req.headers["x-api-key"] as string | undefined,
    "contacts:create"
  );

  if ("error" in auth) {
    await logInboundRequest(null, null, "/api/inbound/contacts", "POST", req.body, auth.status, false, auth.error, ip);
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { firstName, lastName, email, phone, source, tags } = req.body;

    if (!firstName && !email && !phone) {
      const errMsg = "At least one of firstName, email, or phone is required";
      await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/contacts", "POST", req.body, 400, false, errMsg, ip);
      return res.status(400).json({ error: errMsg });
    }

    const db = await getDb();
    if (!db) {
      await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/contacts", "POST", req.body, 503, false, "Database unavailable", ip);
      return res.status(503).json({ error: "Service unavailable" });
    }

    // Create the contact
    const [result] = await db.insert(contacts).values({
      accountId: auth.accountId,
      firstName: firstName || "",
      lastName: lastName || "",
      email: email || null,
      phone: phone || null,
      leadSource: source || "api",
      status: "new",
    });

    const contactId = result.insertId;

    // Add tags if provided (via contactTags table)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      try {
        const { contactTags } = await import("../../drizzle/schema");
        await Promise.all(
          tags.map((tag: string) =>
            db.insert(contactTags).values({
              contactId: Number(contactId),
              tag: tag.trim(),
            })
          )
        );
      } catch {
        // Don't fail if tags insertion fails
      }
    }

    // Fire workflow triggers
    try {
      await onContactCreated(auth.accountId, Number(contactId));
    } catch {
      // Don't fail the API call if workflow trigger fails
    }

    await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/contacts", "POST", req.body, 201, true, null, ip);

    return res.status(201).json({
      success: true,
      contactId: Number(contactId),
      message: "Contact created successfully",
    });
  } catch (err: any) {
    console.error("[InboundAPI] Error creating contact:", err);
    await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/contacts", "POST", req.body, 500, false, err.message, ip);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/inbound/events ─────────────────────────────────
inboundApiRouter.post("/api/inbound/events", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || null;
  const auth = await authenticateApiKey(
    req.headers["x-api-key"] as string | undefined,
    "events:create"
  );

  if ("error" in auth) {
    await logInboundRequest(null, null, "/api/inbound/events", "POST", req.body, auth.status, false, auth.error, ip);
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { contactId, event, data } = req.body;

    if (!event) {
      const errMsg = "event field is required";
      await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/events", "POST", req.body, 400, false, errMsg, ip);
      return res.status(400).json({ error: errMsg });
    }

    const db = await getDb();
    if (!db) {
      await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/events", "POST", req.body, 503, false, "Database unavailable", ip);
      return res.status(503).json({ error: "Service unavailable" });
    }

    // If contactId provided, verify it belongs to this account
    if (contactId) {
      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, contactId),
            eq(contacts.accountId, auth.accountId)
          )
        );
      if (!contact) {
        const errMsg = "Contact not found in this account";
        await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/events", "POST", req.body, 404, false, errMsg, ip);
        return res.status(404).json({ error: errMsg });
      }
    }

    // Log the event as an inbound request log (the event itself is the log)
    await logInboundRequest(
      auth.accountId,
      auth.apiKeyId,
      "/api/inbound/events",
      "POST",
      { contactId, event, data },
      200,
      true,
      null,
      ip
    );

    return res.status(200).json({
      success: true,
      message: "Event recorded successfully",
      event,
      contactId: contactId || null,
    });
  } catch (err: any) {
    console.error("[InboundAPI] Error recording event:", err);
    await logInboundRequest(auth.accountId, auth.apiKeyId, "/api/inbound/events", "POST", req.body, 500, false, err.message, ip);
    return res.status(500).json({ error: "Internal server error" });
  }
});
