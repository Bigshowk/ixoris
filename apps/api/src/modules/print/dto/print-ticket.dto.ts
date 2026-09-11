import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class PrintTicketDto {
  @IsString()
  saleId!: string;

  /** IP address (or hostname) of the network thermal printer. */
  @IsString()
  host!: string;

  /** Raw ESC/POS listener port — 9100 is the de-facto standard (Epson, Star, generic clones). */
  @IsOptional()
  @IsInt()
  @Min(1)
  port?: number;

  @IsOptional()
  @IsIn(["58mm", "80mm"])
  paperWidth?: "58mm" | "80mm";
}
