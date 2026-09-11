import { IsIn, IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

const ATTACHABLE_TYPES = ["JournalEntry", "Invoice", "Employee", "FixedAsset", "PurchaseOrder"];

export class AttachDocumentDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sizeBytes?: number;

  @IsIn(ATTACHABLE_TYPES)
  attachableType!: string;

  @IsString()
  @MinLength(1)
  attachableId!: string;
}
