import { IsString, MinLength } from "class-validator";

export class BlockCustomerDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
