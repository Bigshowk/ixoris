import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";

export class GoodsReceiptLineDto {
  @IsString()
  purchaseOrderLineId!: string;

  @IsNumber()
  @Min(0)
  quantityReceived!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityDamaged?: number;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;
}

export class CreateGoodsReceiptDto {
  @IsString()
  @MinLength(1)
  purchaseOrderId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}
