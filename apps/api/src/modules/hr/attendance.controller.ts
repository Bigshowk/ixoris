import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AttendanceService } from "./attendance.service";
import { CheckInOutDto, RecordAttendanceDto } from "./dto/attendance.dto";

@RequirePermissions("hr.attendance.manage")
@Controller("hr/attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post()
  record(@Body() dto: RecordAttendanceDto, @CurrentAuth() auth: AuthContext) {
    return this.attendance.record(auth.companyId, dto);
  }

  @Post("check-in")
  checkIn(@Body() dto: CheckInOutDto, @CurrentAuth() auth: AuthContext) {
    return this.attendance.checkIn(auth.companyId, dto.employeeId);
  }

  @Post("check-out")
  checkOut(@Body() dto: CheckInOutDto, @CurrentAuth() auth: AuthContext) {
    return this.attendance.checkOut(auth.companyId, dto.employeeId);
  }

  @Get("employee/:employeeId")
  listByEmployee(
    @Param("employeeId") employeeId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendance.listByEmployee(auth.companyId, employeeId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }
}
