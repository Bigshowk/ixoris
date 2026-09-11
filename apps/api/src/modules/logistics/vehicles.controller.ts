import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { VehiclesService } from "./vehicles.service";
import { CreateVehicleDto } from "./dto/vehicle.dto";

@RequirePermissions("logistics.delivery.manage")
@Controller("logistics/vehicles")
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  create(@Body() dto: CreateVehicleDto, @CurrentAuth() auth: AuthContext) {
    return this.vehicles.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.vehicles.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.vehicles.findOne(auth.companyId, id);
  }
}
