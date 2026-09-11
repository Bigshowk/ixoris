import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { DocumentsModule } from "../documents/documents.module";
import { SupplierQuotesService } from "./supplier-quotes.service";
import { SupplierQuotesController } from "./supplier-quotes.controller";
import { PurchaseOrdersService } from "./purchase-orders.service";
import { PurchaseOrdersController } from "./purchase-orders.controller";
import { ReorderCheckService } from "./reorder-check.service";
import { ReorderCheckController } from "./reorder-check.controller";
import { GoodsReceiptsService } from "./goods-receipts.service";
import { GoodsReceiptsController } from "./goods-receipts.controller";

@Module({
  imports: [AccountingModule, DocumentsModule],
  controllers: [SupplierQuotesController, PurchaseOrdersController, ReorderCheckController, GoodsReceiptsController],
  providers: [SupplierQuotesService, PurchaseOrdersService, ReorderCheckService, GoodsReceiptsService],
  exports: [ReorderCheckService],
})
export class SupplyChainModule {}
