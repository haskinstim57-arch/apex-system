import { Router, Request, Response } from "express";

// ─────────────────────────────────────────────
// Click-to-Call TwiML Endpoint
// GET/POST /api/webhooks/twilio/click-to-call-twiml
//
// When Twilio connects the user's phone, it fetches this URL
// to get TwiML instructions. We return a <Dial> that bridges
// the call to the contact's phone number.
// ─────────────────────────────────────────────

export const clickToCallTwimlRouter = Router();

clickToCallTwimlRouter.all(
  "/api/webhooks/twilio/click-to-call-twiml",
  async (req: Request, res: Response) => {
    const to = (req.query.to as string) || (req.body?.to as string);
    const callerId = (req.query.callerId as string) || (req.body?.callerId as string);

    if (!to) {
      console.error("[ClickToCallTwiml] Missing 'to' parameter");
      res.type("text/xml").status(400).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, the call could not be completed. Missing destination number.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    console.log(`[ClickToCallTwiml] Bridging call to ${to} with callerId=${callerId || "default"}`);

    // Generate TwiML that dials the contact when the user answers
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you now.</Say>
  <Dial${callerId ? ` callerId="${callerId}"` : ""} timeout="30" record="record-from-answer-dual">
    <Number>${to}</Number>
  </Dial>
</Response>`;

    res.type("text/xml").status(200).send(twiml);
  }
);
