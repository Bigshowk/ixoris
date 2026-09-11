import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { DeliveryZonesService } from "./delivery-zones.service";
import { CreateDeliveryZoneDto } from "./dto/delivery-zone.dto";

@RequirePermissions("logistics.delivery.manage")
@Controller("logistics/zones")
export class DeliveryZonesController {
  constructor(private readonly zones: DeliveryZonesService) {}

  @Post()
  create(@Body() dto: CreateDeliveryZoneDto, @CurrentAuth() auth: AuthContext) {
    return this.zones.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.zones.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.zones.findOne(auth.companyId, id);
  }
}
