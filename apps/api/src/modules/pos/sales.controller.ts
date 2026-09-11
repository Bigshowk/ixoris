import { Body, Controller, Get, Param, Post, UsePipes } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { checkoutInputSchema } from "@ixoris/types";
import type { CheckoutInput } from "@ixoris/types";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { SalesService } from "./sales.service";

@Controller("pos/sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post("checkout")
  @RequirePermissions("pos.sale.create")
  @UsePipes(new ZodValidationPipe(checkoutInputSchema))
  checkout(@Body() input: CheckoutInput, @CurrentAuth() auth: AuthContext) {
    return this.sales.checkout(auth.companyId, auth.userId, input);
  }

  @Get(":id")
  @RequirePermissions("pos.sale.read")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.sales.findOne(auth.companyId, id);
  }
}
