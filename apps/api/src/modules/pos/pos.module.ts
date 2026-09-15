import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { AccountingModule } from "../accounting/accounting.module";
import { TreasuryModule } from "../treasury/treasury.module";
import { CreditControlModule } from "../credit-control/credit-control.module";
import { AuthModule } from "../auth/auth.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { CartsController } from "./carts.controller";
import { CartsService } from "./carts.service";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { RegistersController } from "./registers.controller";
import { RegistersService } from "./registers.service";
import { StockService } from "./stock.service";

@Module({
  imports: [RealtimeModule, AccountingModule, TreasuryModule, CreditControlModule, AuthModule],
  controllers: [ProductsController, CartsController, SalesController, RegistersController],
  providers: [ProductsService, CartsService, SalesService, RegistersService, StockService],
})
export class PosModule {}
