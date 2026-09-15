"use client";

import { useMemo, useState } from "react";
import { useI18n } from "../../../lib/i18n-context";

type Domain = "pos" | "stock" | "accounting" | "hr" | "logistics";

interface FaqItem {
  id: string;
  domain: Domain;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "pos-scan",
    domain: "pos",
    question: "Comment scanner un article en caisse ?",
    answer:
      "Trois méthodes disponibles en parallèle : la douchette USB/Bluetooth (reconnue comme un clavier — brancher et scanner, aucun clic requis), l'icône caméra 📷 (autoriser l'accès à la webcam puis viser le code-barres), ou la recherche manuelle en tapant au moins 2 caractères du nom ou de la référence.",
  },
  {
    id: "pos-split-payment",
    domain: "pos",
    question: "Comment encaisser un paiement fractionné entre plusieurs moyens ?",
    answer:
      "Dans l'écran d'encaissement, utiliser \"+ Ajouter un moyen de paiement\" pour combiner Espèces, Carte, Mobile Money, Virement, Chèque ou Vente à crédit sur une même vente. Le \"Reste à payer\" et la \"Monnaie à rendre\" se recalculent automatiquement ; le bouton Valider reste désactivé tant que le montant tendu est insuffisant.",
  },
  {
    id: "pos-cart-resume",
    domain: "pos",
    question: "Comment reprendre un panier commencé sur un autre poste ?",
    answer:
      "Le bouton \"🧺 Paniers en cours\" (badge = nombre de paniers actifs du magasin, temps réel) ouvre la liste de tous les paniers actifs, y compris ceux démarrés sur un autre poste ou une autre tablette. Cliquer sur un panier le reprend sur le poste actuel ; il disparaît automatiquement de la liste des autres postes dès qu'il est encaissé.",
  },
  {
    id: "pos-print",
    domain: "pos",
    question: "Comment imprimer un ticket thermique après une vente ?",
    answer:
      "Un bandeau apparaît en bas de l'écran avec \"Imprimer (USB)\" si le navigateur supporte WebUSB (Chrome/Edge) et qu'une imprimante ESC/POS est branchée, ou un champ \"IP imprimante\" + \"Imprimer (réseau)\" pour une imprimante connectée au réseau local (port 9100).",
  },
  {
    id: "pos-offline",
    domain: "pos",
    question: "Que se passe-t-il si le réseau est coupé pendant une vente ?",
    answer:
      "L'indicateur \"Hors-ligne\" s'affiche avec un compteur d'actions en attente de synchronisation. L'ajout d'article au panier continue de fonctionner et la file se rejoue automatiquement au retour du réseau. L'incrément/suppression de ligne et l'encaissement final, eux, nécessitent une connexion active.",
  },
  {
    id: "stock-product",
    domain: "stock",
    question: "Comment créer une fiche produit avec code-barres ?",
    answer:
      "Menu Stock → Produits → \"Nouveau produit\" : code SKU, nom, prix d'achat, prix de vente, catégorie, marque, seuil d'alerte. Le code-barres associé (scanné ou saisi) est ce que la douchette ou la caméra reconnaîtront en caisse.",
  },
  {
    id: "stock-reorder",
    domain: "stock",
    question: "Comment fonctionne le réapprovisionnement automatique ?",
    answer:
      "Achats → Réapprovisionnement → \"Lancer le contrôle\" scanne tous les produits sous seuil. Pour chaque produit avec une cotation fournisseur active, un bon de commande brouillon est généré automatiquement (fournisseur le moins cher) ; sinon une notification est créée. ⚠️ Ce contrôle n'est pas planifié automatiquement — à relancer manuellement à intervalle régulier.",
  },
  {
    id: "stock-grn",
    domain: "stock",
    question: "Comment valider une réception de marchandises (GRN) ?",
    answer:
      "Achats → Réceptions : sélectionner une commande envoyée, saisir les quantités reçues/endommagées et le lot/date d'expiration si besoin, \"Créer la réception\" puis \"Valider\". La validation met à jour le stock et comptabilise automatiquement l'écriture fournisseur.",
  },
  {
    id: "accounting-reports",
    domain: "accounting",
    question: "Comment consulter le Bilan et le Compte de Résultat (SIG) ?",
    answer:
      "Comptabilité → Rapports : choisir l'exercice fiscal puis basculer entre Balance générale, Compte de résultat (cascade complète des Soldes Intermédiaires de Gestion jusqu'au Résultat Net) et Bilan, avec vérification d'équilibre automatique Actif = Passif.",
  },
  {
    id: "accounting-unbalanced",
    domain: "accounting",
    question: "Pourquoi mon écriture comptable est-elle refusée ?",
    answer:
      "Contrôle bloquant volontaire : le total des lignes au débit doit être strictement égal au total au crédit avant tout enregistrement, pour garantir l'intégrité comptable.",
  },
  {
    id: "accounting-bank",
    domain: "accounting",
    question: "Comment faire un rapprochement bancaire ?",
    answer:
      "Comptabilité → Banque : importer un relevé CSV (date;libellé;montant), puis \"Rapprochement automatique\" apparie chaque ligne à l'écriture comptable du même montant dans une fenêtre de ±5 jours. Les lignes non appariées restent visibles pour un traitement manuel.",
  },
  {
    id: "accounting-depreciation",
    domain: "accounting",
    question: "Comment lancer les dotations aux amortissements ?",
    answer:
      "Module Actifs → \"Lancer les dotations\" comptabilise (débit 681 / crédit compte d'amortissement classe 28) toutes les dotations dues à la date du jour, sur l'ensemble des immobilisations. Action à déclencher manuellement.",
  },
  {
    id: "hr-payroll-run",
    domain: "hr",
    question: "Comment lancer un cycle de paie ?",
    answer:
      "Menu Paie : sélectionner la période puis \"Lancer le cycle\" calcule un bulletin par employé actif (primes, cotisations via barème progressif). Chaque bulletin est téléchargeable en PDF. \"Valider le cycle\" comptabilise automatiquement la paie en écriture consolidée.",
  },
  {
    id: "hr-transfer",
    domain: "hr",
    question: "Comment générer les virements de salaire ?",
    answer:
      "Une fois le cycle validé, choisir le compte bancaire de paiement puis \"Générer le virement groupé\" produit le lot pour l'ensemble des employés payés par virement ; \"Télécharger le CSV\" permet de l'importer dans le portail de la banque.",
  },
  {
    id: "hr-leave-impact",
    domain: "hr",
    question: "Comment un congé sans solde impacte-t-il le bulletin de paie ?",
    answer:
      "Dès qu'un congé sans solde ou une absence non justifiée est approuvé, le salaire de base de l'employé est proratisé automatiquement au calcul du bulletin suivant, au prorata des jours ouvrés du mois.",
  },
  {
    id: "logistics-status",
    domain: "logistics",
    question: "Comment un livreur met-il à jour le statut d'une livraison ?",
    answer:
      "Transitions disponibles selon l'état courant : \"Marquer chargé\" → \"Démarrer la livraison\" → preuve de livraison (signature tactile ou scan QR) pour clore en Livré, ou \"Marquer en échec\" (motif obligatoire). La position GPS est capturée automatiquement à chaque changement de statut (best-effort, n'empêche jamais l'action).",
  },
  {
    id: "logistics-tracking",
    domain: "logistics",
    question: "Comment suivre les livraisons en direct depuis le back-office ?",
    answer:
      "Livraisons → Suivi affiche une carte avec la dernière position GPS connue de chaque livraison Chargée ou En transit, rafraîchie automatiquement toutes les 20 secondes. Il s'agit de la dernière position connue à chaque étape, pas d'un flux GPS continu, et les tuiles de carte nécessitent un accès internet côté navigateur.",
  },
];

interface TroubleshootingRow {
  symptom: string;
  cause: string;
  solution: string;
}

const TROUBLESHOOTING_ROWS: TroubleshootingRow[] = [
  {
    symptom: 'Panier ou vente qui ne se synchronise pas ("Hors-ligne" persistant)',
    cause: "Perte de connexion réseau pendant une vente POS — les actions sont mises en file dans le navigateur en attendant le retour du réseau.",
    solution:
      "Vérifier la connexion internet du poste. Dès qu'elle revient, la file se rejoue automatiquement — patienter quelques secondes. Si le compteur ne bouge pas après 1 minute, recharger la page (rien n'est perdu, la file est conservée localement).",
  },
  {
    symptom: '"Imprimer (USB)" grisé ou absent',
    cause: "Le navigateur ne supporte pas WebUSB (Firefox, Safari), ou aucune imprimante ESC/POS n'est branchée/autorisée.",
    solution:
      "Utiliser Chrome ou Edge pour l'impression USB. Sinon, utiliser le champ \"IP imprimante\" + \"Imprimer (réseau)\" avec une imprimante connectée au réseau local (port 9100).",
  },
  {
    symptom: "Code MFA refusé (\"Code invalide ou expiré\")",
    cause: "Horloge du téléphone désynchronisée, ou code déjà expiré (validité 30 secondes).",
    solution:
      "Vérifier que la date/heure du téléphone est réglée automatiquement. Attendre le prochain code plutôt que réutiliser un ancien. En dernier recours, utiliser un des codes de secours fournis à l'activation (usage unique chacun).",
  },
  {
    symptom: "Devise ou taux de change manquant sur une écriture/facture multi-devise",
    cause: "Aucun taux de change n'est configuré pour la devise et la date de la transaction.",
    solution:
      "Renseigner le taux de change applicable dans la configuration des devises avant de valider la transaction. Par défaut l'ERP est configuré en devise unique (XOF), ce qui évite ce cas.",
  },
  {
    symptom: '"Identifiants invalides" alors que le mot de passe est correct',
    cause: "Ce message générique couvre toute erreur de connexion, y compris une indisponibilité temporaire de l'API ou de la base de données.",
    solution: "Réessayer après quelques secondes. Si le problème persiste, contacter l'administrateur système pour vérifier que l'API et la base de données sont bien démarrées.",
  },
  {
    symptom: "Écran figé ou contenu périmé après une mise à jour (Caisse ou Livreur)",
    cause: "Ces deux applications fonctionnent en PWA avec mise en cache locale — un ancien cache peut masquer la nouvelle version.",
    solution:
      "Fermer complètement l'application puis la rouvrir. Si le problème persiste, vider le cache du navigateur pour ce site puis se reconnecter.",
  },
  {
    symptom: "Le scan caméra ne détecte pas le code-barres",
    cause: "Éclairage insuffisant, code-barres endommagé/flou, ou permission caméra refusée par le navigateur.",
    solution:
      "Vérifier l'autorisation caméra (icône dans la barre d'adresse). Rapprocher le code-barres et stabiliser l'appareil. En cas d'échec répété, utiliser la douchette physique ou la recherche manuelle.",
  },
  {
    symptom: "Douchette USB/Bluetooth qui ne scanne rien",
    cause: "La douchette n'est pas reconnue en mode \"clavier\" (HID), ou le focus n'est pas sur la page de caisse.",
    solution:
      "Vérifier que la douchette est configurée en mode \"clavier USB\" (HID) et non en mode série. Cliquer une fois sur la page de caisse pour lui donner le focus, puis réessayer.",
  },
  {
    symptom: 'Écriture comptable refusée ("non équilibrée")',
    cause: "Le total des lignes au débit ne correspond pas au total au crédit.",
    solution: "Ajuster les montants ligne par ligne jusqu'à obtenir Σdébit = Σcrédit — contrôle bloquant volontaire pour garantir l'intégrité comptable.",
  },
  {
    symptom: "Notification de stock bas jamais reçue malgré un produit sous seuil",
    cause: "Le contrôle de réapprovisionnement n'est pas planifié automatiquement dans cette version.",
    solution:
      "Se rendre dans Achats → Réapprovisionnement et cliquer sur \"Lancer le contrôle\" régulièrement, ou demander à l'administrateur de planifier un appel externe à cette action.",
  },
];

const DOMAIN_ORDER: Domain[] = ["pos", "stock", "accounting", "hr", "logistics"];

export default function AidePage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState<Domain | "all">("all");

  const domainLabels: Record<Domain | "all", string> = {
    all: t("help.domainAll"),
    pos: t("help.domainPos"),
    stock: t("help.domainStock"),
    accounting: t("help.domainAccounting"),
    hr: t("help.domainHr"),
    logistics: t("help.domainLogistics"),
  };

  const needle = search.trim().toLowerCase();

  const filteredFaq = useMemo(
    () =>
      FAQ_ITEMS.filter((item) => {
        if (domain !== "all" && item.domain !== domain) return false;
        if (!needle) return true;
        return item.question.toLowerCase().includes(needle) || item.answer.toLowerCase().includes(needle);
      }),
    [domain, needle],
  );

  const filteredTroubleshooting = useMemo(
    () =>
      TROUBLESHOOTING_ROWS.filter((row) => {
        if (!needle) return true;
        return (
          row.symptom.toLowerCase().includes(needle) ||
          row.cause.toLowerCase().includes(needle) ||
          row.solution.toLowerCase().includes(needle)
        );
      }),
    [needle],
  );

  const noResults = filteredFaq.length === 0 && filteredTroubleshooting.length === 0;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("help.title")}</h1>

      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("help.searchPlaceholder")}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...DOMAIN_ORDER] as (Domain | "all")[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDomain(d)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                domain === d
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {domainLabels[d]}
            </button>
          ))}
        </div>
      </div>

      {noResults && <p className="text-sm text-slate-500 dark:text-slate-400">{t("help.noResults")}</p>}

      {filteredFaq.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("help.guideSection")}</h2>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredFaq.map((item) => (
              <details key={item.id} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-slate-900 marker:content-none dark:text-white">
                  <span className="mr-2 inline-block text-slate-400 transition-transform group-open:rotate-90">›</span>
                  {item.question}
                </summary>
                <p className="mt-2 pl-4 text-sm text-slate-600 dark:text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {filteredTroubleshooting.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("help.troubleshootingTitle")}</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-2 font-medium">{t("help.troubleshootingSymptom")}</th>
                  <th className="px-4 py-2 font-medium">{t("help.troubleshootingCause")}</th>
                  <th className="px-4 py-2 font-medium">{t("help.troubleshootingSolution")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTroubleshooting.map((row) => (
                  <tr key={row.symptom} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.symptom}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.cause}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.solution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
