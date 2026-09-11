import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

export class CreateLeaveRequestDto {
  @IsString()
  employeeId!: string;

  @IsString()
  leaveTypeId!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;
}
