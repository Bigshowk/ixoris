# Guide utilisateur complet — IXORIS ERP

Ce guide couvre l'installation, la prise en main par rôle et le dépannage des trois applications de l'ERP IXORIS :

| Application | Usage | URL par défaut |
|---|---|---|
| **Back-office** (`apps/web`) | Administration, comptabilité, RH/paie, CRM, stock, achats, logistique, trésorerie, crédit, actifs, GED | `http://localhost:3000` |
| **Caisse** (`apps/pos`) | Vente en magasin, encaissement | `http://localhost:3001` |
| **Livreur** (`apps/delivery`) | Tournées de livraison, preuve de livraison | `http://localhost:3002` |
| **API** (`apps/api`) | Backend commun aux 3 applications (invisible pour l'utilisateur final) | `http://localhost:4000` |

Pour l'installation technique détaillée (Docker, variables d'environnement, dépannage développeur), voir le [README.md](README.md) à la racine du dépôt — ce guide-ci se concentre sur l'**utilisation** du logiciel une fois installé.

---

## A. Prérequis techniques & installation rapide

### Matériel requis

| Poste | Minimum recommandé |
|---|---|
| **PC back-office / comptabilité** | 4 Go RAM, processeur double cœur récent, écran ≥ 1366×768, navigateur à jour |
| **Poste de caisse (tablette ou PC)** | 2 Go RAM, écran tactile ou clavier/souris, webcam pour le scan caméra (optionnelle si douchette physique) |
| **Smartphone livreur** | Android 9+ ou iOS 14+, GPS activé, connexion data (3G/4G) ou Wi-Fi |
| **Douchette code-barres** | USB (reconnue comme clavier HID — plug-and-play, aucun pilote requis) ou Bluetooth HID |
| **Imprimante ticket** | Thermique ESC/POS 58mm ou 80mm, connexion USB (WebUSB) ou réseau (Ethernet/Wi-Fi, port 9100) |

Aucune imprimante ou douchette n'est strictement obligatoire pour démarrer : le scan caméra et le téléchargement du ticket en PDF (à ajouter selon besoin) permettent de fonctionner en mode dégradé.

### Prérequis logiciels (serveur)

| Outil | Version | Rôle |
|---|---|---|
| Node.js | ≥ 20.0.0 | Runtime des 4 applications |
| pnpm | 9.x | Gestionnaire de paquets du monorepo |
| PostgreSQL | 16 | Base de données |
| Redis | 7 | Cache / synchronisation temps réel multi-instance |

### Navigateurs recommandés (postes utilisateurs)

| Navigateur | Statut |
|---|---|
| Google Chrome / Microsoft Edge (Chromium) | ✅ Recommandé — support complet (WebUSB pour l'impression, caméra, notifications) |
| Safari (macOS/iOS) | ✅ Supporté — WebUSB non disponible, utiliser l'impression réseau |
| Firefox | ⚠️ Fonctionnel mais WebUSB non supporté — impression réseau uniquement |

### Procédure de lancement rapide

**En local / démonstration :**
```bash
docker compose -f docker/docker-compose.yml up -d   # Postgres + Redis
cp .env.example .env
pnpm install
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```
Cette dernière commande démarre les 4 applications en parallèle (API + web + pos + delivery).

**En production**, chaque application se construit et se lance séparément :
```bash
pnpm --filter @ixoris/api build   && pnpm --filter @ixoris/api start
pnpm --filter @ixoris/web build   && pnpm --filter @ixoris/web start
pnpm --filter @ixoris/pos build   && pnpm --filter @ixoris/pos start
pnpm --filter @ixoris/delivery build && pnpm --filter @ixoris/delivery start
```
Placer chacune derrière un reverse-proxy HTTPS (Nginx/Caddy) avec un sous-domaine dédié par rôle (ex. `back-office.monentreprise.com`, `caisse.monentreprise.com`, `livreur.monentreprise.com`) est la pratique recommandée pour un déploiement réel — l'ERP tel que livré fonctionne en HTTP local pour le développement.

### URL et ports par défaut

| Rôle | Application | Port local | Identifiant de connexion type |
|---|---|---|---|
| Administrateur / Comptable / RH | Back-office web | `:3000` | Email professionnel |
| Caissier | Caisse POS | `:3001` | Email professionnel |
| Livreur | App livreur | `:3002` | Email professionnel |
| — | API (non accédée directement) | `:4000` | — |

---

## B. Guide pas à pas par rôle & module

### 1. Administrateur Général

**Connexion et sécurité**
1. Ouvrir le back-office (`:3000`), saisir email + mot de passe.
2. Un champ mot de passe dispose d'un bouton œil (afficher/masquer) et, à la création/au changement, d'une **jauge de robustesse en temps réel** (5 niveaux : Très faible → Très fort) avec des indices sur ce qu'il manque (majuscule, chiffre, caractère spécial…).
3. Si un second facteur (MFA) est activé sur le compte, un écran demande un **code à 6 chiffres** après le mot de passe (voir plus bas).

**Configuration de la société**
- Les paramètres de la société (entreprise, magasins, devise) sont initialisés à la mise en place du système (via le seed de démonstration ou une configuration initiale) — leur édition courante se fait via le module **Administration**.

**Gestion des rôles (RBAC)** — menu **Administration → Rôles**
1. "Nouveau rôle" : nommer le rôle, cocher les permissions à accorder (regroupées par module : POS, Stock, Comptabilité, RH, CRM, Admin, Supply Chain, Logistique, Trésorerie, Crédit, Actifs, GED).
2. Sélectionner un rôle existant pour éditer ses permissions (impossible sur les rôles système prédéfinis) et "Enregistrer".
3. Rôles prédéfinis livrés avec le système :

   | Rôle | Portée |
   |---|---|
   | Administrateur Général | Accès complet à tous les modules |
   | Caissier | Vente en caisse, sessions de caisse, impression de tickets |
   | Gestionnaire de Stock | Catalogue produits, dépôts, transferts, mouvements de stock, chaîne d'approvisionnement, dispatch livraisons |
   | Comptable | Écritures, factures, rapports financiers, rapprochement bancaire, trésorerie, crédit, immobilisations, GED |
   | DRH | Employés, contrats, présences, congés, paie |
   | Livreur | Consultation et mise à jour de ses propres livraisons uniquement |

**Gestion des utilisateurs** — menu **Administration → Utilisateurs**
1. "Nouvel utilisateur" : email, mot de passe (avec jauge de robustesse), prénom, nom, téléphone, rôle, magasin (ou "Tous les magasins").
2. "Activer"/"Désactiver" un compte à tout moment (un compte désactivé ne peut plus se connecter).
3. Assigner ou retirer des rôles supplémentaires à un utilisateur existant, avec portée limitée à un magasin si besoin (ex. un Comptable actif uniquement sur le Magasin Principal).

**Activation de la sécurité MFA/TOTP et politique de mots de passe**
1. Chaque utilisateur active son propre MFA depuis **Mon profil → Authentification à deux facteurs → Activer** : un QR code s'affiche pour être scanné avec une application d'authentification (Google Authenticator, Microsoft Authenticator, Authy…), ou le code secret peut être saisi manuellement si le QR ne se charge pas (nécessite un accès internet côté navigateur). La confirmation avec un code à 6 chiffres révèle **10 codes de secours à usage unique** à conserver précieusement (affichés une seule fois).
2. Pour **rendre le MFA obligatoire** sur un compte (ex. tous les comptables et administrateurs), l'administrateur clique sur "Exiger le MFA" dans la fiche de l'utilisateur (Administration → Utilisateurs). Tant que l'utilisateur concerné n'a pas terminé sa configuration, un écran de blocage l'empêche d'accéder à l'application (sur les 3 apps) jusqu'à activation.
3. La politique de robustesse du mot de passe est appliquée visuellement (jauge + indices) sur tous les formulaires de mot de passe — elle n'empêche pas techniquement l'enregistrement d'un mot de passe faible (pas de blocage serveur), c'est un outil de sensibilisation de l'utilisateur au moment de la saisie.

---

### 2. Caissier (module POS)

**Connexion**
- Se connecter sur `:3001` avec son compte Caissier. Si plusieurs magasins sont accessibles, un écran de sélection du magasin apparaît après connexion.

**Ouverture et clôture de caisse (Z de caisse)**
- La session de caisse est ouverte automatiquement à la connexion sur un poste (une `CashSession` est associée au registre).
- La **clôture** se fait via **Trésorerie → Caisses** (accès Comptable/Admin) ou l'action de clôture de session dédiée : elle calcule automatiquement l'écart entre le montant compté et le montant attendu, et le **comptabilise** (débit/crédit automatique) si l'écart est non nul — c'est l'équivalent du "Z de caisse" classique.

**Vente par scan caméra ou douchette HID**
1. Champ "Scanner ou rechercher un article…" en haut de l'écran de caisse.
2. **Douchette USB/Bluetooth** : brancher, scanner un code-barres — l'article est ajouté au panier automatiquement, sans clic (fonctionne en parallèle du champ de recherche).
3. **Scan caméra** : cliquer sur l'icône 📷, autoriser l'accès à la webcam, viser le code-barres.
4. **Recherche manuelle** : taper au moins 2 caractères du nom ou de la référence, cliquer sur le résultat souhaité.
5. Dans le panier : boutons `−`/`+` pour ajuster la quantité, `✕` pour retirer une ligne. Sous-total et total se recalculent en direct.

**Encaissement**
1. Bouton "Encaisser" → moyens de paiement disponibles : **Espèces, Carte, Mobile Money, Virement, Chèque, Vente à crédit (client)**.
2. Paiement fractionné possible : "+ Ajouter un moyen de paiement" pour combiner plusieurs moyens sur une même vente (ex. moitié espèces, moitié Mobile Money).
3. Le "Reste à payer" et la "Monnaie à rendre" se calculent automatiquement. Le bouton "Valider" reste désactivé tant que le montant tendu est insuffisant.

**Mise en attente d'un panier et reprise sur un autre appareil**
1. Un panier commencé sur un poste reste actif tant qu'il n'est pas encaissé ou explicitement abandonné — il n'y a pas d'action "mettre en attente" séparée : il suffit de laisser le panier tel quel.
2. Bouton "🧺 Paniers en cours" (badge = nombre de paniers actifs du magasin, mis à jour en temps réel) ouvre un tiroir listant **tous les paniers actifs du magasin**, y compris ceux démarrés sur un autre poste ou une autre tablette.
3. Cliquer sur un panier dans la liste pour le **reprendre sur le poste actuel** — utile si un client change de caisse, ou si un article a été scanné sur un poste mobile puis l'encaissement finalisé à la caisse principale.
4. Dès qu'un panier est encaissé sur un poste, il **disparaît automatiquement** de la liste des autres postes (mise à jour en temps réel, sans rechargement de page).

**Impression des tickets thermiques**
- Après une vente, un bandeau apparaît en bas de l'écran avec :
  - **"Imprimer (USB)"** si le navigateur supporte WebUSB (Chrome/Edge) et qu'une imprimante ESC/POS est branchée.
  - Un champ **"IP imprimante"** + bouton **"Imprimer (réseau)"** pour une imprimante connectée au réseau local (port 9100 standard).
- Le ticket est formaté automatiquement en ESC/POS (58mm ou 80mm selon l'imprimante), avec le total dans la devise et le format régional configurés.

**Mode hors-ligne (Offline-First)**
- Si la connexion réseau est coupée pendant une vente, l'indicateur "Hors-ligne" s'affiche avec un compteur d'actions "en attente de synchronisation".
- Les actions **d'ajout d'article au panier** continuent de fonctionner hors-ligne (mises en file dans le navigateur). Au retour du réseau, la file se rejoue automatiquement contre le serveur.
- ⚠️ Limite connue : seul l'ajout d'article est optimisé pour l'offline dans cette version ; l'incrément/suppression de ligne et l'encaissement final nécessitent une connexion active.

---

### 3. Gestionnaire de Stock & Achats

**Création de fiches produits** — menu **Stock → Produits**
1. "Nouveau produit" : code SKU, nom, prix d'achat, prix de vente, catégorie, marque, seuil d'alerte de réapprovisionnement.
2. Le **code-barres** est associé à la fiche produit (scan à la création ou saisie manuelle) — c'est ce code qui est reconnu en caisse par la douchette ou la caméra.
3. La quantité en stock (tous dépôts confondus) s'affiche directement dans le tableau, avec une **alerte visuelle rouge** si elle passe sous le seuil configuré.

**Bons de commande fournisseurs (PO) et réceptions (GRN)** — menu **Achats**
1. **Cotations** (`Achats → Cotations`) : enregistrer les prix proposés par chaque fournisseur pour un produit donné (prix unitaire, délai, validité) — sert de base de comparaison.
2. **Commandes** (`Achats → Commandes`) : créer un bon de commande (fournisseur, dépôt de réception, date attendue, lignes produit/quantité), puis "Envoyer" pour le faire passer de Brouillon à Envoyé.
3. **Réceptions** (`Achats → Réceptions`) : sélectionner une commande envoyée, saisir les quantités réellement reçues, endommagées et le lot/date d'expiration le cas échéant, "Créer la réception" puis "Valider". La validation met à jour le stock et **comptabilise automatiquement** l'écriture fournisseur (les marchandises manquantes ne sont pas dues, les endommagées partent en perte).

**Alertes de stock critique et réapprovisionnement automatique** — menu **Achats → Réapprovisionnement**
1. Bouton "Lancer le contrôle" : le système scanne tous les produits sous leur seuil d'alerte.
2. Pour chaque produit sous seuil disposant d'une cotation fournisseur active, un **bon de commande brouillon est généré automatiquement** (choix automatique du fournisseur le moins cher), groupé par fournisseur et dépôt.
3. Pour un produit sous seuil **sans cotation disponible**, une notification est créée à la place (visible via la cloche 🔔) plutôt qu'une commande incomplète.
4. ⚠️ Cette vérification n'est pas encore planifiée automatiquement (pas de tâche récurrente) — elle doit être lancée manuellement depuis cet écran à intervalle régulier.

---

### 4. Comptable (norme SYSCOHADA)

**Consultation des rapports** — menu **Comptabilité → Rapports**
1. Sélectionner l'exercice fiscal concerné.
2. Basculer entre trois vues :
   - **Balance générale** : soldes débit/crédit de tous les comptes du plan comptable.
   - **Compte de résultat (SIG)** : cascade complète des Soldes Intermédiaires de Gestion — Marge commerciale → Valeur Ajoutée → EBE → Résultat d'Exploitation → Résultat Financier → RAO → Résultat HAO → **Résultat Net**.
   - **Bilan** : Actif (immobilisé/circulant/trésorerie) vs Ressources durables/Passif circulant/Trésorerie-passif, avec vérification d'équilibre automatique.
3. Le **Grand Livre** (détail des mouvements par compte) est accessible depuis les écritures du journal concerné.

**Saisie et gestion des écritures** — menu **Comptabilité → Écritures**
1. Choisir le journal (VE Ventes, AC Achats, BQ Banque, CA Caisse, OD Opérations diverses, PA Paie), la date, le libellé.
2. Ajouter les lignes débit/crédit ("Ajouter une ligne") — l'écriture ne peut être enregistrée que si le total débit égale le total crédit (contrôle bloquant).
3. Les ventes POS, factures validées et cycles de paie **génèrent automatiquement** leurs écritures — la saisie manuelle sert aux opérations diverses et corrections.

**Rapprochement bancaire et lettrage** — menu **Comptabilité → Banque**
1. Créer un compte bancaire (banque, numéro de compte, compte comptable associé).
2. Importer un relevé au format CSV `date;libellé;montant` (montant positif = crédit, négatif = débit).
3. "Rapprochement automatique" : le système apparie chaque ligne du relevé à l'écriture comptable du même montant sur le compte bancaire (fenêtre de ±5 jours). Les lignes non appariées (ex. frais bancaires) restent visibles pour un traitement manuel.
4. Le **lettrage** (rapprochement facture ↔ paiement) se fait par correspondance exacte de montant — les paiements partiels ou répartis sur plusieurs factures doivent être lettrés manuellement.

**Gestion des amortissements (classe 2 OHADA)** — menu **Actifs**
1. "Nouvelle immobilisation" : compte d'actif et d'amortissement (classe 2/28), date et coût d'acquisition, valeur résiduelle, durée de vie, méthode (**Linéaire** ou **Dégressif** avec bascule automatique vers le linéaire en fin de vie).
2. Le plan d'amortissement complet est généré immédiatement à la création (visible dans la fiche de l'actif).
3. "Lancer les dotations" : comptabilise (débit 681 / crédit compte d'amortissement classe 28) toutes les dotations dues à la date du jour, sur l'ensemble des actifs — action à déclencher manuellement (pas de tâche planifiée).
4. Une immobilisation en service peut être **cédée** (montant de cession saisi), ce qui clôture son plan d'amortissement.

⚠️ **Réserve importante** : le mécanisme de calcul (tranches, plafonds, cascades SIG, équilibre du bilan) est correct et testé, mais les **taux CNPS/ITS par défaut sont illustratifs** — à faire valider par un expert-comptable ou la DGI avant tout usage réel en paie.

---

### 5. Responsable RH / Paie

**Saisie des employés** — menu **RH → Employés**
1. "Nouvel employé" : matricule, prénom, nom, date d'embauche, salaire de base, département, poste.
2. Ajout rapide de départements et de postes depuis le même écran si besoin.
3. La **sortie** d'un employé (bouton dédié sur la fiche) clôture automatiquement son contrat en cours.
4. Historique des contrats consultable (CDI/CDD/Stage/Consultant), avec création/fin de contrat.

**Présences et congés** — menu **RH → Congés & présences**
1. Configurer les types de congés (nom, payé ou non payé).
2. Enregistrer une présence (employé, date, statut Présent/Absent/Retard/Demi-journée) ou pointer via check-in/check-out.
3. Soumettre une demande de congé (employé, type, dates) — un titulaire du rôle habilité doit "Approuver" ou "Rejeter" la demande.
4. **Lien automatique RH → Paie** : un employé ayant pris des jours de congé sans solde approuvés (ou des absences non justifiées) voit son salaire de base **proratisé automatiquement** au calcul du bulletin suivant, au prorata des jours ouvrés du mois.

**Calcul des cotisations et génération des bulletins** — menu **Paie**
1. Sélectionner la période, "Lancer le cycle" : calcule un bulletin par employé actif à partir des composantes de salaire configurées (primes, cotisations salariales/patronales via un barème de tranches progressives).
2. Chaque bulletin est consultable ligne par ligne (brut → retenues → net) et **téléchargeable en PDF**.
3. "Valider le cycle" : comptabilise automatiquement la paie en une écriture consolidée (débit 661/664, crédit 422/431/447 selon la composante).

**Génération des ordres de virement**
1. Une fois le cycle validé, choisir le compte bancaire de paiement.
2. "Générer le virement groupé" : produit le lot de virement pour l'ensemble des employés payés par virement.
3. "Télécharger le CSV" du lot pour l'importer dans le portail de la banque.

---

### 6. Livreur & Responsable Logistique

**Côté Livreur (`apps/delivery`, `:3002`)**

1. **Connexion** et consultation de "Mes livraisons" : liste des livraisons qui lui sont assignées et non terminées (statut, adresse, client).
2. **Transitions de statut** disponibles sur une fiche livraison, selon l'état courant :

   | Statut actuel | Action disponible | Statut suivant |
   |---|---|---|
   | En attente (PENDING) | "Marquer chargé" | Chargé (LOADED) |
   | Chargé (LOADED) | "Démarrer la livraison" | En transit (IN_TRANSIT) |
   | En transit (IN_TRANSIT) | Capture de preuve de livraison | Livré (DELIVERED) |
   | En transit (IN_TRANSIT) | "Marquer en échec" (motif obligatoire) | Échec (FAILED) |

3. Chaque changement de statut capture automatiquement la **position GPS** du téléphone au moment de l'action (best-effort — n'empêche jamais l'action si le GPS est refusé ou indisponible).
4. **Preuve de livraison (PoD)**, disponible uniquement en statut "En transit" :
   - **Signature** : le client signe du doigt sur l'écran (zone tactile dédiée), boutons "Effacer" et "Valider".
   - **Scan QR** : ouvrir la caméra, viser le QR code du colis — la lecture est automatique dès détection.
5. En cas d'échec de livraison, le motif saisi reste visible sur la fiche — aucune autre action n'est possible une fois le statut final atteint (Livré/Échec/Annulé).

**Côté Responsable Logistique (back-office, `apps/web → Livraisons`)**

1. **Livraisons** : créer une livraison (adresse, zone, véhicule, chauffeur, date prévue, poids), l'assigner à un chauffeur et un véhicule disponibles.
2. **Zones** : définir les zones de livraison avec leur tarification (forfait de base + tarif au km + tarif au kg + durée estimée) — le frais de livraison est calculé automatiquement selon la zone au moment de la création.
3. **Véhicules** : enregistrer la flotte (immatriculation, type Moto/Voiture/Camionnette/Camion, capacité en kg).
4. **Suivi en direct** (`Livraisons → Suivi`) : carte affichant la dernière position GPS connue de chaque livraison en cours (Chargé/En transit), rafraîchie automatiquement toutes les 20 secondes. ⚠️ Il s'agit de la **dernière position connue à chaque étape**, pas d'un flux GPS continu — et l'affichage des tuiles de carte nécessite que le navigateur de l'utilisateur ait accès à internet.
5. Les frais de livraison encaissés et les pertes déclarées sur un échec sont **comptabilisés automatiquement**.

---

## C. Guide de dépannage & tableau des erreurs courantes

| Symptôme / Message | Cause probable | Solution pas à pas |
| :--- | :--- | :--- |
| **Panier ou vente qui ne se synchronise pas** (indicateur "Hors-ligne" persistant, compteur "en attente" qui ne redescend pas) | Perte de connexion réseau pendant une vente POS — les actions sont mises en file dans le navigateur (IndexedDB) en attendant le retour du réseau | Vérifier la connexion internet du poste de caisse. Dès que la connexion revient, la file se rejoue automatiquement contre le serveur — patienter quelques secondes. Si le compteur ne bouge pas après 1 minute avec une connexion confirmée, recharger la page (la file est conservée localement, rien n'est perdu). |
| **"Imprimer (USB)" grisé ou absent** | Le navigateur ne supporte pas WebUSB (Firefox, Safari), ou aucune imprimante ESC/POS n'est branchée/autorisée | Utiliser Chrome ou Edge pour l'impression USB. Sinon, utiliser le champ "IP imprimante" + "Imprimer (réseau)" avec une imprimante connectée au réseau local (port 9100). Vérifier que l'imprimante est bien sous tension et sur le même réseau que le poste. |
| **Code MFA refusé ("Code invalide ou expiré")** | Le code TOTP saisi ne correspond pas — le plus souvent une horloge du téléphone désynchronisée, ou un code déjà expiré (validité 30 secondes) | Vérifier que la date/heure du téléphone est réglée automatiquement (pas d'écart manuel). Attendre le prochain code généré par l'application d'authentification plutôt que de réutiliser un ancien code. En dernier recours, utiliser l'un des **codes de secours** fournis à l'activation ("Utiliser un code de secours à la place") — chaque code n'est utilisable qu'une seule fois. |
| **Devise ou taux de change manquant sur une écriture/facture multi-devise** | Aucun `ExchangeRate` n'est configuré pour la devise et la date de la transaction | Renseigner le taux de change applicable dans la configuration des devises (module Comptabilité/Administration) avant de valider la transaction. Par défaut, l'ERP est configuré en devise unique (XOF) ce qui évite ce cas — le multi-devise est une extension du schéma de données. |
| **"Identifiants invalides" alors que le mot de passe est correct** | Ce message générique apparaît pour *toute* erreur de connexion, y compris une indisponibilité temporaire de l'API ou de la base de données — pas seulement un mauvais mot de passe | Réessayer après quelques secondes. Si le problème persiste, contacter l'administrateur système pour vérifier que le serveur API et la base de données sont bien démarrés. |
| **Écran figé ou contenu périmé après une mise à jour de l'application (caisse ou livreur)** | Ces deux applications fonctionnent en PWA avec mise en cache locale (mode hors-ligne) — un ancien cache peut masquer la nouvelle version | Fermer complètement l'application/l'onglet puis le rouvrir. Si le problème persiste, vider le cache du navigateur pour ce site (Réglages → Confidentialité → Effacer les données de navigation, site par site) puis se reconnecter. |
| **Le scan caméra ne détecte pas le code-barres** | Éclairage insuffisant, code-barres endommagé/flou, ou permission caméra refusée par le navigateur | Vérifier que l'autorisation caméra est bien accordée (icône dans la barre d'adresse). Rapprocher le code-barres de la caméra et stabiliser l'appareil. En cas d'échec répété, utiliser la douchette physique ou la recherche manuelle par nom/référence. |
| **Douchette USB/Bluetooth qui ne scanne rien** | La douchette n'est pas reconnue en mode "clavier" (HID), ou le focus n'est pas sur la page de caisse | Vérifier dans la documentation de la douchette qu'elle est configurée en mode "clavier USB" (HID) et non en mode série. Cliquer une fois sur la page de caisse pour s'assurer qu'elle a le focus, puis réessayer le scan. |
| **Écriture comptable refusée ("non équilibrée")** | Le total des lignes au débit ne correspond pas au total au crédit | Vérifier chaque ligne saisie et ajuster les montants jusqu'à obtenir Σdébit = Σcrédit — l'enregistrement reste bloqué tant que l'écriture n'est pas équilibrée, c'est un contrôle volontaire pour garantir l'intégrité comptable. |
| **Notification de stock bas jamais reçue malgré un produit sous seuil** | Le contrôle de réapprovisionnement n'est pas planifié automatiquement dans cette version — il doit être déclenché manuellement | Se rendre dans **Achats → Réapprovisionnement** et cliquer sur "Lancer le contrôle" régulièrement (ou demander à l'administrateur de mettre en place une tâche planifiée externe appelant cette action à intervalle régulier). |
| **Bon de commande ou dépense bloqué en "attente d'approbation" sans avancer** | Une règle d'approbation (GED) impose qu'un titulaire d'un rôle précis valide au-delà d'un certain montant | Contacter un utilisateur portant le rôle exigé par la règle (visible dans **Documents → Approbations**) pour qu'il approuve ou rejette la demande — un administrateur ne peut pas outrepasser cette règle sans porter lui-même le rôle requis. |

---

*Ce guide couvre l'usage fonctionnel de l'ERP tel que livré. Pour les aspects techniques (architecture, déploiement, variables d'environnement, schéma de base de données), se référer au [README.md](README.md).*
