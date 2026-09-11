import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min } from "class-validator";

const CONTRACT_TYPES = ["CDI", "CDD", "STAGE", "CONSULTANT"] as const;

export class CreateContractDto {
  @IsString()
  employeeId!: string;

  @IsIn(CONTRACT_TYPES)
  type!: (typeof CONTRACT_TYPES)[number];

  @IsISO8601()
  startDate!: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsNumber()
  @Min(0)
  grossSalary!: number;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}

export class EndContractDto {
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
