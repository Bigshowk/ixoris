import { IsISO8601, IsNumber, IsString, MinLength } from "class-validator";

export class ImportBankStatementDto {
  @IsString()
  bankAccountId!: string;

  @IsISO8601()
  statementDate!: string;

  @IsNumber()
  startBalance!: number;

  @IsNumber()
  endBalance!: number;

  /** Raw CSV text: header row + `date;label;amount` rows (positive = credit, negative = debit). */
  @IsString()
  @MinLength(1)
  csv!: string;
}
