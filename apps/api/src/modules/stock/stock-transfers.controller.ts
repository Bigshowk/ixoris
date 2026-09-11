import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { StockTransfersService } from "./stock-transfers.service";
import { CreateStockTransferDto } from "./dto/stock-transfer.dto";

@RequirePermissions("stock.transfer.manage")
@Controller("stock/transfers")
export class StockTransfersController {
  constructor(private readonly transfers: StockTransfersService) {}

  @Post()
  create(@Body() dto: CreateStockTransferDto, @CurrentAuth() auth: AuthContext) {
    return this.transfers.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.transfers.list(auth.companyId);
  }

  @Post(":id/receive")
  receive(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.transfers.receive(auth.companyId, id);
  }
}
