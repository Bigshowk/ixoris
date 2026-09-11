import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export type TreasuryAccountHolderType = "REGISTER" | "CASHBOX" | "BANK_ACCOUNT";
const HOLDER_TYPES: TreasuryAccountHolderType[] = ["REGISTER", "CASHBOX", "BANK_ACCOUNT"];

export class CreateCashTransferDto {
  @IsEnum(HOLDER_TYPES)
  fromType!: TreasuryAccountHolderType;

  @IsString()
  fromId!: string;

  @IsEnum(HOLDER_TYPES)
  toType!: TreasuryAccountHolderType;

  @IsString()
  toId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}
