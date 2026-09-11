import { IsOptional, IsString } from "class-validator";

export class GenerateBankTransferDto {
  @IsOptional()
  @IsString()
  bankAccountId?: string;
}
