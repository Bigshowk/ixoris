# apps/api — Backend NestJS

API REST + Gateway WebSocket (synchronisation temps réel multi-appareils).

Modules prévus (alignés sur le schéma Prisma) :
- `auth/` — JWT, RBAC (rôles, permissions, guards)
- `pos/` — caisse, paniers partagés, ventes, paiements, sessions de caisse
- `stock/` — produits, entrepôts, mouvements, lots, transferts
- `accounting/` — plan comptable SYSCOHADA, journaux, écritures, bilan/CR
- `hr-payroll/` — employés, contrats, paie, bulletins, virements
- `crm/` — clients, fournisseurs, opportunités, relances
- `realtime/` — Gateway WebSocket (Socket.IO ou `ws`) + adaptateur Redis pub/sub
- `printing/` — génération ESC/POS pour tickets et bulletins

Consomme `@ixoris/database`, `@ixoris/accounting-engine`, `@ixoris/payroll-engine`, `@ixoris/types`.
