import { Module } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";
import { OpportunitiesService } from "./opportunities.service";
import { OpportunitiesController } from "./opportunities.controller";
import { InteractionsService } from "./interactions.service";
import { InteractionsController } from "./interactions.controller";
import { RemindersService } from "./reminders.service";
import { RemindersController } from "./reminders.controller";
import { CrmAnalyticsService } from "./crm-analytics.service";
import { CrmAnalyticsController } from "./crm-analytics.controller";
import { LoggingNotificationSender, NOTIFICATION_SENDER, NotificationSender } from "./notification-sender";
import { EmailSender } from "./senders/email.sender";
import { TwilioSender } from "./senders/twilio.sender";
import { LiveNotificationSender } from "./senders/live-notification.sender";

@Module({
  controllers: [
    CustomersController,
    OpportunitiesController,
    InteractionsController,
    RemindersController,
    CrmAnalyticsController,
  ],
  providers: [
    CustomersService,
    OpportunitiesService,
    InteractionsService,
    RemindersService,
    CrmAnalyticsService,
    EmailSender,
    TwilioSender,
    LiveNotificationSender,
    LoggingNotificationSender,
    {
      provide: NOTIFICATION_SENDER,
      // Defaults to the safe logging stub — real Email/SMS/WhatsApp only fires
      // when NOTIFICATION_MODE=live is explicitly set (see .env.example),
      // so nobody accidentally messages real customers during local dev.
      useFactory: (live: LiveNotificationSender, logging: LoggingNotificationSender): NotificationSender =>
        process.env.NOTIFICATION_MODE === "live" ? live : logging,
      inject: [LiveNotificationSender, LoggingNotificationSender],
    },
  ],
})
export class CrmModule {}
