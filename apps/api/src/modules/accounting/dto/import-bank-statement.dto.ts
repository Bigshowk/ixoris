import { IsISO8601, IsNumber, IsString, MaxLength, MinLength } from "class-validator";

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
  @MaxLength(2_000_000) // ~20k rows of typical bank statement data — well above any real statement, bounds worst-case parse/DB cost
  csv!: string;
}
