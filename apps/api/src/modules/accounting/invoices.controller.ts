import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";

@RequirePermissions("accounting.invoice.manage")
@Controller("accounting/invoices")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  create(@Body() dto: CreateInvoiceDto, @CurrentAuth() auth: AuthContext) {
    return this.invoices.create(auth.companyId, dto);
  }

  @Post(":id/validate")
  validate(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.invoices.validate(auth.companyId, id, auth.userId);
  }

  @Get()
  list(@Query("type") type: "CUSTOMER" | "SUPPLIER" | undefined, @CurrentAuth() auth: AuthContext) {
    return this.invoices.list(auth.companyId, type);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.invoices.findOne(auth.companyId, id);
  }
}
