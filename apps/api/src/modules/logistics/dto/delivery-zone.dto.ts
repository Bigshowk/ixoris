import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateDeliveryZoneDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeFlat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feePerKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationMinutes?: number;
}
