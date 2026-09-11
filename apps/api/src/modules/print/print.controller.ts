import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { PrintService } from "./print.service";
import { PrintTicketDto } from "./dto/print-ticket.dto";

@RequirePermissions("pos.print.ticket")
@Controller("print")
export class PrintController {
  constructor(private readonly print: PrintService) {}

  /** Sends the ticket to a LAN thermal printer (raw TCP :9100) from the backend. */
  @Post("ticket")
  @HttpCode(204)
  async printTicket(@Body() dto: PrintTicketDto, @CurrentAuth() auth: AuthContext) {
    await this.print.printSaleTicket(auth.companyId, dto);
  }

  /** Raw ESC/POS bytes for the frontend to push to a USB printer via WebUSB. */
  @Get("ticket/:saleId/bytes")
  async getTicketBytes(
    @Param("saleId") saleId: string,
    @Query("paperWidth") paperWidth: "58mm" | "80mm" | undefined,
    @CurrentAuth() auth: AuthContext,
    @Res() res: Response,
  ) {
    const bytes = await this.print.buildTicketBytes(auth.companyId, saleId, paperWidth ?? "80mm");
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(Buffer.from(bytes));
  }
}
