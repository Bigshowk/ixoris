import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CashTransfersService } from "./transfers.service";
import { CreateCashTransferDto } from "./dto/cash-transfer.dto";

@RequirePermissions("treasury.transfer.manage")
@Controller("treasury/transfers")
export class CashTransfersController {
  constructor(private readonly transfers: CashTransfersService) {}

  @Post()
  create(@Body() dto: CreateCashTransferDto, @CurrentAuth() auth: AuthContext) {
    return this.transfers.create(auth.companyId, auth.userId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.transfers.list(auth.companyId);
  }

  @Post(":id/complete")
  complete(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.transfers.complete(auth.companyId, auth.userId, id);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.transfers.cancel(auth.companyId, id);
  }
}
