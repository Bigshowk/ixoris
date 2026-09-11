import { IsNumber, Min } from "class-validator";

export class DisposeFixedAssetDto {
  @IsNumber()
  @Min(0)
  disposalAmount!: number;
}
