import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { GoodsReceiptsService } from "./goods-receipts.service";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";

@RequirePermissions("supplychain.receipt.manage")
@Controller("supply-chain/goods-receipts")
export class GoodsReceiptsController {
  constructor(private readonly goodsReceipts: GoodsReceiptsService) {}

  @Post()
  create(@Body() dto: CreateGoodsReceiptDto, @CurrentAuth() auth: AuthContext) {
    return this.goodsReceipts.create(auth.companyId, auth.userId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.goodsReceipts.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.goodsReceipts.findOne(auth.companyId, id);
  }

  @Post(":id/validate")
  validate(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.goodsReceipts.validate(auth.companyId, auth.userId, id);
  }
}
