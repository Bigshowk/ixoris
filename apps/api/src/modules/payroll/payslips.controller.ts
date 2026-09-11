import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { PayslipPdfService } from "./payslip-pdf.service";

@RequirePermissions("hr.payroll.manage")
@Controller("payroll/payslips")
export class PayslipsController {
  constructor(private readonly pdf: PayslipPdfService) {}

  @Get(":id/pdf")
  async getPdf(@Param("id") id: string, @CurrentAuth() auth: AuthContext, @Res() res: Response) {
    const buffer = await this.pdf.buildPdf(auth.companyId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="bulletin-${id}.pdf"`);
    res.send(buffer);
  }
}
