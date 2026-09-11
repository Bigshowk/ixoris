import { ArgumentMetadata, BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  // Bound via @UsePipes at the method level, so this runs for every handler
  // parameter (@Body, @CurrentAuth, etc.) — only validate the body, or a
  // decorator like @CurrentAuth would get parsed against the body schema too
  // and have its unrecognized fields (companyId, userId, ...) silently stripped.
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== "body") return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return result.data;
  }
}
