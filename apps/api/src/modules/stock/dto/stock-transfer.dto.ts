import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from "class-validator";

export class StockTransferLineDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;
}

export class CreateStockTransferDto {
  @IsString()
  fromWarehouseId!: string;

  @IsString()
  toWarehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDto)
  lines!: StockTransferLineDto[];
}
