import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PurchaseOrderStatus } from "@ixoris/database";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { PurchaseOrdersService } from "./purchase-orders.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";

@RequirePermissions("supplychain.purchaseorder.manage")
@Controller("supply-chain/purchase-orders")
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Post()
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentAuth() auth: AuthContext) {
    return this.purchaseOrders.create(auth.companyId, auth.userId, dto);
  }

  @Get()
  list(@Query("status") status: PurchaseOrderStatus | undefined, @CurrentAuth() auth: AuthContext) {
    return this.purchaseOrders.list(auth.companyId, status);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.purchaseOrders.findOne(auth.companyId, id);
  }

  @Post(":id/send")
  send(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.purchaseOrders.send(auth.companyId, id, auth.userId);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.purchaseOrders.cancel(auth.companyId, id);
  }
}
