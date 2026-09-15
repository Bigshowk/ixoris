# Rapport de sécurité et remédiations — IXORIS ERP

Audit d'architecture et de sécurité mené sur l'ensemble du monorepo (`apps/web`, `apps/api`, `apps/pos`, `apps/delivery`, `packages/*`) avant mise sur le marché. Ce document consigne la méthodologie, les constats (confirmés par lecture directe du code, avec fichier:ligne), les correctifs appliqués, et les recommandations qui restent à traiter.

**Méthodologie** : trois audits indépendants, chacun en lecture seule avant toute correction :
1. Authentification, gestion de session/token, et contrôle d'accès RBAC.
2. Sécurité de la synchronisation hors-ligne (POS et Livreur).
3. Injection SQL/XSS et assainissement des entrées utilisateur.

Chaque constat est classé **CRITIQUE** (exploitable en l'état), **MODÉRÉ** (faille de défense en profondeur, pas directement exploitable dans le code actuel) ou **FAIBLE** (durcissement recommandé). Le statut **✅ Corrigé** indique un correctif appliqué et vérifié par relecture (compilation TypeScript propre sur les modules concernés) dans le cadre de cette mission ; **📋 Documenté** indique un constat volontairement non corrigé dans cette passe, avec la justification et la recommandation.

---

## 1. Authentification & Contrôle d'accès

### 1.1 Secret JWT à valeur de repli codée en dur — ✅ Corrigé (CRITIQUE)

**Constat** : `apps/api/src/modules/auth/auth.module.ts` utilisait `process.env.JWT_SECRET ?? "dev-secret-change-me"`. Toute instance déployée sans définir `JWT_SECRET` signait/vérifiait silencieusement les jetons avec cette chaîne visible dans le code source — contournement total de l'authentification (forger un jeton pour n'importe quel utilisateur/société).

**Correctif** : l'API refuse désormais de démarrer (`throw` explicite au chargement du module) si `JWT_SECRET` est absent ou encore égal au placeholder `"change-me"`. Message d'erreur explicite avec la commande pour générer un vrai secret. `.env` local régénéré avec une valeur aléatoire de 32 octets ; `.env.example` documente l'obligation. Algorithme de signature/vérification explicitement épinglé à `HS256` (défense en profondeur contre une éventuelle confusion d'algorithme).

**⚠️ Action de déploiement requise** : toute instance existante doit définir `JWT_SECRET` avant la prochaine mise à jour, sous peine de refus de démarrage de l'API (comportement voulu).

### 1.2 Absence de limitation de débit sur `/auth/login` et `/auth/mfa/verify` — ✅ Corrigé (CRITIQUE)

**Constat** : aucune dépendance de rate-limiting (`@nestjs/throttler` ou équivalent) n'était installée, et aucun compteur de tentatives n'existait sur la connexion ni sur la vérification MFA — attaque par dictionnaire/credential-stuffing et brute-force TOTP (jusqu'à 1 000 000 de codes) possibles sans limite.

**Correctif** : `apps/api/src/modules/auth/guards/auth-rate-limit.guard.ts` — un limiteur en mémoire (fenêtre glissante, 10 tentatives / 15 min, clé = route + IP + identifiant ciblé) appliqué sur `POST /auth/login` et `POST /auth/mfa/verify`. Implémentation maison sans dépendance externe (cohérent avec la contrainte d'absence d'accès réseau de cet environnement). **Limite connue** : stockage en mémoire du processus — une instance unique seulement ; un déploiement multi-instance devrait migrer ce compteur vers Redis, comme déjà noté pour la salle WebSocket du POS.

### 1.3 Espace de canal temps réel `/pos` non authentifié — ✅ Corrigé (CRITIQUE)

**Constat** : `apps/api/src/modules/realtime/pos.gateway.ts` n'exigeait aucune authentification à la connexion Socket.IO. N'importe quel client (sans compte) pouvait ouvrir une connexion, rejoindre la salle de n'importe quel magasin — y compris d'une **autre société** — en devinant/énumérant son `storeId`, et recevoir en direct le contenu des paniers et le détail des ventes.

**Correctif** : la connexion exige désormais le même jeton d'accès JWT que l'API REST (`io(url, { auth: { token } })`), vérifié à la connexion (`handleConnection`) ; une connexion sans jeton valide est immédiatement fermée. Le passage dans la salle d'un magasin (`join:store`) vérifie en plus que ce magasin appartient bien à la société de l'appelant (isolation multi-tenant). Client mis à jour (`apps/pos/src/hooks/usePosSocket.ts`) pour transmettre le jeton d'accès.

### 1.4 Prix et remise non validés côté serveur sur l'ajout d'article au panier — ✅ Corrigé (CRITIQUE)

**Constat** : `addCartItemInputSchema` acceptait un `unitPriceOverride` client sans contrôle d'autorisation particulier (seule la permission courante `pos.cart.manage`, accordée à tout caissier, était exigée), et `discount` n'était jamais plafonné au total de la ligne — un caissier (ou une mutation hors-ligne modifiée via les DevTools, cf. §2) pouvait fixer un prix arbitraire ou une remise supérieure au total, faisant potentiellement passer une vente à zéro ou en négatif.

**Correctif** :
- Nouvelle permission `pos.price.override` (`packages/rbac`), **non accordée au rôle Caissier par défaut** — seul Administrateur Général l'a par défaut ; à assigner explicitement via un rôle personnalisé si une équipe a besoin de cette capacité.
- `unitPriceOverride` exige désormais cette permission (`CartsService.assertCanOverridePrice`), vérifiée à chaque appel.
- Toute remise (`addItem` et `updateItem`) est plafonnée au total de la ligne (`quantité × prix unitaire`), quelle que soit la permission — invariant serveur, pas seulement une validation d'interface.
- Correctif connexe découvert pendant la remédiation : `updateItem`/`removeItem` ne vérifiaient pas que l'article ciblé (`itemId`) appartenait bien au panier (`cartId`) demandé — un identifiant d'article d'un **autre panier, voire d'une autre société**, pouvait être modifié/supprimé directement. Corrigé en vérifiant l'appartenance avant toute mutation.

**⚠️ Action de déploiement requise** : `pnpm db:seed` (idempotent) doit être relancé pour peupler la nouvelle permission `pos.price.override` dans les bases déjà provisionnées.

### 1.5 Absence de vérification d'appartenance chauffeur sur les livraisons — ✅ Corrigé (CRITIQUE)

**Constat** : `GET /logistics/deliveries/:id`, `PATCH .../status` et `POST .../proof-of-delivery` ne vérifiaient que l'appartenance à la société (`companyId`), pas l'appartenance de la livraison au chauffeur connecté. N'importe quel compte titulaire de `logistics.delivery.drive` (tous les livreurs de la société) pouvait ainsi lire les coordonnées d'un client sur une livraison d'un collègue, changer son statut, forger une position GPS, ou marquer une livraison d'autrui comme « Livrée » ou « Échec » — avec déclenchement des écritures comptables associées.

**Correctif** : `DeliveriesService.assertCanAccessDelivery` exige désormais `delivery.driverId === auth.userId`, sauf pour un détenteur de `logistics.delivery.manage` (dispatcher/administrateur, qui doit conserver un accès large). Appliqué sur la lecture, la mise à jour de statut et la preuve de livraison.

### 1.6 Absence de détection de réutilisation de refresh token — ✅ Corrigé (MODÉRÉ)

**Constat** : un refresh token déjà consommé (donc révoqué lors de la rotation) qui était rejoué échouait individuellement, mais ne déclenchait aucune révocation du reste de la chaîne de sessions de l'utilisateur — signal classique de vol de jeton ignoré, sans réponse à incident.

**Correctif** : `AuthService.refresh` révoque désormais **tous** les refresh tokens actifs de l'utilisateur dès qu'un jeton déjà révoqué est représenté, forçant une reconnexion de toutes les sessions concernées plutôt que de laisser un jeton volé potentiellement actif.

### 1.7 Le changement de mot de passe ne révoque pas les sessions existantes — ✅ Corrigé (MODÉRÉ)

**Constat** : `changePassword` ne révoquait aucun refresh token existant — un jeton volé avant le changement de mot de passe restait valide après que l'utilisateur ait « sécurisé » son compte.

**Correctif** : tous les refresh tokens actifs de l'utilisateur sont révoqués lors d'un changement de mot de passe réussi.

### 1.8 Coût bcrypt relevé de 10 à 12 — ✅ Corrigé (FAIBLE)

Facteur de coût bcrypt utilisé à la création d'utilisateur (`admin/users.service.ts`) et au changement de mot de passe (`auth.service.ts`) relevé de 10 à 12, recommandation courante pour le matériel actuel.

### 1.9 `PermissionsGuard` « ouvert par défaut » pour l'autorisation — 📋 Documenté (MODÉRÉ)

**Constat** : `PermissionsGuard` laisse passer toute route ne portant pas `@RequirePermissions(...)` (et non marquée `@Public()`) dès lors que l'appelant est authentifié — c'est-à-dire que l'**authentification** est fermée par défaut (`JwtAuthGuard`, garde globale), mais l'**autorisation** ne l'est pas structurellement : une route future ajoutée sans décorateur serait accessible à tout utilisateur connecté, quel que soit son rôle.

**Constat actuel** : audit exhaustif des contrôleurs sensibles (`accounting`, `payroll`, `admin`, `hr`) — toutes les routes examinées portent un décorateur de permission adapté ; seules des routes intentionnellement en libre-service (`/auth/me`, `/auth/preferences`, `/auth/password`, `/auth/mfa/*`) exploitent ce comportement, sans risque avéré aujourd'hui.

**Recommandation non appliquée dans cette passe** (changement structurel plus large, hors du périmètre de correctifs ciblés) : inverser le comportement par défaut du guard (refuser si aucun décorateur n'est présent) et introduire un décorateur explicite `@SelfService()` pour les routes volontairement ouvertes à tout utilisateur connecté — rendrait l'oubli d'un décorateur sur une future route sensible sûr par construction plutôt que dépendant de la discipline de code.

### 1.10 Isolation multi-tenant au niveau de la requête, pas seulement de la logique applicative — 📋 Documenté (MODÉRÉ)

**Constat** : plusieurs appels `update`/`delete` (`invoices.service.ts`, `payroll-runs.service.ts`, `hr/employees.service.ts`, `hr/leave-requests.service.ts`, `bank-statements.service.ts`) ne portent le filtre `companyId` que dans une vérification préalable (`findFirst`), pas dans la clause `where` de la mutation elle-même — sûr aujourd'hui car chaque chemin de code vérifie bien l'appartenance avant de muter, mais fragile face à un futur refactor qui court-circuiterait cette vérification.

**Correctif appliqué au cas le plus sensible** : `admin/users.service.ts` (`setActive`, `setMfaRequired`) réécrit avec `updateMany({ where: { id, companyId } })`, qui applique le filtre `companyId` **au niveau de la requête** plutôt que via une vérification préalable — empêchant structurellement toute régression future sur ce point précis (prise de contrôle de compte).

**Reste à traiter** (non appliqué dans cette passe, périmètre trop large pour un correctif ciblé sans risque) : généraliser ce même motif (`updateMany`/filtre composé) aux autres fichiers listés ci-dessus.

### 1.11 Origine CORS par défaut trop permissive — ✅ Corrigé (FAIBLE)

`apps/api/src/main.ts` et `pos.gateway.ts` retombaient sur `"*"` si `CORS_ORIGIN` n'était pas défini. Nouveau module partagé `apps/api/src/common/cors-origin.ts` : repli sur les trois origines de développement local explicites plutôt qu'un joker — `CORS_ORIGIN` reste obligatoire à définir explicitement pour tout déploiement non local (`.env.example`).

---

## 2. Sécurité de la synchronisation hors-ligne (POS & Livreur)

### 2.1 Aucune protection contre la falsification de la file IndexedDB — 📋 Documenté (CRITIQUE, mitigation partielle appliquée en §1.4)

**Constat** : `packages/sync-client` stocke les mutations en attente en clair dans IndexedDB, sans signature ni somme de contrôle — un utilisateur ayant accès aux DevTools du poste de caisse peut éditer directement une mutation en attente (identifiant produit, quantité, remise, `unitPriceOverride`) avant qu'elle ne soit rejouée et acceptée par le serveur.

**Analyse** : signer cryptographiquement chaque mutation côté navigateur nécessiterait un secret partagé accessible au JavaScript client — donc lui-même extractible par un attaquant ayant accès au poste, ce qui n'apporterait pas de garantie réelle. La défense correcte est **côté serveur** : ne jamais faire confiance à une valeur transmise par le client sans la revalider. C'est exactement ce que corrige le §1.4 (permission dédiée pour `unitPriceOverride`, plafond serveur sur la remise) — la fenêtre d'exploitation résiduelle (un caissier sans la permission `pos.price.override` ne peut plus, même en éditant la file IndexedDB, faire accepter un prix arbitraire) est désormais fermée pour le cas le plus dommageable. La quantité reste modifiable dans la file sans plafond dédié — impact limité à une survente/sous-stock détectable a posteriori, à surveiller via le futur assistant de détection d'anomalies de stock (voir README, section Agent IA Local).

### 2.2 Absence de clé d'idempotence sur les mutations rejouées — 📋 Documenté (MODÉRÉ)

**Constat** : aucune clé d'idempotence n'accompagne une mutation en file ; deux exécutions concurrentes de `flush()` (par exemple deux événements `online` successifs) peuvent rejouer deux fois le même ajout d'article, doublant la quantité en panier et la décrémentation de stock réelle au checkout.

**Recommandation non appliquée dans cette passe** : ajouter un identifiant idempotent généré côté client à chaque mutation mise en file, et une contrainte d'unicité côté serveur (ou une déduplication applicative) sur cet identifiant avant application — changement qui touche à la fois `packages/sync-client`, le hook `useOfflineSync`, et l'endpoint `POST /pos/carts/:id/items`, jugé trop large pour un correctif ciblé sans tests de non-régression dédiés au flux hors-ligne.

### 2.3 `apps/delivery` ne dispose d'aucune file hors-ligne — 📋 Documenté (MODÉRÉ)

**Constat** : contrairement à `apps/pos`, l'application livreur n'utilise pas `packages/sync-client` — toute perte de connexion pendant une mise à jour de statut, une preuve de livraison ou un point GPS fait simplement échouer l'action (message d'erreur générique), sans mise en file pour rejeu ultérieur. Ceci contredit le positionnement « offline-first » affiché pour cette application.

**Recommandation** : étendre `packages/sync-client` à `apps/delivery`, suivant le même patron que `apps/pos` — non implémenté ici (fonctionnalité nouvelle plutôt que correctif de sécurité, hors périmètre de durcissement ciblé), mais à prioriser avant une utilisation terrain en zone de couverture réseau incertaine.

### 2.4 Jetons d'accès et de rafraîchissement en `localStorage` — 📋 Documenté (MODÉRÉ, déjà connu)

Confirmé sur les 3 apps frontend, déjà signalé dans le README (limites connues) : une XSS donnerait accès à un jeton de rafraîchissement valide jusqu'à 30 jours. Cf. §1.6/1.7 pour la mitigation partielle (révocation de session sur changement de mot de passe / détection de réutilisation).

---

## 3. Protection des données & assainissement

Cet audit n'a révélé **aucun résultat CRITIQUE**. Résumé :

- **Injection SQL** : recherche exhaustive de `$queryRaw`/`$executeRaw`/`$queryRawUnsafe`/`$executeRawUnsafe` sur tout le monorepo — une seule occurrence (`health.controller.ts`, `SELECT 1` statique, sans interpolation). Toutes les autres requêtes passent par le query builder typé de Prisma, qui paramètre automatiquement. **Aucune surface d'injection SQL identifiée.**
- **XSS** : les seules utilisations de `dangerouslySetInnerHTML` sont des scripts d'amorçage de thème/service worker, statiques, sans donnée utilisateur. Tout champ libre utilisateur (notes CRM, motif d'échec de livraison, commentaires d'approbation) passe par un nœud texte JSX, échappé par défaut par React. **Aucun contournement identifié.**
- **Mass assignment** : la création/mise à jour d'utilisateur construit l'objet Prisma champ par champ (pas de `...dto`) — `companyId`, `id`, `mfaEnabled` ne peuvent pas être injectés depuis le corps de la requête.
- **Correctifs appliqués** : `ValidationPipe` gagne `forbidNonWhitelisted: true` (une requête portant des champs inattendus est désormais rejetée avec un 400 plutôt que silencieusement nettoyée — signal exploitable pour la détection d'intrusion) ; une limite explicite de taille de corps de requête (2 Mo) est posée dans `main.ts` ; le champ `csv` de l'import de relevé bancaire gagne un `@MaxLength()`.
- **Recommandation non appliquée** (FAIBLE, pas de chemin d'export identifié aujourd'hui) : échapper les valeurs commençant par `=`, `+`, `-`, `@` dans les libellés de relevé bancaire avant tout futur export CSV/Excel, contre l'injection de formule.

---

## 4. Récapitulatif

| # | Constat | Sévérité | Statut |
|---|---|---|---|
| 1.1 | Secret JWT par défaut codé en dur | CRITIQUE | ✅ Corrigé |
| 1.2 | Aucune limitation de débit login/MFA | CRITIQUE | ✅ Corrigé |
| 1.3 | Canal WebSocket `/pos` non authentifié | CRITIQUE | ✅ Corrigé |
| 1.4 | Prix/remise panier non validés serveur + IDOR article de panier | CRITIQUE | ✅ Corrigé |
| 1.5 | Aucune vérification chauffeur sur les livraisons | CRITIQUE | ✅ Corrigé |
| 2.1 | File IndexedDB falsifiable | CRITIQUE | 📋 Documenté (mitigation via 1.4) |
| 1.6 | Pas de détection de réutilisation refresh token | MODÉRÉ | ✅ Corrigé |
| 1.7 | Changement mot de passe ne révoque pas les sessions | MODÉRÉ | ✅ Corrigé |
| 1.9 | `PermissionsGuard` ouvert par défaut | MODÉRÉ | 📋 Documenté |
| 1.10 | `companyId` hors clause `where` sur certaines mutations | MODÉRÉ | ✅ Corrigé (cas le plus sensible) / 📋 reste |
| 2.2 | Pas de clé d'idempotence sur rejeu hors-ligne | MODÉRÉ | 📋 Documenté |
| 2.3 | `apps/delivery` sans file hors-ligne | MODÉRÉ | 📋 Documenté |
| 2.4 | Jetons en `localStorage` | MODÉRÉ | 📋 Documenté (connu) |
| Validation | `forbidNonWhitelisted`, limite de taille, `@MaxLength` CSV | MODÉRÉ | ✅ Corrigé |
| 1.8 | Coût bcrypt 10 → 12 | FAIBLE | ✅ Corrigé |
| 1.11 | CORS par défaut `"*"` | FAIBLE | ✅ Corrigé |
| §3 | Injection CSV (formule Excel) sur libellé relevé bancaire | FAIBLE | 📋 Documenté (pas de chemin d'export actuel) |

---

## 5. Actions de déploiement requises suite à ce correctif

1. **Définir `JWT_SECRET`** dans chaque environnement déployé avant mise à jour — l'API refuse désormais de démarrer avec la valeur placeholder ou absente. Générer avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. **Relancer `pnpm db:seed`** (idempotent, sans risque sur les données existantes) pour peupler la nouvelle permission `pos.price.override`.
3. **Définir `CORS_ORIGIN`** explicitement dans tout environnement non local (déjà documenté dans `.env.example`, désormais aussi appliqué à la garde WebSocket).
4. Revoir les rôles personnalisés existants : si des caissiers avaient besoin de modifier un prix en caisse, leur assigner explicitement `pos.price.override` via **Administration → Rôles**.

---

*Rapport établi dans le cadre de la mission d'audit de sécurité et de durcissement du code — IXORIS ERP, KADERSYS SOFTWARE SYSTEMS.*
