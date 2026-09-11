# IXORIS ERP

ERP intégré (Vente/POS, Comptabilité SYSCOHADA, RH/Paie, CRM, Chaîne d'approvisionnement, Livraison &
Logistique) — architecture cross-platform, synchronisée en temps réel, offline-first, bilingue FR/EN.

## Stack

| Domaine | Choix |
|---|---|
| Frontend back-office | Next.js 14 (App Router) + TailwindCSS + Shadcn UI |
| Frontend caisse (PWA) | Next.js PWA dédiée, offline-first (IndexedDB) |
| Backend | NestJS (REST + WebSocket Gateway) |
| Temps réel | Socket.IO (ou `ws`) + Redis pub/sub (multi-instance) |
| Base de données | PostgreSQL 16 + Prisma ORM |
| Cache / sessions / temps réel | Redis 7 |
| Impression | ESC/POS (USB / réseau / Bluetooth) |
| Monorepo | pnpm workspaces + Turborepo |

## Arborescence

```
PROJET-IXORIS/
├── apps/
│   ├── web/                    # Back-office Next.js (compta, RH, CRM, stock, dashboards) — à construire
│   ├── pos/                    # PWA caisse (scan, vente rapide, offline-first, thème + i18n)
│   ├── delivery/                # PWA chauffeur (tournée, statuts temps réel, PoD signature/QR)
│   └── api/                    # Backend NestJS (REST + WebSocket Gateway)
│
├── packages/
│   ├── database/                # Prisma : schema.prisma, migrations, seed
│   │   ├── prisma/schema.prisma
│   │   └── seed/
│   ├── types/                    # DTOs / schémas Zod partagés front <-> back
│   ├── ui/                        # Composants Shadcn/Tailwind partagés — à construire
│   ├── accounting-engine/          # Moteur SYSCOHADA : écritures, Bilan, Compte de résultat, SIG, rapprochement bancaire
│   ├── payroll-engine/               # Calcul de paie, cotisations, génération bulletin
│   ├── escpos/                        # Formatage tickets/bulletins pour imprimantes thermiques
│   ├── sync-client/                    # File offline IndexedDB + client WebSocket (hooks)
│   ├── rbac/                            # Catalogue de permissions + rôles prédéfinis (dont Livreur)
│   ├── i18n/                              # Dictionnaires FR/EN partagés (frontend + messages backend)
│   └── config/                             # eslint / tsconfig / tailwind partagés — à construire
│
├── docker/
│   └── docker-compose.yml        # Postgres + Redis + Adminer (dev)
│
├── .github/workflows/            # CI (lint, test, build)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

## Modules fonctionnels → mapping technique

| Module métier | Package(s) principal(aux) |
|---|---|
| A. Stock & POS | `apps/pos`, `packages/database` (Product/Stock/Sale...), `packages/escpos` |
| B. Comptabilité OHADA | `packages/accounting-engine`, tables `Account/Journal/JournalEntry/Invoice`, rapprochement bancaire |
| C. Paie & RH | `packages/payroll-engine`, tables `Employee/Payslip/PayrollRun`, module `hr` (présences/congés) |
| D. CRM | tables `Customer/Opportunity/Interaction/Reminder`, notifications réelles (SMTP/Twilio) |
| E. Dashboard 24/7 | `apps/web` (lecture WebSocket), table `Notification` — écran à construire |
| F. Offline / Multi-devise / Audit / RBAC | `packages/sync-client`, `Currency/ExchangeRate`, `AuditLog`, `packages/rbac` |
| G. Supply Chain (PO/GRN/Cotations) | module `supply-chain`, tables `PurchaseOrder/GoodsReceipt/SupplierQuote` |
| H. Livraison & Logistique (Fleet) | `apps/delivery`, module `logistics`, tables `Delivery/DeliveryZone/Vehicle` |
| I. i18n & Thème | `packages/i18n`, champs `User.locale/themePreference`, `Customer.preferredLanguage` |
| J. Trésorerie & Clôture de caisse | module `treasury`, tables `CashBox/CashMovement/CashTransfer`, `CashSession.varianceNotes` |
| K. Contrôle du crédit & Recouvrement | module `credit-control`, tables `PaymentInstallment`, `Customer.isBlocked` |
| L. Actifs & Amortissements (classe 2 OHADA) | module `fixed-assets`, tables `FixedAsset/DepreciationEntry` |
| M. GED & Workflows d'approbation | module `documents`, tables `Document/ApprovalRule/ApprovalRequest` |

## Schéma de base de données

Voir [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma) — validé avec `prisma validate`.

Une soixantaine de modèles organisés en 13 sections :
0. Core / multi-société / multi-devise (`Company`, `Store`, `Currency`, `ExchangeRate`)
1. Auth & RBAC (`User`, `Role`, `Permission`, `RolePermission`, `UserRole`)
2. Audit & notifications (`AuditLog`, `Notification`)
3. Catalogue & stock (`Product`, `ProductBarcode`, `Warehouse`, `Stock`, `StockLot`, `StockMovement`, `StockTransfer`)
4. POS (`Register`, `CashSession`, `Cart`/`CartItem`, `Sale`/`SaleItem`, `Payment`)
5. CRM (`Customer`, `Supplier`, `Opportunity`, `Interaction`, `Reminder`)
6. Comptabilité SYSCOHADA (`Account`, `FiscalYear`, `AccountingPeriod`, `Journal`, `JournalEntry`, `JournalLine`, `Invoice`, `CreditNote`, `BankAccount`, `BankStatement`)
7. RH & Paie (`Department`, `Position`, `Employee`, `Contract`, `Attendance`, `LeaveRequest`, `SalaryComponent`, `PayrollRun`, `Payslip`, `BankTransferBatch`)
8. Chaîne d'approvisionnement (`SupplierQuote`, `PurchaseOrder`/`PurchaseOrderLine`, `GoodsReceipt`/`GoodsReceiptLine`)
9. Livraison & Logistique (`DeliveryZone`, `Vehicle`, `Delivery`, `DeliveryStatusHistory`)
10. Trésorerie (`CashBox`, `CashMovement`, `CashTransfer`, `Register.glAccountId`, `CashSession.varianceNotes`)
11. Contrôle du crédit (`PaymentInstallment`, `Customer.isBlocked`/`blockedReason`/`blockedAt`)
12. Actifs & amortissements (`FixedAsset`, `DepreciationEntry`)
13. GED & approbations (`Document`, `ApprovalRule`, `ApprovalRequest`)

Toutes les extensions des sections 8-13, ainsi que `User.locale`/`themePreference` et `Customer.preferredLanguage`, sont **additives** (nouvelles tables ou colonnes nullable/à défaut) — aucune route ni table existante n'a été modifiée ou cassée.

### Décisions de modélisation clés
- **Multi-société / multi-magasin** : `Company` (entité juridique) → `Store` (points de vente) → `Warehouse` (dépôts physiques, rattachables à un `Store`). Toutes les tables métier portent `companyId`.
- **Panier multi-device** : `Cart` porte un `deviceId` et un `createdById` distincts de la `Sale` finale — un panier initié sur mobile peut être payé sur un autre poste (`Cart.sale` 1-1 via `Sale.cartId`).
- **Valorisation de stock** : `Company.stockValuationMethod` (FIFO/CUMP) pilote la logique applicative ; `StockLot` porte `unitCost` + `expiryDate` pour FIFO et péremption ; `StockMovement` trace chaque mouvement (historique immuable, source de vérité pour la valorisation).
- **Comptabilité SYSCOHADA** : `Account.class` (classes 1 à 9) + `Account.type` (bilan/résultat) permettent de générer Bilan et Compte de Résultat par agrégation. `JournalEntry` est toujours équilibré (Σdébit = Σcrédit sur ses `JournalLine`) et référence sa source (`sourceType`/`sourceId`) pour la comptabilisation automatique (vente, facture, paie). Le lettrage utilise `JournalLine.lettrageCode`.
- **RBAC** : `Role`/`Permission` many-to-many via `RolePermission`, assignation `User`↔`Role` via `UserRole` avec scope optionnel par `Store` (ex: caissier actif uniquement sur son magasin).
- **Audit trail** : `AuditLog` générique (polymorphe `entityType`/`entityId`) avec `oldValue`/`newValue` en JSON.
- **Offline-first** : pas de table dédiée — la file de mutations en attente vit côté client (IndexedDB, `packages/sync-client`) et se rejoue contre l'API au retour réseau ; le serveur reste la source de vérité unique.
- **Trésorerie sans relation polymorphe** : `Register`, `CashBox` et `BankAccount` portent chacun un `glAccountId` vers `Account` — `CashTransfer` référence donc directement `fromAccountId`/`toAccountId` (deux comptes), sans avoir besoin d'un lien polymorphe vers le type de caisse.
- **Amortissements et exercices futurs** : un plan d'amortissement est généré en une fois sur toute la durée de vie du bien (potentiellement 5-10 ans), donc avant que les `FiscalYear` correspondants existent forcément. `DepreciationEntry.fiscalYearId` est donc optionnel — `periodEndDate` (calculée à la génération) fait foi pour savoir quand une ligne est due, et l'exercice n'est résolu qu'au moment du postage effectif.

## Démarrage (une fois le code applicatif généré)

```bash
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm dev` démarre tous les workspaces en parallèle (Turborepo) : API sur `:4000`, `apps/pos` sur `:3001`, `apps/delivery` sur `:3002`.

## État d'avancement

- ✅ **Module A (POS/Stock) — noyau fonctionnel** : `apps/api` (NestJS) avec modules `pos` (produits/scan, paniers multi-device, checkout avec décrémentation de stock FIFO/CUMP, sessions de caisse), `realtime` (Gateway WebSocket Socket.IO pour la synchro cross-device), `print` (ticket ESC/POS via TCP réseau ou octets bruts pour WebUSB) ; `apps/pos` (PWA Next.js) avec scan caméra (ZXing) + douchette HID, panier temps réel, encaissement multi-moyens de paiement, file offline IndexedDB (`packages/sync-client`).
- ✅ **Auth/RBAC — fonctionnel** : `apps/api/src/modules/auth` (login/refresh/logout/me, JWT + refresh token à rotation hashé en base), `JwtAuthGuard`+`PermissionsGuard` globaux (remplacent l'ancien `DevAuthGuard`), matrice de permissions dans `packages/rbac` (5 rôles prédéfinis : Administrateur Général, Caissier, Gestionnaire de Stock, Comptable, DRH), seed (`packages/database/seed/seed.ts`) avec tenant/utilisateurs/produits de démo ; `apps/pos` a un vrai écran de connexion (email/mot de passe), sélecteur de magasin, et rafraîchissement automatique du token sur 401.
- ✅ **Moteur comptable OHADA — fonctionnel** : [`packages/accounting-engine`](packages/accounting-engine) (framework-agnostic) calcule Balance générale, Grand Livre, Compte de Résultat (cascade SIG complète : Marge commerciale → Valeur Ajoutée → EBE → Résultat d'Exploitation → Résultat Financier → RAO → Résultat HAO → Résultat Net) et Bilan (Actif immobilisé/circulant/trésorerie vs Ressources durables/Passif circulant/Trésorerie-passif, avec vérification d'équilibre) à partir d'un plan comptable SYSCOHADA (~50 comptes classes 1-8) et des écritures postées. Côté `apps/api`, le module `accounting` expose la saisie d'écritures manuelles (validation débit=crédit obligatoire), les factures clients/fournisseurs (génèrent leur écriture à la validation), le lettrage automatique par rapprochement de montants, et les rapports (`GET /accounting/reports/*`). **Chaque vente POS complétée est auto-comptabilisée** (débit caisse/banque/client selon le moyen de paiement, crédit 701 Ventes + 4431 TVA collectée) — le seed peuple le plan comptable, les 6 journaux standards (VE/AC/BQ/CA/OD/PA) et l'exercice fiscal en cours.
- ✅ **Moteur de paie — fonctionnel** : [`packages/payroll-engine`](packages/payroll-engine) (framework-agnostic) calcule un bulletin ligne par ligne (salaire de base + primes → brut → retenues salariales → net, plus les charges patronales séparément) via un calculateur de tranches progressives générique (`applyProgressiveBrackets`) réutilisable pour tout barème d'impôt/cotisation. ⚠️ Les taux CNPS/ITS fournis par défaut (`SAMPLE_ITS_BRACKETS_CI`, etc.) sont **illustratifs** — à vérifier auprès de la DGI/CNPS avant tout usage réel. Génère aussi le bulletin en PDF (`pdfkit`) et un fichier CSV de virement groupé (SEPA ne s'applique pas à la zone XOF). Côté `apps/api`, le module `payroll` calcule un cycle de paie pour tous les employés actifs à partir des `SalaryComponent` configurés, **comptabilise automatiquement** la paie validée (une écriture consolidée par cycle dans le journal PA : 661/664 au débit, 422/431/447 au crédit selon le compte configuré par composante), génère les bulletins PDF et le lot de virement. Le seed peuple les composantes de salaire par défaut, un employé de démo avec contrat CDI, et un compte bancaire.
- ✅ **Module CRM — fonctionnel** : `apps/api/src/modules/crm` — fiches clients (`Customer`) avec classification automatique **VIP / Régulier / En retard / Nouveau** recalculée depuis l'historique réel (LTV, nombre de commandes, factures en retard), analytique par client (`GET /crm/customers/:id/analytics`) et à l'échelle de l'entreprise (`GET /crm/analytics` : taux de rétention, segmentation, top clients par valeur), pipeline de prospection Kanban (`Opportunity` avec 6 étapes NEW→WON/LOST, endpoint `/crm/opportunities/kanban`), journal d'interactions (appels/emails/WhatsApp/SMS/notes), et relances automatiques des impayés (`POST /crm/reminders/generate-overdue` scanne les factures en retard, `POST /crm/reminders/dispatch` envoie via un `NotificationSender` interchangeable — actuellement un **stub qui journalise seulement**, aucun fournisseur Email/SMS/WhatsApp réel n'est branché). Les fournisseurs (`Supplier`) sont gérés côté module `accounting` plutôt que CRM, car ils relèvent des achats/factures fournisseurs dans la logique métier de ce projet.
- ✅ **RH étendu — fonctionnel** : `apps/api/src/modules/hr` — départements/postes, fiches employés complètes (création/mise à jour/**sortie** avec clôture automatique du contrat en cours), historique des contrats (CDI/CDD/STAGE/CONSULTANT, création/fin), pointage (check-in/check-out ou saisie manuelle), types de congés + demandes de congé avec workflow d'approbation (`hr.leave.approve`). **Pont RH→Paie** : `AttendanceAdjustmentService` calcule, pour un employé et une période, les jours ouvrés du mois (lun-ven) moins les jours de congé sans solde approuvés et les absences non justifiées (non couvertes par un congé), et **proratise le salaire de base** en conséquence avant le calcul du bulletin — un employé qui a pris 2 jours sans solde sur un mois de 22 jours ouvrés touche 20/22 de son salaire de base. Le module `payroll` (déjà existant) a été relié à ce service ; l'ancien `EmployeesService/Controller` minimal qui vivait dans `payroll` a été déplacé/étendu ici. Le seed peuple 3 types de congés et une demande de congé sans solde déjà approuvée (2 jours ce mois-ci) pour l'employé de démo — de quoi voir la proratisation agir immédiatement sur un cycle de paie.
- ✅ **Rapprochement bancaire — fonctionnel** : [`packages/accounting-engine`](packages/accounting-engine) ajoute `matchBankStatement` (apparie chaque ligne de relevé à l'écriture comptable du même montant sur le compte bancaire, dans une fenêtre de ±5 jours — une ligne créditrice du relevé doit correspondre à un débit du compte 521 côté journal, et inversement) et `parseBankStatementCsv`. Côté `apps/api`, le module `accounting` gagne `BankAccountsController` (CRUD, rattaché à un compte du plan comptable) et `BankStatementsController` : import d'un relevé (CSV `date;label;montant`), rapprochement automatique (`POST .../auto-match`), rapprochement manuel ligne par ligne, et un résumé (lignes rapprochées/non rapprochées, montant en suspens). Le seed crée un dépôt bancaire de 1 000 000 XOF déjà comptabilisé + un relevé de démo à 2 lignes (une qui matche, une qui ne matche pas exprès — des frais bancaires) pour tester le flux immédiatement.
- ✅ **Notifications CRM réelles — fonctionnel** : le stub `LoggingNotificationSender` reste le comportement par défaut (sûr), mais `apps/api/src/modules/crm/senders` implémente désormais de vrais fournisseurs : `EmailSender` (SMTP via `nodemailer`, compatible SendGrid/Mailgun/boîte pro) et `TwilioSender` (SMS + WhatsApp via l'API REST Twilio, appelée avec `fetch` natif — aucune dépendance SDK). Le choix entre les deux se fait via `NOTIFICATION_MODE=live` (sinon reste en mode "log") dans `.env` — un simple export de variable d'environnement, aucun changement de code requis pour passer en prod une fois les identifiants SMTP/Twilio renseignés. Chaque fournisseur échoue explicitement (erreur claire, `Reminder.status="FAILED"`) s'il n'est pas configuré plutôt que de simuler un succès.
- ✅ **Chaîne d'approvisionnement — fonctionnel** : `apps/api/src/modules/supply-chain` — cotations fournisseurs (`SupplierQuote`, comparatif prix/délais), commandes fournisseurs (`PurchaseOrder`/`PurchaseOrderLine`), et surtout `ReorderCheckService` : scanne `Stock.quantity` vs `Product.minStockAlert`, sélectionne automatiquement **le fournisseur le moins cher** via les cotations actives, et génère un bon de commande `DRAFT` groupé par (fournisseur, dépôt) — `autoGenerated=true`. Sans cotation disponible pour un produit sous seuil, une `Notification` est créée à la place plutôt qu'une commande orpheline. Les réceptions (`GoodsReceipt`/`GoodsReceiptLine`) gèrent l'écart quantité attendue/reçue/endommagée/manquante, mettent à jour `Stock`/`StockLot`/`StockMovement` (units abîmées exclues du stock vendable), avancent le statut de la commande (`PARTIALLY_RECEIVED`/`RECEIVED`), et **comptabilisent automatiquement** l'écriture Fournisseur/Achats (601 + 4452 TVA récupérable au débit, 401 Fournisseurs au crédit — les marchandises manquantes ne sont pas dues au fournisseur, les endommagées sont réparties en perte 65).
- ✅ **Livraison & Logistique — fonctionnel** : `apps/api/src/modules/logistics` + **`apps/delivery`** (nouvelle PWA chauffeur). Zones de livraison avec calcul automatique des frais (forfait + tarif/km + tarif/kg), véhicules, et `Delivery` reliée à une `Sale` (POS) et/ou une `Invoice` (B2B) existante — jamais un doublon de la commande. Statuts `PENDING → LOADED → IN_TRANSIT → DELIVERED` (ou `FAILED`/`CANCELLED`), chaque transition tracée dans `DeliveryStatusHistory` (horodatage + auteur + GPS optionnel). La **preuve de livraison** (signature capturée au doigt sur `<canvas>`, ou scan du QR code du colis via la même brique ZXing que le POS) est le seul chemin vers `DELIVERED`. **Comptabilisation automatique** : frais de livraison encaissés → crédit 707 Produits accessoires ; perte/casse en transit déclarée sur un échec → charge 65 Autres charges. Le nouveau rôle prédéfini **Livreur** (`logistics.delivery.drive`) ne voit que ses propres livraisons (`GET /logistics/deliveries/mine`).
- ✅ **i18n & Thème — fonctionnel** : [`packages/i18n`](packages/i18n) fournit des dictionnaires FR/EN typés (une clé manquante dans une locale casse la compilation) consommés à la fois par le frontend et par le backend (ex. les relances CRM sont désormais rédigées dans la langue préférée du client, `Customer.preferredLanguage`, via le même `t()`). Le mode sombre/clair (`ThemeProvider`, bascule système/clair/sombre, persisté en `localStorage` **et** synchronisé serveur via `PATCH /auth/preferences` sur `User.themePreference`) est appliqué à l'échelle de l'app (Tailwind `darkMode: "class"`). ⚠️ **Écart assumé par rapport au plan initial** : au lieu de next-intl (qui suppose un routage par segment `[locale]`/middleware, inutile ici puisqu'il n'y a pas de bascule de langue par URL), un contexte React léger a été construit directement sur `packages/i18n` — même garantie (aucun texte en dur dans les nouveaux composants), sans la machinerie de routage. La retro-conversion des textes existants a été faite sur les écrans représentatifs (connexion, en-tête caisse, panier) plutôt que sur l'intégralité de l'UI déjà écrite — modèle à reproduire ailleurs au besoin.
- ✅ **Trésorerie & clôture de caisse — fonctionnel** : `apps/api/src/modules/treasury` — petites caisses/coffres (`CashBox`) avec mouvements (dépôt/retrait/dépense/ajustement, **comptabilisés automatiquement** dès la création), transferts inter-caisses (`CashTransfer`, en attente puis complétés via `POST /treasury/transfers/:id/complete`, fonctionne uniformément entre caisse POS/petite caisse/banque car les trois sont adossées à un compte). La clôture d'une session de caisse (`PATCH /pos/registers/sessions/:id/close`) calcule désormais l'écart compté/attendu et le **comptabilise automatiquement** (débit/crédit 65 ou 75 selon le sens) si non nul.
- ✅ **Contrôle du crédit & recouvrement — fonctionnel** : `apps/api/src/modules/credit-control` — échéanciers de paiement (`PaymentInstallment`, générés sur une facture validée, somme vérifiée contre le total TTC), blocage/déblocage manuel d'un client, et blocage **automatique** dès qu'une facture client validée dépasse `Customer.creditLimit` (vérifié à la création de facture et à la vente à crédit en caisse) ou qu'une facture est en retard critique (`POST /credit-control/run-overdue-check`, seuil configurable, 30 jours par défaut). Les relances d'impayés existantes (module CRM) n'ont pas été dupliquées.
- ✅ **Actifs & amortissements (classe 2 OHADA) — fonctionnel** : `apps/api/src/modules/fixed-assets` — registre des immobilisations (`FixedAsset`, comptes classe 2/28 dédiés), génération du plan d'amortissement complet à la création (linéaire ou dégressif avec bascule automatique vers le linéaire en fin de vie, via `computeDepreciationSchedule` dans `packages/accounting-engine`), et **comptabilisation** des dotations dues (`POST /fixed-assets/depreciation/run`, débit 681 / crédit compte d'amortissement classe 28, comme les autres flux "à déclencher manuellement" du projet).
- ✅ **GED & workflows d'approbation — fonctionnel** : `apps/api/src/modules/documents` — pièces jointes polymorphes (`Document.attachableType`/`attachableId`, même convention que `AuditLog`/`StockMovement`) attachables à une facture, écriture, employé, actif ou bon de commande ; règles d'approbation configurables par seuil (`ApprovalRule.minAmount` + rôle requis) sur les bons de commande et les dépenses de caisse — au-delà du seuil, l'envoi du bon de commande (`POST /supply-chain/purchase-orders/:id/send`) ou le postage de la dépense (`POST /treasury/cashboxes/movements/:id/post`) est retenu jusqu'à ce qu'un titulaire du rôle requis approuve (`POST /approvals/requests/:id/decide`).
- ⏳ **À construire** : `apps/web` (back-office — tout est pour l'instant en JSON/PDF brut, pas d'écran), écrans d'administration des rôles/utilisateurs, retro-conversion i18n complète du reste de l'UI POS.

### Limites connues (à lever avant prod)
- Tokens stockés en `localStorage` côté PWA (XSS-sensible) — une vraie prod devrait passer par un cookie `httpOnly` posé par l'API, ce qui suppose un même domaine ou un proxy.
- Les montants transitent en `number` JS côté API POS (conversion depuis `Decimal` Prisma) pour rester simple ; le moteur comptable garde les totaux en `number` également à ce stade (arrondi à 2 décimales à chaque étape) — un passage à `Decimal`/`decimal.js` de bout en bout serait plus rigoureux pour des montants très élevés ou des taux de TVA non standards.
- La numérotation des ventes/factures (préfixe + hex aléatoire) évite les collisions sans séquence en base ; à remplacer par un compteur transactionnel si une numérotation strictement séquentielle est exigée fiscalement (DGI, audit).
- L'offline-first n'est optimisé que pour l'ajout d'article au panier ; incrément/suppression/retrait restent en ligne uniquement dans ce slice.
- Pas encore d'écran d'administration RBAC (créer/assigner des rôles se fait en base ou via le seed) — le modèle de données et les guards sont prêts à recevoir cette UI.
- L'auto-comptabilisation des ventes/factures est *best-effort* : si le plan comptable/journal n'est pas configuré pour une société, la vente reste non bloquée mais non comptabilisée (avertissement en log) — à surveiller via `Sale.journalEntryId IS NULL`.
- Le lettrage automatique ne fait que du rapprochement exact 1-pour-1 par montant ; les paiements partiels ou répartis sur plusieurs factures restent à letter manuellement.
- Le Bilan est calculé comme une "situation intermédiaire" (résultat de la période injecté dans les Ressources Durables) plutôt que via une écriture de clôture formelle des comptes de classes 6-8 — correct pour un pilotage en cours d'exercice, mais une clôture d'exercice en bonne et due forme reste à implémenter.
- **Les taux de paie (CNPS, ITS) sont des valeurs d'exemple, pas des données fiscales vérifiées** — le mécanisme de calcul (tranches progressives, plafonds) est correct et testé, mais les chiffres doivent être confirmés/mis à jour par un comptable avant toute utilisation réelle (voir `packages/payroll-engine/src/default-components.ts`).
- La comptabilisation de la paie se fait en une écriture consolidée par cycle (pas une par bulletin) — pratique standard, mais `Payslip.journalEntryId` reste donc toujours `null` ; la traçabilité passe par `JournalEntry.sourceType="PayrollRun"`.
- La proratisation ne compte que les jours ouvrés Lun-Ven du mois calendaire — aucun calendrier de jours fériés n'est pris en compte (simplification connue).
- Les notifications restent en mode "log" par défaut tant que `NOTIFICATION_MODE=live` n'est pas explicitement défini — volontaire, pour ne jamais contacter de vrais clients pendant le dev/la démo. Il faut aussi renseigner SMTP_*/TWILIO_* dans `.env` pour que le mode live fonctionne réellement.
- Le lettrage entre paiements partiels et factures n'est pas pris en compte dans le calcul du retard client (`overdueInvoiceCount`) — une facture `PARTIALLY_PAID` est comptée en retard sur son solde total, pas le reste dû réel.
- Rien ne déclenche `generate-overdue`/`dispatch` ni le rapprochement bancaire automatiquement (pas de cron) — à appeler manuellement ou via un scheduler (`@nestjs/schedule`) à ajouter.
- Le rapprochement bancaire ne fait que du matching exact 1-pour-1 par montant (comme le lettrage) — un virement scindé en plusieurs lignes de relevé pour une seule écriture (ou l'inverse) doit être rapproché manuellement.
- L'import de relevé attend un CSV `date;label;montant` générique — pas de parseur OFX/MT940 (formats bancaires normalisés) pour l'instant ; à adapter au format d'export réel de la banque si besoin.
- Le réappro auto n'a pas de cron (comme les relances/le rapprochement) — `POST /supply-chain/reorder-check/run` s'appelle manuellement pour l'instant.
- `Delivery` n'est pas ligne-item-trackée (pas de détail produit par livraison) — la perte en transit est saisie comme un montant estimé global, pas répercutée sur des `SaleItem`/`StockMovement` spécifiques ; un modèle plus complet ajouterait des `DeliveryLine`.
- Pas de Gateway WebSocket dédiée à la logistique (contrairement au POS) — `apps/delivery` recharge la liste après chaque action plutôt que de recevoir des mises à jour poussées ; suffisant pour un chauffeur qui ne voit que ses propres livraisons, mais un futur tableau de bord dispatcher temps réel en aurait besoin.
- i18n : seuls les écrans de connexion, l'en-tête et le panier de `apps/pos` (plus l'intégralité de `apps/delivery`, écrit i18n dès le départ) utilisent les clés de traduction — le reste de l'UI POS déjà existante garde son texte français en dur.
- Ni la clôture des dotations d'amortissement (`POST /fixed-assets/depreciation/run`) ni le contrôle du crédit (`POST /credit-control/run-overdue-check`) n'ont de cron — même limitation que le réappro auto/rapprochement bancaire/relances, à appeler manuellement ou via un scheduler à ajouter.
- L'approbation d'un bon de commande ou d'une dépense exige que le décideur porte **exactement** le rôle configuré sur l'`ApprovalRule` (pas de règle de type "l'Administrateur Général peut toujours outrepasser") — un administrateur doit explicitement porter ce rôle pour décider.
- Le blocage crédit se déclenche à la validation d'une facture ou à l'encaissement d'une vente en mode CREDIT, mais rien ne réévalue automatiquement l'encours d'un client quand une facture existante change de statut (paiement partiel, annulation) — seul `run-overdue-check` et la validation d'une nouvelle facture recalculent.
- Les transferts de trésorerie et les mouvements de caisse (dépôt/retrait) créés hors caisse POS (`CashBox`) ne se comptabilisent pas tout seuls : un transfert reste `PENDING` jusqu'à `POST /treasury/transfers/:id/complete`, un mouvement non soumis à approbation se poste immédiatement, mais un mouvement `EXPENSE` retenu pour approbation ne se poste qu'après `POST /treasury/cashboxes/movements/:id/post`.

## Identifiants de démonstration (après `pnpm db:seed`)

| Compte | Mot de passe | Rôle | Portée |
|---|---|---|---|
| `admin@ixoris.dev` | `Admin123!` | Administrateur Général | Tous magasins |
| `caissier@ixoris.dev` | `Caissier123!` | Caissier | Magasin Principal (MAIN) |
| `livreur@ixoris.dev` | `Livreur123!` | Livreur | Magasin Principal (MAIN) |

4 produits de démo avec codes-barres (`6180000000011/28/35/42`), 100 unités en stock chacun (sauf l'eau minérale, volontairement sous son seuil de réappro pour tester `reorder-check`). 2 fournisseurs avec cotations concurrentes, 2 zones de livraison, 1 livraison de démo assignée au livreur. Trésorerie : 1 petite caisse avec 1 dépôt non posté et 1 transfert `PENDING` (à poster via l'API pour voir la comptabilisation). Crédit : Restaurant Le Baobab auto-bloqué (encours > limite), Supermarché Koné avec un échéancier à 3 tranches sur une facture de 600 000 XOF. Actifs : 1 véhicule (15M XOF, dégressif sur 5 ans) avec son plan d'amortissement complet généré. GED : 1 document attaché à la facture de Koné, règle d'approbation à 500 000 XOF sur les bons de commande.

## Prochaines étapes proposées

1. `apps/web` (back-office Next.js) — premier écran utile : rapports comptables, bulletins, pipeline CRM, fiches RH, rapprochement bancaire et supply chain n'existent qu'en JSON/PDF brut aujourd'hui, sans interface.
2. Un scheduler (`@nestjs/schedule`) pour déclencher automatiquement `generate-overdue`/`dispatch` (relances), l'auto-match bancaire, `reorder-check`, `credit-control/run-overdue-check` et `fixed-assets/depreciation/run`, plutôt que des appels manuels.
3. Écrans d'administration RBAC (créer/assigner des rôles).
4. Retro-conversion i18n du reste de l'UI `apps/pos` déjà écrite avant ce lot ; Gateway WebSocket dédiée à la logistique si un tableau de bord dispatcher temps réel est ajouté à `apps/web`.
5. Étendre l'offline-first (incrément/suppression de ligne, résolution de conflits) et adapter la Gateway WebSocket avec l'adaptateur Redis pour le multi-instance.
