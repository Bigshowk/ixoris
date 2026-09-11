import { Injectable } from "@nestjs/common";
import { NotificationSender, OutgoingNotification } from "../notification-sender";
import { EmailSender } from "./email.sender";
import { TwilioSender } from "./twilio.sender";

/** Routes a reminder to the real channel provider. Each provider throws its own clear "not configured" error if used without credentials. */
@Injectable()
export class LiveNotificationSender implements NotificationSender {
  constructor(
    private readonly email: EmailSender,
    private readonly twilio: TwilioSender,
  ) {}

  send(notification: OutgoingNotification): Promise<void> {
    switch (notification.channel) {
      case "EMAIL":
        return this.email.send(notification.recipient, "Notification IXORIS", notification.message);
      case "SMS":
        return this.twilio.sendSms(notification.recipient, notification.message);
      case "WHATSAPP":
        return this.twilio.sendWhatsApp(notification.recipient, notification.message);
    }
  }
}
