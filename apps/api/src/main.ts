// Must run before any other import: AuthModule reads process.env.JWT_SECRET at module-decorator
// evaluation time (i.e. as soon as it's imported, before Nest's own ConfigModule/bootstrap phase
// runs), so .env has to be loaded explicitly and first rather than relying on a side effect of some
// other module (e.g. Prisma's own internal dotenv call, which only fires once PrismaClient is
// actually instantiated — too late for this). Path is explicit (not cwd-relative) because this file
// runs with different working directories depending on how it's launched (turborepo's `pnpm dev`
// sets cwd to apps/api; a direct `node .../main.ts`/`node dist/main.js` invocation keeps the
// caller's cwd, often the repo root) — only the repo root actually has a .env file.
import * as path from "path";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { corsOrigin } from "./common/cors-origin";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: { origin: corsOrigin() } });
  // whitelist strips unrecognized fields; forbidNonWhitelisted rejects the request instead of
  // silently dropping them, so an over-posting attempt (mass assignment probing) surfaces as a
  // 400 rather than disappearing without a trace.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Explicit cap (Express's own default is a permissive 100kb-ish value) — the largest legitimate
  // body here is a bank-statement CSV import, well under 2mb. Uses Nest's own body-parser access
  // (not a direct `express` import) since this repo doesn't declare express as its own dependency.
  app.useBodyParser("json", { limit: "2mb" });
  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`IXORIS API listening on :${port}`);
}

bootstrap();
