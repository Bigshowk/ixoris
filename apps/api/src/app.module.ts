import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { HrModule } from "./modules/hr/hr.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { CrmModule } from "./modules/crm/crm.module";
import { SupplyChainModule } from "./modules/supply-chain/supply-chain.module";
import { LogisticsModule } from "./modules/logistics/logistics.module";
import { PosModule } from "./modules/pos/pos.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { PrintModule } from "./modules/print/print.module";
import { TreasuryModule } from "./modules/treasury/treasury.module";
import { CreditControlModule } from "./modules/credit-control/credit-control.module";
import { FixedAssetsModule } from "./modules/fixed-assets/fixed-assets.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { StockModule } from "./modules/stock/stock.module";
import { AdminModule } from "./modules/admin/admin.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    RealtimeModule,
    AccountingModule,
    HrModule,
    PayrollModule,
    CrmModule,
    SupplyChainModule,
    LogisticsModule,
    PosModule,
    PrintModule,
    TreasuryModule,
    CreditControlModule,
    FixedAssetsModule,
    DocumentsModule,
    StockModule,
    AdminModule,
    NotificationsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
