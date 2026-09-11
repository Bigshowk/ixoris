import { IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class ProofOfDeliveryDto {
  @IsIn(["SIGNATURE", "QR_SCAN"])
  method!: "SIGNATURE" | "QR_SCAN";

  /** Signature image (data URL) for SIGNATURE, or the raw scanned payload for QR_SCAN. */
  @IsString()
  @MinLength(1)
  reference!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** GPS position captured on the driver's device at the moment of delivery. */
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
