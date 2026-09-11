import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { DeliveryStatus } from "@ixoris/database";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { DeliveriesService } from "./deliveries.service";
import { CreateDeliveryDto } from "./dto/create-delivery.dto";
import { AssignDriverDto, UpdateDeliveryStatusDto } from "./dto/update-delivery-status.dto";
import { ProofOfDeliveryDto } from "./dto/proof-of-delivery.dto";

@Controller("logistics/deliveries")
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Post()
  @RequirePermissions("logistics.delivery.manage")
  create(@Body() dto: CreateDeliveryDto, @CurrentAuth() auth: AuthContext) {
    return this.deliveries.create(auth.companyId, dto);
  }

  @Get()
  @RequirePermissions("logistics.delivery.manage")
  list(@Query("status") status: DeliveryStatus | undefined, @CurrentAuth() auth: AuthContext) {
    return this.deliveries.list(auth.companyId, status);
  }

  /** The driver's own scoped list — a Livreur has this permission but not logistics.delivery.manage. */
  @Get("mine")
  @RequirePermissions("logistics.delivery.drive")
  listMine(@CurrentAuth() auth: AuthContext) {
    return this.deliveries.listForDriver(auth.companyId, auth.userId);
  }

  @Get(":id")
  @RequirePermissions("logistics.delivery.drive")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.deliveries.findOne(auth.companyId, id);
  }

  @Patch(":id/assign")
  @RequirePermissions("logistics.delivery.manage")
  assignDriver(@Param("id") id: string, @Body() dto: AssignDriverDto, @CurrentAuth() auth: AuthContext) {
    return this.deliveries.assignDriver(auth.companyId, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions("logistics.delivery.drive")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateDeliveryStatusDto, @CurrentAuth() auth: AuthContext) {
    return this.deliveries.updateStatus(auth.companyId, auth.userId, id, dto);
  }

  @Post(":id/proof-of-delivery")
  @RequirePermissions("logistics.delivery.drive")
  submitProofOfDelivery(@Param("id") id: string, @Body() dto: ProofOfDeliveryDto, @CurrentAuth() auth: AuthContext) {
    return this.deliveries.submitProofOfDelivery(auth.companyId, auth.userId, id, dto);
  }
}
