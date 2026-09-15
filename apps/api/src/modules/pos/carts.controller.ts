import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { addCartItemInputSchema, createCartInputSchema, updateCartItemInputSchema } from "@ixoris/types";
import type { AddCartItemInput, CreateCartInput, UpdateCartItemInput } from "@ixoris/types";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CartsService } from "./carts.service";

@RequirePermissions("pos.cart.manage")
@Controller("pos/carts")
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createCartInputSchema))
  create(@Body() input: CreateCartInput, @CurrentAuth() auth: AuthContext) {
    return this.carts.create(auth.companyId, auth.userId, input);
  }

  @Get("active")
  listActive(@Query("storeId") storeId: string, @CurrentAuth() auth: AuthContext) {
    return this.carts.listActive(auth.companyId, storeId ?? auth.storeId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.carts.findOne(auth.companyId, id);
  }

  @Post(":id/items")
  @UsePipes(new ZodValidationPipe(addCartItemInputSchema))
  addItem(@Param("id") id: string, @Body() input: AddCartItemInput, @CurrentAuth() auth: AuthContext) {
    return this.carts.addItem(auth.companyId, auth.storeId, auth.userId, id, input);
  }

  @Patch(":id/items/:itemId")
  @UsePipes(new ZodValidationPipe(updateCartItemInputSchema))
  updateItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() input: UpdateCartItemInput,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.carts.updateItem(auth.companyId, id, itemId, input);
  }

  @Delete(":id/items/:itemId")
  removeItem(@Param("id") id: string, @Param("itemId") itemId: string, @CurrentAuth() auth: AuthContext) {
    return this.carts.removeItem(auth.companyId, id, itemId);
  }
}
