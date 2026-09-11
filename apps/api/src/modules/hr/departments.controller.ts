import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/department.dto";

@RequirePermissions("hr.employee.manage")
@Controller("hr/departments")
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Post()
  create(@Body() dto: CreateDepartmentDto, @CurrentAuth() auth: AuthContext) {
    return this.departments.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.departments.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.departments.findOne(auth.companyId, id);
  }
}
