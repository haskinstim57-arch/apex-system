import { Router } from "express";
import {
  getChatWidgetByKey,
  getWebchatSessionByKey,
  createWebchatSession,
  updateWebchatSession,
  createWebchatMessage,
  listWebchatMessages,
  createContact,
  getDb,
  logContactActivity,
} from "../db";
import { contacts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { onInboundMessageReceived, onFormSubmitted } from "../services/workflowTriggers";
import crypto from "crypto";

export const webchatWebhookRouter = Router();

// ─── Helper: detect human handoff intent ───
function detectHandoff(message: string, keywords: string): boolean {
  if (!keywords) return false;
  const kwList = keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const lower = message.toLowerCase();
  return kwList.some((kw) => lower.includes(kw));
}

// ─── Helper: find or create contact from visitor info ───
async function findOrCreateContact(
  accountId: number,
  email: string | undefined,
  name: string | undefined,
  pageUrl: string | undefined
): Promise<number | null> {
  if (!email) return null;
  const db = await getDb();
  if (!db) return null;

  // Try to find existing contact by email
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), eq(contacts.email, email)))
    .limit(1);

  if (existing) return existing.id;

  // Create new contact
  const firstName = name?.split(" ")[0] || "Webchat";
  const lastName = name?.split(" ").slice(1).join(" ") || "Visitor";

  const { id: contactId } = await createContact({
    accountId,
    firstName,
    lastName,
    email,
    phone: null,
    leadSource: "webchat",
    status: "new",
    customFields: JSON.stringify({ webchatPageUrl: pageUrl || "" }),
  });

  // Fire form_submitted workflow trigger (webchat visitor info = form-like submission).
  // Do NOT fire onContactCreated here — webchat is a form interaction, not a manual contact creation.
  // Firing both would cause duplicate automations for the same lead.
  onFormSubmitted(accountId, contactId, "webchat-widget").catch((err) =>
    console.error("[Webchat] Failed to fire form_submitted trigger:", err)
  );

  logContactActivity({
    contactId,
    accountId,
    activityType: "webchat_started",
    description: `Webchat conversation started from ${pageUrl || "unknown page"}`,
    metadata: JSON.stringify({ source: "webchat", email, name }),
  });

  return contactId;
}

// ─── POST /api/webchat/init — Initialize or resume a session ───
webchatWebhookRouter.post("/api/webchat/init", async (req, res) => {
  try {
    const { widgetKey, sessionKey, visitorName, visitorEmail, pageUrl } = req.body;
    if (!widgetKey) {
      return res.status(400).json({ error: "widgetKey is required" });
    }

    const widget = await getChatWidgetByKey(widgetKey);
    if (!widget) {
      return res.status(404).json({ error: "Widget not found or inactive" });
    }

    // Check allowed domains
    if (widget.allowedDomains) {
      const origin = req.headers.origin || req.headers.referer || "";
      const allowed = widget.allowedDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
      if (allowed.length > 0) {
        const originHost = (() => {
          try { return new URL(origin).hostname.toLowerCase(); } catch { return ""; }
        })();
        if (originHost && !allowed.some((d) => originHost === d || originHost.endsWith("." + d))) {
          return res.status(403).json({ error: "Domain not allowed" });
        }
      }
    }

    // Resume existing session
    if (sessionKey) {
      const existing = await getWebchatSessionByKey(sessionKey);
      if (existing && existing.widgetId === widget.id) {
        // Update contact link if visitor info provided now
        if (visitorEmail && !existing.contactId) {
          const contactId = await findOrCreateContact(
            widget.accountId,
            visitorEmail,
            visitorName,
            pageUrl
          );
          if (contactId) {
            await updateWebchatSession(existing.id, {
              contactId,
              visitorName: visitorName || existing.visitorName,
              visitorEmail: visitorEmail || existing.visitorEmail,
            });
          }
        }
        const messages = await listWebchatMessages(existing.id, widget.accountId);
        return res.json({
          sessionKey: existing.sessionKey,
          sessionId: existing.id,
          greeting: widget.greeting,
          brandColor: widget.brandColor,
          position: widget.position,
          collectVisitorInfo: widget.collectVisitorInfo,
          hasVisitorInfo: !!(existing.visitorEmail || visitorEmail),
          messages: messages.map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            createdAt: m.createdAt,
          })),
        });
      }
    }

    // Create new session
    const newSessionKey = sessionKey || crypto.randomBytes(16).toString("hex");
    const contactId = await findOrCreateContact(
      widget.accountId,
      visitorEmail,
      visitorName,
      pageUrl
    );

    const { id: sessionId } = await createWebchatSession({
      widgetId: widget.id,
      accountId: widget.accountId,
      sessionKey: newSessionKey,
      contactId,
      visitorName: visitorName || null,
      visitorEmail: visitorEmail || null,
      handoffRequested: false,
      agentTakenOver: false,
      agentUserId: null,
      status: "active",
      pageUrl: pageUrl || null,
      ipAddress: (req.ip || req.socket.remoteAddress || "").replace("::ffff:", ""),
      userAgent: req.headers["user-agent"] || null,
    });

    return res.json({
      sessionKey: newSessionKey,
      sessionId,
      greeting: widget.greeting,
      brandColor: widget.brandColor,
      position: widget.position,
      collectVisitorInfo: widget.collectVisitorInfo,
      hasVisitorInfo: !!visitorEmail,
      messages: [],
    });
  } catch (err: any) {
    console.error("[Webchat] Init error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/webchat/message — Visitor sends a message ───
webchatWebhookRouter.post("/api/webchat/message", async (req, res) => {
  try {
    const { widgetKey, sessionKey, content } = req.body;
    if (!widgetKey || !sessionKey || !content) {
      return res.status(400).json({ error: "widgetKey, sessionKey, and content are required" });
    }

    const widget = await getChatWidgetByKey(widgetKey);
    if (!widget) {
      return res.status(404).json({ error: "Widget not found or inactive" });
    }

    const session = await getWebchatSessionByKey(sessionKey);
    if (!session || session.widgetId !== widget.id) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.status === "closed") {
      return res.status(400).json({ error: "Session is closed" });
    }

    // Save visitor message
    const { id: visitorMsgId } = await createWebchatMessage({
      sessionId: session.id,
      accountId: widget.accountId,
      sender: "visitor",
      content,
      isRead: false,
    });

    // Fire inbound_message_received workflow trigger
    // Use "sms" channel as a generic real-time messaging channel (webchat behaves like SMS, not email).
    // This avoids incorrectly matching email-only workflow filters.
    if (session.contactId) {
      onInboundMessageReceived(widget.accountId, session.contactId, "sms").catch((err) =>
        console.error("[Webchat] Failed to fire inbound_message_received trigger:", err)
      );

      logContactActivity({
        contactId: session.contactId,
        accountId: widget.accountId,
        activityType: "webchat_message",
        description: `Webchat message received: "${content.substring(0, 100)}"`,
        metadata: JSON.stringify({
          sessionId: session.id,
          direction: "inbound",
          channel: "webchat",
        }),
      });
    }

    // Check for human handoff keywords
    const handoffDetected = detectHandoff(content, widget.handoffKeywords || "");
    if (handoffDetected && !session.handoffRequested) {
      await updateWebchatSession(session.id, { handoffRequested: true });

      // Add system message about handoff
      await createWebchatMessage({
        sessionId: session.id,
        accountId: widget.accountId,
        sender: "ai",
        content:
          "I understand you'd like to speak with a human agent. I've notified our team and someone will be with you shortly. In the meantime, feel free to continue sharing details about your inquiry.",
        isRead: true,
      });

      return res.json({
        visitorMessageId: visitorMsgId,
        reply: {
          sender: "ai" as const,
          content:
            "I understand you'd like to speak with a human agent. I've notified our team and someone will be with you shortly. In the meantime, feel free to continue sharing details about your inquiry.",
        },
        handoffRequested: true,
      });
    }

    // If agent has taken over, don't generate AI response — agent replies via tRPC
    if (session.agentTakenOver) {
      return res.json({
        visitorMessageId: visitorMsgId,
        reply: null,
        handoffRequested: session.handoffRequested,
        agentTakenOver: true,
      });
    }

    // Generate AI response if enabled
    if (widget.aiEnabled) {
      try {
        // Get recent conversation history for context
        const recentMessages = await listWebchatMessages(session.id, widget.accountId);
        const historyForLLM = recentMessages.slice(-10).map((m) => ({
          role: (m.sender === "visitor" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        }));

        const systemPrompt =
          widget.aiSystemPrompt ||
          `You are a helpful customer support assistant for a mortgage/loan company. Be professional, friendly, and concise. Help visitors with questions about loan products, rates, and the application process. If the visitor needs specific account help or wants to speak with a human, let them know they can ask for a human agent at any time.`;

        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...historyForLLM,
            { role: "user", content },
          ],
        });

        const rawContent = llmResponse.choices?.[0]?.message?.content;
        const aiReply: string =
          (typeof rawContent === "string" ? rawContent : null) || "I'm sorry, I couldn't process that. Please try again.";

        // Save AI response
        await createWebchatMessage({
          sessionId: session.id,
          accountId: widget.accountId,
          sender: "ai",
          content: aiReply,
          isRead: true,
        });

        return res.json({
          visitorMessageId: visitorMsgId,
          reply: { sender: "ai" as const, content: aiReply },
          handoffRequested: session.handoffRequested,
        });
      } catch (llmErr: any) {
        console.error("[Webchat] LLM error:", llmErr.message);
        // Fallback response
        const fallback = "Thanks for your message! Our team will get back to you shortly.";
        await createWebchatMessage({
          sessionId: session.id,
          accountId: widget.accountId,
          sender: "ai",
          content: fallback,
          isRead: true,
        });
        return res.json({
          visitorMessageId: visitorMsgId,
          reply: { sender: "ai" as const, content: fallback },
          handoffRequested: session.handoffRequested,
        });
      }
    }

    // AI disabled — no auto-reply
    return res.json({
      visitorMessageId: visitorMsgId,
      reply: null,
      handoffRequested: session.handoffRequested,
    });
  } catch (err: any) {
    console.error("[Webchat] Message error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/webchat/poll — Visitor polls for new messages (agent replies) ───
webchatWebhookRouter.get("/api/webchat/poll", async (req, res) => {
  try {
    const { widgetKey, sessionKey, after } = req.query as {
      widgetKey?: string;
      sessionKey?: string;
      after?: string;
    };
    if (!widgetKey || !sessionKey) {
      return res.status(400).json({ error: "widgetKey and sessionKey are required" });
    }

    const widget = await getChatWidgetByKey(widgetKey);
    if (!widget) {
      return res.status(404).json({ error: "Widget not found" });
    }

    const session = await getWebchatSessionByKey(sessionKey);
    if (!session || session.widgetId !== widget.id) {
      return res.status(404).json({ error: "Session not found" });
    }

    const messages = await listWebchatMessages(session.id, widget.accountId);
    const afterId = after ? parseInt(after, 10) : 0;
    const newMessages = messages
      .filter((m) => m.id > afterId && m.sender !== "visitor")
      .map((m) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        createdAt: m.createdAt,
      }));

    return res.json({
      messages: newMessages,
      sessionStatus: session.status,
      agentTakenOver: session.agentTakenOver,
    });
  } catch (err: any) {
    console.error("[Webchat] Poll error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});
