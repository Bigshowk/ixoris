import { DepreciationMethod } from "@ixoris/database";
import { IsEnum, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from "class-validator";

export class CreateFixedAssetDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  assetAccountCode!: string;

  @IsString()
  depreciationAccountCode!: string;

  @IsISO8601()
  acquisitionDate!: string;

  @IsNumber()
  @IsPositive()
  acquisitionCost!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  residualValue?: number;

  @IsNumber()
  @IsPositive()
  usefulLifeYears!: number;

  @IsEnum(DepreciationMethod)
  depreciationMethod!: DepreciationMethod;

  @IsOptional()
  @IsNumber()
  @Min(1)
  decliningBalanceRate?: number;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
