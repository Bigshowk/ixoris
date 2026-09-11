import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateBankAccountDto {
  @IsString()
  @MinLength(1)
  bankName!: string;

  @IsString()
  @MinLength(1)
  accountNumber!: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  /** Chart-of-accounts code this bank account posts against (e.g. "521"). */
  @IsString()
  @MinLength(1)
  glAccountCode!: string;
}
