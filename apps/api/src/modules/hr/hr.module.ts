import { Module } from "@nestjs/common";
import { DepartmentsService } from "./departments.service";
import { DepartmentsController } from "./departments.controller";
import { PositionsService } from "./positions.service";
import { PositionsController } from "./positions.controller";
import { EmployeesService } from "./employees.service";
import { EmployeesController } from "./employees.controller";
import { ContractsService } from "./contracts.service";
import { ContractsController } from "./contracts.controller";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { LeaveTypesService } from "./leave-types.service";
import { LeaveTypesController } from "./leave-types.controller";
import { LeaveRequestsService } from "./leave-requests.service";
import { LeaveRequestsController } from "./leave-requests.controller";
import { AttendanceAdjustmentService } from "./attendance-adjustment.service";

@Module({
  controllers: [
    DepartmentsController,
    PositionsController,
    EmployeesController,
    ContractsController,
    AttendanceController,
    LeaveTypesController,
    LeaveRequestsController,
  ],
  providers: [
    DepartmentsService,
    PositionsService,
    EmployeesService,
    ContractsService,
    AttendanceService,
    LeaveTypesService,
    LeaveRequestsService,
    AttendanceAdjustmentService,
  ],
  // Consumed by PayrollModule: EmployeesService (who to pay) and AttendanceAdjustmentService (proration).
  exports: [EmployeesService, AttendanceAdjustmentService],
})
export class HrModule {}
