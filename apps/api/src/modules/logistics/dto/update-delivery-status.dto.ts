import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

const STATUSES = ["LOADED", "IN_TRANSIT", "FAILED", "CANCELLED"] as const;

export class UpdateDeliveryStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;

  /** Estimated value of stock lost/damaged in transit — only meaningful with status FAILED; posts a charge to 65 Autres charges. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  lostValue?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class AssignDriverDto {
  @IsString()
  driverId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}
