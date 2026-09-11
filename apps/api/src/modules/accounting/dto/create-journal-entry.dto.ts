import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";

export class JournalEntryLineDto {
  @IsString()
  @MinLength(1)
  accountCode!: string;

  @IsNumber()
  @Min(0)
  debit!: number;

  @IsNumber()
  @Min(0)
  credit!: number;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateJournalEntryDto {
  @IsString()
  @MinLength(1)
  journalCode!: string;

  @IsISO8601()
  date!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines!: JournalEntryLineDto[];
}
