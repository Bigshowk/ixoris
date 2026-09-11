import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { BankTransferService } from "./bank-transfer.service";
import { GenerateBankTransferDto } from "./dto/generate-bank-transfer.dto";

@RequirePermissions("hr.payroll.manage")
@Controller("payroll")
export class BankTransferController {
  constructor(private readonly bankTransfer: BankTransferService) {}

  @Post("runs/:id/bank-transfer")
  generate(@Param("id") runId: string, @Body() dto: GenerateBankTransferDto, @CurrentAuth() auth: AuthContext) {
    return this.bankTransfer.generateForRun(auth.companyId, runId, dto.bankAccountId);
  }

  @Get("bank-transfers/:id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.bankTransfer.findOne(auth.companyId, id);
  }

  @Get("bank-transfers/:id/csv")
  async getCsv(@Param("id") id: string, @CurrentAuth() auth: AuthContext, @Res() res: Response) {
    const csv = await this.bankTransfer.toCsv(auth.companyId, id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="virement-${id}.csv"`);
    res.send(csv);
  }
}
