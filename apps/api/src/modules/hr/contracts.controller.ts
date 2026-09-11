import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { ContractsService } from "./contracts.service";
import { CreateContractDto, EndContractDto } from "./dto/contract.dto";

@RequirePermissions("hr.employee.manage")
@Controller("hr/contracts")
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post()
  create(@Body() dto: CreateContractDto, @CurrentAuth() auth: AuthContext) {
    return this.contracts.create(auth.companyId, dto);
  }

  @Get("employee/:employeeId")
  listByEmployee(@Param("employeeId") employeeId: string, @CurrentAuth() auth: AuthContext) {
    return this.contracts.listByEmployee(auth.companyId, employeeId);
  }

  @Patch(":id/end")
  end(@Param("id") id: string, @Body() dto: EndContractDto, @CurrentAuth() auth: AuthContext) {
    return this.contracts.end(auth.companyId, id, dto);
  }
}
