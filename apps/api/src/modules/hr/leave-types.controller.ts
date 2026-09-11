import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { LeaveTypesService } from "./leave-types.service";
import { CreateLeaveTypeDto } from "./dto/leave.dto";

@RequirePermissions("hr.employee.manage")
@Controller("hr/leave-types")
export class LeaveTypesController {
  constructor(private readonly leaveTypes: LeaveTypesService) {}

  @Post()
  create(@Body() dto: CreateLeaveTypeDto, @CurrentAuth() auth: AuthContext) {
    return this.leaveTypes.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.leaveTypes.list(auth.companyId);
  }
}
