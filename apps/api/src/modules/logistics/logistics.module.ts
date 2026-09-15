import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AuthModule } from "../auth/auth.module";
import { DeliveryZonesService } from "./delivery-zones.service";
import { DeliveryZonesController } from "./delivery-zones.controller";
import { VehiclesService } from "./vehicles.service";
import { VehiclesController } from "./vehicles.controller";
import { DeliveriesService } from "./deliveries.service";
import { DeliveriesController } from "./deliveries.controller";
import { DeliveryPostingService } from "./delivery-posting.service";
import { DriversService } from "./drivers.service";
import { DriversController } from "./drivers.controller";

@Module({
  imports: [AccountingModule, AuthModule],
  controllers: [DeliveryZonesController, VehiclesController, DeliveriesController, DriversController],
  providers: [DeliveryZonesService, VehiclesService, DeliveriesService, DeliveryPostingService, DriversService],
})
export class LogisticsModule {}
