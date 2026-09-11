import { IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateDeliveryDto {
  @IsOptional()
  @IsString()
  saleId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  @MinLength(1)
  address!: string;

  @IsOptional()
  @IsString()
  deliveryZoneId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeM3?: number;

  /** Used only to compute feeAmount from the zone's feePerKm — not persisted on the Delivery itself. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  /** Overrides the zone-based fee calculation entirely, if provided. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;
}
