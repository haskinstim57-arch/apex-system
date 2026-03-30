/**
 * Jarvis SSE Streaming Endpoint
 *
 * POST /api/jarvis/stream
 * Body: { accountId, sessionId, message }
 * Auth: session cookie (same as tRPC)
 *
 * Streams SSE events:
 *   event: tool_start   data: { name, displayName }
 *   event: tool_result  data: { name, displayName, success }
 *   event: text_delta   data: { content }
 *   event: done         data: { toolsUsed }
 *   event: error        data: { message }
 */
import { Router, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { requireAccountMember } from "../routers/contacts";
import { chatStream } from "../services/jarvisService";

export const jarvisStreamRouter = Router();

jarvisStreamRouter.post("/api/jarvis/stream", async (req: Request, res: Response) => {
  // ── Auth ──
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { accountId, sessionId, message } = req.body || {};
  if (!accountId || !sessionId || !message) {
    res.status(400).json({ error: "Missing accountId, sessionId, or message" });
    return;
  }

  // ── Access check ──
  try {
    await requireAccountMember(user.id, accountId, user.role);
  } catch {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // ── SSE headers ──
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stream = chatStream(sessionId, message, {
      accountId,
      userId: user.id,
      userName: user.name || "User",
    });

    for await (const evt of stream) {
      if (res.writableEnded) break;
      sendEvent(evt.type, evt.data);
    }
  } catch (err: any) {
    sendEvent("error", { message: err.message || "Stream failed" });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});
