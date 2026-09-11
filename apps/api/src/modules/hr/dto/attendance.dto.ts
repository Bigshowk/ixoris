import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY"] as const;

export class RecordAttendanceDto {
  @IsString()
  employeeId!: string;

  @IsISO8601()
  date!: string;

  @IsIn(ATTENDANCE_STATUSES)
  status!: (typeof ATTENDANCE_STATUSES)[number];

  @IsOptional()
  @IsISO8601()
  checkIn?: string;

  @IsOptional()
  @IsISO8601()
  checkOut?: string;
}

export class CheckInOutDto {
  @IsString()
  employeeId!: string;
}
