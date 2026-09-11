import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { PayrollRunsService } from "./payroll-runs.service";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";

@RequirePermissions("hr.payroll.manage")
@Controller("payroll/runs")
export class PayrollRunsController {
  constructor(private readonly payrollRuns: PayrollRunsService) {}

  @Post()
  create(@Body() dto: CreatePayrollRunDto, @CurrentAuth() auth: AuthContext) {
    return this.payrollRuns.createRun(auth.companyId, dto.period);
  }

  @Post(":id/validate")
  validate(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollRuns.validate(auth.companyId, id, auth.userId);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.payrollRuns.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollRuns.findOne(auth.companyId, id);
  }
}
