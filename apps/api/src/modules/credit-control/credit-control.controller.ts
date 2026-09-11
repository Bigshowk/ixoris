import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CreditControlService } from "./credit-control.service";
import { InstallmentsService } from "./installments.service";
import { GenerateInstallmentsDto } from "./dto/installment.dto";
import { BlockCustomerDto } from "./dto/block-customer.dto";

@Controller("credit-control")
export class CreditControlController {
  constructor(
    private readonly creditControl: CreditControlService,
    private readonly installments: InstallmentsService,
  ) {}

  @RequirePermissions("credit.installment.manage")
  @Post("invoices/:invoiceId/installments")
  generateInstallments(@Param("invoiceId") invoiceId: string, @Body() dto: GenerateInstallmentsDto, @CurrentAuth() auth: AuthContext) {
    return this.installments.generate(auth.companyId, invoiceId, dto);
  }

  @RequirePermissions("credit.installment.manage")
  @Get("invoices/:invoiceId/installments")
  listInstallments(@Param("invoiceId") invoiceId: string, @CurrentAuth() auth: AuthContext) {
    return this.installments.list(auth.companyId, invoiceId);
  }

  @RequirePermissions("credit.installment.manage")
  @Patch("installments/:id/pay")
  markInstallmentPaid(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.installments.markPaid(auth.companyId, id);
  }

  @RequirePermissions("credit.customer.block")
  @Get("customers/:id/outstanding")
  getOutstanding(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.creditControl.getOutstanding(auth.companyId, id).then((outstanding) => ({ customerId: id, outstanding }));
  }

  @RequirePermissions("credit.customer.block")
  @Post("customers/:id/block")
  block(@Param("id") id: string, @Body() dto: BlockCustomerDto, @CurrentAuth() auth: AuthContext) {
    return this.creditControl.block(auth.companyId, id, dto.reason);
  }

  @RequirePermissions("credit.customer.block")
  @Post("customers/:id/unblock")
  unblock(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.creditControl.unblock(auth.companyId, id);
  }

  @RequirePermissions("credit.customer.block")
  @Post("run-overdue-check")
  async runOverdueCheck(@CurrentAuth() auth: AuthContext) {
    const [blocking, installments] = await Promise.all([
      this.creditControl.runOverdueCheck(auth.companyId),
      this.installments.markOverdue(auth.companyId),
    ]);
    return { ...blocking, installmentsMarkedOverdue: installments.updated };
  }
}
