import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class OpenCashSessionDto {
  @IsNumber()
  @Min(0)
  openingBalance!: number;
}

export class CloseCashSessionDto {
  @IsNumber()
  @Min(0)
  closingBalance!: number;

  @IsOptional()
  @IsString()
  varianceNotes?: string;
}
