import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsISO8601, IsNumber, Min, ValidateNested } from "class-validator";

export class InstallmentLineDto {
  @IsISO8601()
  dueDate!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class GenerateInstallmentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InstallmentLineDto)
  installments!: InstallmentLineDto[];
}
