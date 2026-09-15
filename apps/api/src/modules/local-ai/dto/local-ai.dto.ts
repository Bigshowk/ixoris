import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const DOMAINS = ["pos", "stock", "accounting", "hr", "logistics"] as const;

export class AskQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsIn(DOMAINS)
  domain?: (typeof DOMAINS)[number];
}

export class SuggestAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  description!: string;
}
