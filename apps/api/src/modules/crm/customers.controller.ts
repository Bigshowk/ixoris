import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";

@RequirePermissions("crm.customer.manage")
@Controller("crm/customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentAuth() auth: AuthContext) {
    return this.customers.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.customers.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.customers.findOne(auth.companyId, id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto, @CurrentAuth() auth: AuthContext) {
    return this.customers.update(auth.companyId, id, dto);
  }

  @Get(":id/analytics")
  analytics(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.customers.analytics(auth.companyId, id);
  }

  @Post(":id/recompute-category")
  recomputeCategory(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.customers.recomputeCategory(auth.companyId, id);
  }
}
