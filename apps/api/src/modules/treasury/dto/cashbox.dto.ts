import { CashBoxType, CashMovementType } from "@ixoris/database";
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateCashBoxDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(CashBoxType)
  type!: CashBoxType;

  @IsString()
  glAccountCode!: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}

export class CreateCashMovementDto {
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  counterAccountCode!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
