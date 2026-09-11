import { Injectable, Logger } from "@nestjs/common";
import { ReminderChannel } from "@ixoris/database";

export interface OutgoingNotification {
  channel: ReminderChannel;
  recipient: string;
  message: string;
}

export interface NotificationSender {
  send(notification: OutgoingNotification): Promise<void>;
}

export const NOTIFICATION_SENDER = Symbol("NOTIFICATION_SENDER");

/**
 * Stub sender — logs instead of actually delivering. There is no
 * Email/SMS/WhatsApp provider wired into this project (would need SMTP or
 * SendGrid credentials for EMAIL, Twilio or the WhatsApp Business API for
 * SMS/WHATSAPP). Swap the `NOTIFICATION_SENDER` provider in CrmModule for a
 * real implementation before relying on reminders actually reaching anyone.
 */
@Injectable()
export class LoggingNotificationSender implements NotificationSender {
  private readonly logger = new Logger(LoggingNotificationSender.name);

  async send(notification: OutgoingNotification): Promise<void> {
    this.logger.log(`[STUB — not actually sent] ${notification.channel} -> ${notification.recipient}: ${notification.message}`);
  }
}
