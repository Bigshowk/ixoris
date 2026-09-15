# IXORIS ERP

ERP intégré (Vente/POS, Comptabilité SYSCOHADA, RH/Paie, CRM, Chaîne d'approvisionnement, Livraison &
Logistique) — architecture cross-platform, synchronisée en temps réel, offline-first, bilingue FR/EN.

Édité par **KADERSYS SOFTWARE SYSTEMS**. Auteur & ingénierie : **Kader Salim**, ingénieur professionnel en
informatique. Le détail (fiche technique, statut des services, crédits) est disponible dans l'application
elle-même via le module **À propos** (`/a-propos`), et l'aide contextuelle via le module **Aide** (`/aide`) —
voir [État d'avancement](#état-davancement).

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
│   ├── web/                    # Back-office Next.js (compta, RH, CRM, stock, dashboards)
│   ├── pos/                    # PWA caisse (scan, vente rapide, offline-first, thème + i18n)
│   ├── delivery/                # PWA chauffeur (tournée, statuts temps réel, PoD signature/QR)
│   └── api/                    # Backend NestJS (REST + WebSocket Gateway)
│
├── packages/
│   ├── database/                # Prisma : schema.prisma, migrations, seed
│   │   ├── prisma/schema.prisma
│   │   └── seed/
│   ├── types/                    # DTOs / schémas Zod partagés front <-> back
│   ├── ui/                        # Composants React partagés (PasswordInput, IxorisLogo)
│   ├── accounting-engine/          # Moteur SYSCOHADA : écritures, Bilan, Compte de résultat, SIG, rapprochement bancaire
│   ├── payroll-engine/               # Calcul de paie, cotisations, génération bulletin
│   ├── escpos/                        # Formatage tickets/bulletins pour imprimantes thermiques
│   ├── local-ai/                       # Agent IA local (RAG hors-ligne, anomalies stock, suggestions comptables)
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
| N. Sécurité — Auth/MFA, rate-limiting, WebSocket authentifié | `apps/api/src/modules/auth`, `modules/realtime/pos.gateway.ts` — voir [Sécurité & durcissement](#sécurité--durcissement) |
| O. Agent IA Local (Offline AI) | `packages/local-ai`, module `apps/api/src/modules/local-ai`, onglet `apps/web/aide` — voir [Agent IA Local](#agent-ia-local-offline-ai) |

## Sécurité & durcissement

Un audit d'architecture et de sécurité complet (authentification/RBAC, synchronisation hors-ligne, injection/XSS) a été mené sur l'ensemble du monorepo. Le détail complet — méthodologie, constats fichier:ligne, correctifs appliqués et recommandations restantes — est consigné dans **[RAPPORT_SECURITE_ET_REMEDS.md](RAPPORT_SECURITE_ET_REMEDS.md)**. Correctifs notables déjà appliqués :

- **Authentification** : l'API refuse de démarrer sans un vrai `JWT_SECRET` (fin du secret par défaut codé en dur) ; limitation de débit (anti brute-force) sur `/auth/login` et `/auth/mfa/verify` ; détection de réutilisation de refresh token avec révocation de session en cascade ; révocation des sessions actives au changement de mot de passe.
- **Canal temps réel POS** : le namespace WebSocket `/pos` exige désormais le même jeton d'accès que l'API REST, avec vérification que le magasin rejoint appartient bien à la société de l'appelant (isolation multi-tenant).
- **Caisse (POS)** : nouvelle permission dédiée `pos.price.override` (non accordée au Caissier par défaut) pour toute modification manuelle de prix ; toute remise est plafonnée serveur au total de la ligne ; correction d'un accès possible à un article d'un autre panier.
- **Livraison** : un livreur ne peut plus consulter ni modifier une livraison qui ne lui est pas assignée (sauf détenteur de `logistics.delivery.manage`).
- **Validation des entrées** : `ValidationPipe` rejette désormais (plutôt que de silencieusement ignorer) tout champ non attendu dans une requête ; limite de taille de corps de requête explicite.
- **Assainissement (SQL/XSS)** : audit exhaustif — aucune requête SQL brute non paramétrée, aucun contournement de l'échappement HTML par défaut de React identifié dans le code actuel.

## Agent IA Local (Offline AI)

`packages/local-ai` (framework-agnostic) + module `apps/api/src/modules/local-ai` exposent un assistant IA **hybride, entièrement local** : un vrai LLM génératif quand un serveur d'inférence local est disponible, avec repli automatique et transparent sur un moteur de recherche documentaire (RAG léger) sinon. Dans les deux cas, **aucun appel réseau sortant vers l'extérieur, aucune clé API, aucune donnée envoyée à un service tiers** — tout tourne sur la machine du client.

### Architecture hybride (LLM local + RAG)

1. **Fournisseur d'inférence local** — `packages/local-ai/src/llm-provider.ts` (`OllamaProvider`) parle le protocole HTTP d'[Ollama](https://ollama.com) (`GET /api/tags`, `POST /api/generate`), le standard de facto pour exécuter des modèles quantifiés (Mistral, Llama 3, Phi-3...) sur une seule machine. Tout autre serveur compatible (le binaire `server` de llama.cpp, LM Studio) fonctionne sans modification, tant qu'il expose les deux mêmes routes.
2. **Détection automatique** — `packages/local-ai/src/hybrid-assistant.ts` sonde `OLLAMA_BASE_URL` (défaut `http://localhost:11434`) avec un délai court (1,5 s), mis en cache 30 s pour ne pas resonder le réseau à chaque frappe. Un modèle disponible est choisi par ordre de préférence (`phi3:mini` → `mistral:7b-instruct` → `llama3:8b`), sinon le premier modèle installé.
3. **Génération de réponse raisonnée** — si un LLM est détecté : le RAG (`retrieval.ts`, recherche TF-IDF) extrait d'abord les passages pertinents de la documentation, `prompt-builder.ts` construit un prompt structuré (rôle d'expert IXORIS + contexte extrait + question), puis le LLM local génère une réponse synthétique en français, citée avec ses sources. **Aucune dépendance au réseau Internet à aucune étape.**
4. **Repli hybride sans erreur** — si aucun serveur LLM n'est détecté, **ou** si l'appel échoue pour n'importe quelle raison (serveur qui plante, mémoire insuffisante, timeout), l'assistant bascule silencieusement sur le moteur RAG extractif (réponse = passage documentaire le plus pertinent, sans génération de texte) — jamais d'erreur exposée à l'utilisateur. Le statut réel est exposé via `GET /local-ai/status` et affiché dans l'onglet **Aide** :
   - `Statut IA : Agent LLM Local Actif (Hors-ligne)` — un serveur Ollama répond, la réponse est générée.
   - `Statut IA : Mode RAG Léger (LLM non détecté)` — repli automatique, réponse extractive.

### Installer et lancer le LLM local (Ollama)

Optionnel — l'ERP fonctionne sans, en mode RAG léger. Pour activer la génération :

```bash
# 1. Installer Ollama (Windows/macOS/Linux) : https://ollama.com/download
# 2. Télécharger un modèle d'instruction léger (choisir selon la RAM disponible) :
ollama pull phi3:mini            # ~2,3 Go — recommandé sur poste standard (8-16 Go RAM)
# ou : ollama pull mistral:7b-instruct   # ~4,1 Go — meilleure qualité, 16 Go+ RAM recommandés
# 3. Démarrer le serveur (généralement automatique après installation) :
ollama serve
```

Dès qu'`ollama serve` répond sur `http://localhost:11434` (même machine que l'API), l'onglet Aide bascule automatiquement sur `Agent LLM Local Actif` au prochain rafraîchissement du statut — aucune configuration côté IXORIS n'est nécessaire au-delà de la variable optionnelle `OLLAMA_BASE_URL` (voir `.env.example`) si Ollama tourne sur une autre adresse.

### Les trois capacités (accessibles via l'API)

1. **Super-Assistant Support (`POST /local-ai/ask`, `GET /local-ai/status`)** — décrit ci-dessus, intégré à l'onglet **Aide** (`apps/web/aide`) sous forme d'un champ de question en langage naturel avec badge de statut du moteur.
2. **Détection d'anomalies de stock (`GET /local-ai/stock/anomalies`)** — `packages/local-ai/src/anomaly-detection.ts` : statistiques déterministes et explicables sur les mouvements de stock récents (stock négatif, écart-type/z-score par rapport à l'historique du produit, ajustements manuels sans référence, corrections répétées en moins de 24h) — chaque anomalie porte une justification en langage clair, pas de boîte noire. Reste volontairement à base de règles (pas de génération LLM) pour garder ces alertes 100 % explicables et auditables.
3. **Suggestion d'écritures comptables (`POST /local-ai/accounting/suggest-entry`)** — `packages/local-ai/src/accounting-suggest.ts` : suggère des comptes du plan SYSCOHADA à partir d'une description libre (mots-clés), pour accélérer la saisie manuelle — ne poste jamais d'écriture automatiquement, l'utilisateur garde toujours la décision finale.

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

## Démarrage

### 1. Prérequis

| Outil | Version | Vérifier avec |
|---|---|---|
| Node.js | ≥ 20.0.0 | `node -v` |
| pnpm | 9.x (le monorepo épingle `pnpm@9.0.0` dans `package.json`) | `pnpm -v` |
| PostgreSQL | 16 | `psql --version` (si install native) |
| Redis | 7 | `redis-cli ping` (si install native) |
| Git | — | `git --version` |

Pas de pnpm en local ? `corepack enable` (fourni avec Node ≥ 16.13) active automatiquement la bonne version épinglée dans `package.json`, sans installation globale séparée.

### 2. Base de données et cache — deux options

**Option A — Docker (recommandé, le plus simple)**

```bash
docker compose -f docker/docker-compose.yml up -d
```

Démarre Postgres 16 (`localhost:5432`, user/pass/db `ixoris`/`ixoris`/`ixoris_erp`), Redis 7 (`localhost:6379`) et Adminer (`localhost:8080`, interface web d'admin DB) — identifiants déjà cohérents avec `.env.example`, aucune config à toucher.

**Option B — Installation native (sans Docker)**

Si Docker n'est pas disponible sur la machine (c'est le cas de l'environnement où ce projet a été développé et testé) :

1. Installer PostgreSQL 16 et Redis 7 nativement.
2. Créer le rôle et la base attendus par `.env` :
   ```sql
   CREATE ROLE ixoris WITH LOGIN PASSWORD 'ixoris';
   CREATE DATABASE ixoris_erp OWNER ixoris;
   ```
   Exemple avec `psql` (adapter le chemin selon l'OS — sur Windows, typiquement `C:\Program Files\PostgreSQL\16\bin\psql.exe`) :
   ```bash
   psql -U postgres -c "CREATE ROLE ixoris WITH LOGIN PASSWORD 'ixoris';"
   psql -U postgres -c "CREATE DATABASE ixoris_erp OWNER ixoris;"
   ```
3. S'assurer que les deux services tournent avant de lancer l'API :
   ```bash
   # Windows (pg_ctl) :
   pg_ctl status -D "C:\Program Files\PostgreSQL\16\data"
   pg_ctl start -D "C:\Program Files\PostgreSQL\16\data" -l pg_log.log   # si arrêté

   # macOS/Linux :
   pg_isready
   redis-cli ping   # doit répondre "PONG"
   ```
   Redis n'est utilisé aujourd'hui que par les hooks réservés au multi-instance (pub/sub temps réel) — son absence ne bloque pas le démarrage de l'API en mono-instance, mais mieux vaut le démarrer pour rester fidèle à l'architecture cible.

### 3. Variables d'environnement

```bash
cp .env.example .env
```

Le fichier `.env` (racine, lu par toutes les apps via Turborepo) contient :

| Variable | Rôle | Valeur par défaut (dev) |
|---|---|---|
| `DATABASE_URL` | Connexion Prisma → Postgres | `postgresql://ixoris:ixoris@localhost:5432/ixoris_erp` |
| `REDIS_URL` | Connexion Redis | `redis://localhost:6379` |
| `JWT_SECRET` | Signature des tokens d'accès/refresh | **obligatoire** — l'API refuse de démarrer si absent ou laissé à `"change-me"` (voir [Sécurité & durcissement](#sécurité--durcissement)) |
| `JWT_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` | Durées de vie des tokens | `1d` / `30d` |
| `API_PORT` | Port HTTP de `apps/api` | `4000` |
| `CORS_ORIGIN` | Origines autorisées côté API | `http://localhost:3000,http://localhost:3001,http://localhost:3002` — **doit inclure le port de chaque frontend lancé** (web/pos/delivery) sous peine d'erreurs réseau silencieuses côté navigateur |
| `NEXT_PUBLIC_API_URL` | URL de l'API vue par les frontends | `http://localhost:4000` |
| `NEXT_PUBLIC_WS_URL` | URL du WebSocket (sync temps réel POS) | `ws://localhost:4001` |
| `NOTIFICATION_MODE` | `log` (défaut, sûr) ou `live` (envoi réel SMTP/Twilio) | `log` |
| `SMTP_*` / `TWILIO_*` | Identifiants des fournisseurs de notification réels | vides — uniquement nécessaires si `NOTIFICATION_MODE=live` |
| `OLLAMA_BASE_URL` | Adresse du serveur LLM local pour l'Agent IA (voir [Agent IA Local](#agent-ia-local-offline-ai)) | `http://localhost:11434` — optionnel, repli automatique sur le RAG léger si injoignable |

### 4. Installation des dépendances

```bash
pnpm install
```

Installe toutes les dépendances de tous les workspaces (`apps/*`, `packages/*`) en une seule commande, avec un unique `node_modules` partagé (pnpm workspaces + hoisting).

### 5. Base de données : génération, migrations, seed

```bash
pnpm db:generate   # génère le client Prisma (packages/database) à partir de schema.prisma
pnpm db:migrate    # applique les migrations SQL (crée les tables) — prisma migrate dev
pnpm db:seed       # peuple des données de démo (entreprise, magasin, produits, utilisateurs, etc.)
```

`db:generate` doit être relancé après tout `pull`/`checkout` qui modifie `packages/database/prisma/schema.prisma`, même sans nouvelle migration — le client Prisma généré (`.prisma/client`) n'est pas versionné.

### 6. Lancer l'application

**Tout en une fois (recommandé) :**

```bash
pnpm dev
```

Turborepo démarre en parallèle les 4 apps, chacune sur son port :

| App | Commande interne | URL |
|---|---|---|
| `apps/api` (NestJS) | `nest start --watch` | http://localhost:4000 |
| `apps/web` (back-office) | `next dev` | http://localhost:3000 |
| `apps/pos` (caisse PWA) | `next dev -p 3001` | http://localhost:3001 |
| `apps/delivery` (livreur PWA) | `next dev -p 3002` | http://localhost:3002 |

**App par app (utile pour isoler un problème ou économiser des ressources) :**

```bash
pnpm --filter @ixoris/api run dev        # API seule, :4000
pnpm --filter @ixoris/web run dev        # back-office seul, :3000
pnpm --filter @ixoris/pos run dev        # caisse seule, :3001
pnpm --filter @ixoris/delivery run dev   # app livreur seule, :3002
```

L'API doit tourner en premier (ou du moins avant qu'un frontend n'essaie de se connecter) — sans elle, les écrans de connexion afficheront des erreurs réseau génériques plutôt qu'un message explicite.

### 7. Se connecter

Une fois `pnpm db:seed` exécuté, utiliser les [identifiants de démonstration](#identifiants-de-démonstration-après-pnpm-dbseed) ci-dessous sur l'app correspondante :
- back-office (`:3000`) → `admin@ixoris.dev`
- caisse (`:3001`) → `caissier@ixoris.dev`
- app livreur (`:3002`) → `livreur@ixoris.dev`

### Dépannage

- **`Can't reach database server at localhost:5432`** (erreur Prisma `P1001`) au démarrage de l'API — Postgres n'est pas démarré, ou vient tout juste de démarrer et n'accepte pas encore de connexions (race condition fréquente au boot). Vérifier avec `pg_ctl status` / `pg_isready`, réessayer quelques secondes après.
- **`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`** (si l'API est lancée directement via `ts-node` plutôt que `nest start`) — Node refuse de "stripper" les types TypeScript d'un fichier atteint via un chemin `node_modules` (y compris un symlink de workspace pnpm). Ne pas créer d'imports package-spécifiques artificiels (ex. symlink manuel) entre packages internes du monorepo dans un contexte sans étape de build ; préférer un import relatif entre packages frères le cas échéant.
- **Erreur CORS / requêtes qui échouent silencieusement depuis un frontend** — vérifier que le port de ce frontend figure bien dans `CORS_ORIGIN` (`.env`), et redémarrer l'API après modification (variable lue au boot, pas de hot-reload sur `.env`).
- **La caisse ou l'app livreur affichent "Identifiants invalides" alors que le mot de passe est correct** — ces écrans affichent ce message générique pour *toute* erreur de connexion, y compris une API ou une base de données indisponibles à cet instant précis. Vérifier d'abord que l'API répond (`curl http://localhost:4000/auth/me` doit renvoyer un 401 JSON, pas une erreur de connexion) avant de suspecter les identifiants.
- **Un frontend affiche une page blanche ou un contenu périmé après une modification de code** (particulièrement `apps/pos`, `apps/delivery`) — ces deux PWA enregistrent un service worker (`public/sw.js`) qui met en cache l'app-shell pour le mode hors-ligne. En dev, si le comportement semble figé après un changement, désinscrire le service worker et vider le cache depuis les DevTools du navigateur (Application → Service Workers → Unregister, puis Application → Storage → Clear site data), puis recharger.
- **`pnpm install` échoue sans accès réseau** — s'assurer que `pnpm-lock.yaml` est présent et à jour ; sans accès registre npm, seules les dépendances déjà présentes dans le cache pnpm local peuvent être réutilisées (aucune nouvelle dépendance ne peut être ajoutée dans ce cas).

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
- ✅ **`apps/web` (back-office) — fonctionnel** : écrans pour tous les modules ci-dessus (dashboard temps réel avec notifications, comptabilité, paie, RH, CRM, stock, achats, livraisons + carte de suivi GPS, trésorerie, crédit, actifs, GED, administration).
- ✅ **Sécurité — MFA (TOTP) & robustesse du mot de passe — fonctionnel** : [`packages/ui`](packages/ui) fournit un composant `PasswordInput` partagé (bascule affichage/masquage, jauge de robustesse à 5 niveaux avec indices de critères manquants) intégré aux écrans de connexion des 3 apps, à la création d'utilisateur (admin) et au changement de mot de passe. Le module `auth` gagne une authentification à deux facteurs TOTP (RFC 6238/4226) **implémentée nativement sur `crypto`** (aucune dépendance externe — `otplib`/`qrcode` indisponibles sans accès réseau dans cet environnement) : `POST /auth/mfa/setup|enable|disable`, connexion en 2 étapes (`POST /auth/login` renvoie un `mfaToken` transitoire si le MFA est actif, échangé contre les tokens finaux via `POST /auth/mfa/verify`), 10 codes de secours à usage unique générés à l'activation (hashés en base, jamais stockés en clair). Auto-enrôlement en libre-service via le nouvel écran `apps/web/profil` (QR code rendu côté navigateur via `qrcode` chargé en CDN au runtime — même pattern que Leaflet pour la carte logistique — avec repli "saisie manuelle" du secret) ; un administrateur peut rendre le MFA obligatoire par utilisateur (`User.mfaRequired`, bouton "Exiger le MFA" dans `apps/web/admin`), auquel cas un écran de blocage (présent sur les 3 apps) retient l'utilisateur jusqu'à configuration effective.
- ✅ **Branding, module Aide & module À propos — fonctionnel** : logo officiel **IXORIS** (monogramme "anneau ouvert + flèche" validé avec l'éditeur), composant [`IxorisLogo`](packages/ui/src/IxorisLogo.tsx) partagé et intégré à la navigation d'`apps/web`, aux écrans de connexion d'`apps/pos`/`apps/delivery`, aux bulletins de paie PDF (`packages/payroll-engine`, dessiné en vecteur natif PDFKit — aucune image rasterisée) et aux tickets de caisse thermiques (`packages/escpos`, bitmap monochrome généré depuis la même géométrie, commande ESC/POS `GS v 0`). Nouvelle page `apps/web/a-propos` : crédits éditeur (Kader Salim / KADERSYS SOFTWARE SYSTEMS), fiche technique, et **statut des services en direct** (API + base de données via un nouvel endpoint public `GET /health` côté `apps/api`, WebSocket, moteur hors-ligne détecté côté navigateur). Nouvelle page `apps/web/aide` : centre d'aide avec recherche et filtre par domaine (Caisse, Stock, Comptabilité, RH/Paie, Logistique) sur des guides condensés à partir de [GUIDE_UTILISATEUR_COMPLET.md](GUIDE_UTILISATEUR_COMPLET.md), plus le tableau de dépannage intégré.
- ✅ **Audit de sécurité & durcissement — fonctionnel** : voir [Sécurité & durcissement](#sécurité--durcissement) ci-dessus et [RAPPORT_SECURITE_ET_REMEDS.md](RAPPORT_SECURITE_ET_REMEDS.md) pour le détail complet (JWT à secret obligatoire, rate-limiting login/MFA, WebSocket POS authentifié, permission dédiée pour l'override de prix en caisse, isolation chauffeur sur les livraisons, révocation de session en cascade, validation stricte des entrées).
- ✅ **Agent IA Local (Offline AI) — architecture hybride fonctionnelle** : voir [Agent IA Local](#agent-ia-local-offline-ai) ci-dessus — [`packages/local-ai`](packages/local-ai) fournit un assistant support **génératif** (LLM local via Ollama, avec repli automatique sur un RAG extractif si aucun serveur LLM n'est détecté) intégré à l'onglet Aide avec badge de statut en direct, une détection d'anomalies de stock et un assistant de suggestion d'écritures comptables — le tout 100 % local, sans appel réseau externe ni clé API. La passerelle d'inférence (`packages/local-ai/src/llm-provider.ts`) a été vérifiée contre un faux serveur Ollama (voir Limites connues) faute de pouvoir installer un vrai modèle dans cet environnement de développement sans accès réseau ; le chemin de repli RAG, lui, a été testé en conditions réelles.
- ⏳ **À construire** : écrans d'administration fine des rôles/permissions (au-delà de la gestion des utilisateurs déjà présente), retro-conversion i18n complète du reste de l'UI POS.

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
- Le QR code d'activation MFA (`apps/web/profil`) charge la lib `qrcode` depuis un CDN au runtime navigateur — nécessite que le navigateur de l'utilisateur final ait accès à internet (repli "saisie manuelle du secret" toujours disponible sinon), même caveat que la carte Leaflet du module logistique.
- Un code TOTP n'est pas protégé contre la réutilisation immédiate dans sa fenêtre de 30s (contrairement aux codes de secours, à usage unique) — simplification courante pour ce type d'implémentation, à durcir (verrou anti-rejeu par utilisateur) avant un usage à haute exigence de sécurité.
- La configuration du MFA (scan du QR, activation/désactivation) n'existe que sur `apps/web` — un utilisateur de `apps/pos`/`apps/delivery` dont le MFA est rendu obligatoire doit se connecter une fois au back-office pour le configurer ; ces deux apps n'affichent qu'un écran de blocage renvoyant vers le back-office.
- Le logo IXORIS imprimé sur les tickets thermiques (`packages/escpos`) utilise la commande raster ESC/POS `GS v 0`, générée et vérifiée par simulation logicielle (aperçu bitmap) — elle n'a pas pu être testée sur une imprimante thermique physique dans cet environnement ; à valider sur le matériel cible avant une mise en production (`showLogo: false` permet de le désactiver ticket par ticket en attendant).
- Il n'existe pas encore de génération de facture PDF dédiée (contrairement au bulletin de paie) — le module Comptabilité gère les factures comme des données consultables/imprimables depuis le navigateur, pas comme un export PDF avec en-tête et logo ; à ajouter si un PDF de facture "officiel" est requis.
- La mention légale de la page À propos utilise volontairement la formulation "aligné sur le plan comptable SYSCOHADA Révisé" plutôt que "certifié conforme" — le moteur comptable est correct et testé (voir plus haut), mais aucune certification tierce n'a été obtenue ; à ajuster si une telle certification est un jour réalisée.
- Le limiteur de débit sur `/auth/login`/`/auth/mfa/verify` est en mémoire de processus — protège une instance unique ; un déploiement multi-instance devrait migrer ce compteur vers Redis (même remarque que la salle WebSocket du POS).
- `PermissionsGuard` laisse passer toute route authentifiée sans `@RequirePermissions(...)` explicite (voir [RAPPORT_SECURITE_ET_REMEDS.md](RAPPORT_SECURITE_ET_REMEDS.md) §1.9) — aucune route sensible n'en dépend aujourd'hui, mais c'est un point de vigilance pour tout nouveau contrôleur.
- La file hors-ligne du POS n'a pas de clé d'idempotence — un rejeu concurrent (ex. deux événements `online` successifs) peut, en théorie, dupliquer un ajout d'article (voir rapport §2.2).
- `apps/delivery` n'a pas de file hors-ligne (contrairement à `apps/pos`) — une perte de connexion pendant une mise à jour de statut ou une preuve de livraison fait échouer l'action plutôt que de la mettre en attente (voir rapport §2.3).
- La passerelle LLM local (`packages/local-ai/src/llm-provider.ts`, protocole Ollama) a été implémentée et vérifiée contre un faux serveur HTTP imitant les routes `/api/tags`/`/api/generate` d'Ollama — cet environnement de développement n'a pas d'accès réseau pour installer un vrai serveur Ollama ni télécharger un modèle. Le contrat d'API suivi est celui documenté officiellement par Ollama ; à confirmer avec une instance réelle avant mise en production. Le chemin de repli RAG (quand aucun LLM n'est détecté), lui, a été testé en conditions réelles dans le navigateur.
- Le détecteur de serveur LLM (`getLlmStatus`) met en cache le résultat 30 secondes — démarrer ou arrêter `ollama serve` pendant qu'un utilisateur a l'onglet Aide déjà ouvert peut donc prendre jusqu'à 30 secondes avant que le badge de statut ne se mette à jour.
- La génération LLM est en mode requête/réponse unique (`stream: false`), pas en flux — une réponse volumineuse sur un modèle lent s'affiche d'un bloc à la fin plutôt que mot par mot ; suffisant pour des réponses courtes (3-6 phrases imposées par le prompt système) mais une future évolution chat plus longue gagnerait à passer en streaming (SSE).

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
