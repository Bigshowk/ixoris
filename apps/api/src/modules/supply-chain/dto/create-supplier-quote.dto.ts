import { IsISO8601, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateSupplierQuoteDto {
  @IsString()
  supplierId!: string;

  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;
}
