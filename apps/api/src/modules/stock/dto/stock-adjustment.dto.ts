import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

const ADJUSTMENT_TYPES = ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] as const;

export class CreateStockAdjustmentDto {
  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @IsIn(ADJUSTMENT_TYPES)
  type!: (typeof ADJUSTMENT_TYPES)[number];

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}
