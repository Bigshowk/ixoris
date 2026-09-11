import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";

@RequirePermissions("accounting.invoice.manage")
@Controller("accounting/suppliers")
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post()
  create(@Body() dto: CreateSupplierDto, @CurrentAuth() auth: AuthContext) {
    return this.suppliers.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.suppliers.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.suppliers.findOne(auth.companyId, id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSupplierDto, @CurrentAuth() auth: AuthContext) {
    return this.suppliers.update(auth.companyId, id, dto);
  }
}
