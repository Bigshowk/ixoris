import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { WarehousesService } from "./warehouses.service";
import { CreateWarehouseDto } from "./dto/warehouse.dto";

@RequirePermissions("stock.warehouse.manage")
@Controller("stock/warehouses")
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Post()
  create(@Body() dto: CreateWarehouseDto, @CurrentAuth() auth: AuthContext) {
    return this.warehouses.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.warehouses.list(auth.companyId);
  }
}
