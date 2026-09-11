import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { StockMovementsService } from "./stock-movements.service";
import { CreateStockAdjustmentDto } from "./dto/stock-adjustment.dto";

@Controller("stock")
export class StockMovementsController {
  constructor(private readonly stockMovements: StockMovementsService) {}

  @RequirePermissions("stock.movement.read")
  @Get("levels")
  levels(@Query("warehouseId") warehouseId: string | undefined, @CurrentAuth() auth: AuthContext) {
    return this.stockMovements.levels(auth.companyId, warehouseId);
  }

  @RequirePermissions("stock.movement.read")
  @Get("movements")
  movements(
    @Query("productId") productId: string | undefined,
    @Query("warehouseId") warehouseId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.stockMovements.movements(auth.companyId, productId, warehouseId);
  }

  @RequirePermissions("stock.product.manage")
  @Post("movements")
  adjust(@Body() dto: CreateStockAdjustmentDto, @CurrentAuth() auth: AuthContext) {
    return this.stockMovements.adjust(auth.companyId, auth.userId, dto);
  }
}
