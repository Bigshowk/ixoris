import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from "./dto/employee.dto";
import { TerminateEmployeeDto } from "./dto/terminate-employee.dto";

@RequirePermissions("hr.employee.manage")
@Controller("hr/employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentAuth() auth: AuthContext) {
    return this.employees.create(auth.companyId, dto);
  }

  @Get()
  list(@Query("status") status: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | undefined, @CurrentAuth() auth: AuthContext) {
    return this.employees.list(auth.companyId, status);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.employees.findOne(auth.companyId, id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto, @CurrentAuth() auth: AuthContext) {
    return this.employees.update(auth.companyId, id, dto);
  }

  @Post(":id/terminate")
  terminate(@Param("id") id: string, @Body() dto: TerminateEmployeeDto, @CurrentAuth() auth: AuthContext) {
    return this.employees.terminate(auth.companyId, id, dto.terminationDate);
  }
}
