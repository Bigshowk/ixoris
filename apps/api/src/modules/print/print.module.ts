import { Module } from "@nestjs/common";
import { PrintController } from "./print.controller";
import { PrintService } from "./print.service";
import { NetworkPrinterClient } from "./network-printer.client";

@Module({
  controllers: [PrintController],
  providers: [PrintService, NetworkPrinterClient],
})
export class PrintModule {}
