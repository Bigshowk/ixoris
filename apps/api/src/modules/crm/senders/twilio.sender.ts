import { Injectable } from "@nestjs/common";

/**
 * Real SMS/WhatsApp delivery via Twilio's REST API, called with the
 * platform's native `fetch` (Node 18+) — no `twilio` SDK dependency needed
 * for a single HTTP call. WhatsApp reuses the same Messages endpoint with a
 * `whatsapp:` prefix on both numbers, per Twilio's WhatsApp API.
 * Reads TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_SMS_FROM/
 * TWILIO_WHATSAPP_FROM from the environment (see .env.example). Throws a
 * clear error if unconfigured rather than pretending to succeed.
 */
@Injectable()
export class TwilioSender {
  sendSms(to: string, body: string): Promise<void> {
    return this.send(to, body, process.env.TWILIO_SMS_FROM, false);
  }

  sendWhatsApp(to: string, body: string): Promise<void> {
    return this.send(to, body, process.env.TWILIO_WHATSAPP_FROM, true);
  }

  private async send(to: string, body: string, from: string | undefined, whatsapp: boolean): Promise<void> {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !from) {
      const missing = whatsapp ? "TWILIO_WHATSAPP_FROM" : "TWILIO_SMS_FROM";
      throw new Error(`Twilio ${whatsapp ? "WhatsApp" : "SMS"} is not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and ${missing}`);
    }

    const prefix = whatsapp ? "whatsapp:" : "";
    const params = new URLSearchParams({ To: `${prefix}${to}`, From: `${prefix}${from}`, Body: body });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Twilio ${whatsapp ? "WhatsApp" : "SMS"} request failed (${response.status}): ${errorBody}`);
    }
  }
}
