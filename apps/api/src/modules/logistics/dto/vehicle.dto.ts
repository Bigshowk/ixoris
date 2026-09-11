import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

const VEHICLE_TYPES = ["MOTO", "CAR", "VAN", "TRUCK"] as const;

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  plateNumber!: string;

  @IsOptional()
  @IsIn(VEHICLE_TYPES)
  type?: (typeof VEHICLE_TYPES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityKg?: number;
}
