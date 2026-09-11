import { Injectable } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";

/**
 * Real SMTP email delivery via nodemailer. Reads SMTP_HOST/SMTP_PORT/
 * SMTP_USER/SMTP_PASSWORD/SMTP_FROM from the environment (see .env.example)
 * — works with any standard SMTP provider (SendGrid, Mailgun, a company
 * mailbox, etc.), no vendor-specific SDK needed. Throws a clear error if
 * unconfigured rather than pretending to succeed.
 */
@Injectable()
export class EmailSender {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      throw new Error("Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASSWORD");
    }

    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
    return this.transporter;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
    await transporter.sendMail({ from, to, subject, text });
  }
}
