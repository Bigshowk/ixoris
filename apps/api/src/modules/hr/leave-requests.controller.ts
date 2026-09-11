import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { LeaveRequestsService } from "./leave-requests.service";
import { CreateLeaveRequestDto } from "./dto/leave.dto";

@Controller("hr/leave-requests")
export class LeaveRequestsController {
  constructor(private readonly leaveRequests: LeaveRequestsService) {}

  @Post()
  @RequirePermissions("hr.attendance.manage")
  create(@Body() dto: CreateLeaveRequestDto, @CurrentAuth() auth: AuthContext) {
    return this.leaveRequests.create(auth.companyId, dto);
  }

  @Post(":id/approve")
  @RequirePermissions("hr.leave.approve")
  approve(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.leaveRequests.approve(auth.companyId, id, auth.userId);
  }

  @Post(":id/reject")
  @RequirePermissions("hr.leave.approve")
  reject(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.leaveRequests.reject(auth.companyId, id, auth.userId);
  }

  @Get("pending")
  @RequirePermissions("hr.leave.approve")
  listPending(@CurrentAuth() auth: AuthContext) {
    return this.leaveRequests.listPending(auth.companyId);
  }

  @Get("employee/:employeeId")
  @RequirePermissions("hr.attendance.manage")
  listByEmployee(@Param("employeeId") employeeId: string, @CurrentAuth() auth: AuthContext) {
    return this.leaveRequests.listByEmployee(auth.companyId, employeeId);
  }
}
