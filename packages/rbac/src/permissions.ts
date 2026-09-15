export interface PermissionDefinition {
  code: string;
  module:
    | "POS"
    | "STOCK"
    | "ACCOUNTING"
    | "HR"
    | "CRM"
    | "ADMIN"
    | "SUPPLYCHAIN"
    | "LOGISTICS"
    | "TREASURY"
    | "CREDIT"
    | "ASSETS"
    | "GED";
  description: string;
}

/**
 * Single source of truth for the permission matrix: consumed by the DB seed
 * (packages/database/seed) to populate the `Permission` table, and by the
 * API's PermissionsGuard (apps/api) to know which codes are valid to check
 * against. Codes follow `<module>.<resource>.<action>`.
 */
export const PERMISSIONS: PermissionDefinition[] = [
  // --- POS / Vente -----------------------------------------------------------
  { code: "pos.product.read", module: "POS", description: "Rechercher/scanner un produit en caisse" },
  { code: "pos.cart.manage", module: "POS", description: "Créer/modifier un panier" },
  { code: "pos.sale.create", module: "POS", description: "Encaisser une vente (checkout)" },
  { code: "pos.sale.read", module: "POS", description: "Consulter les ventes" },
  { code: "pos.cashsession.manage", module: "POS", description: "Ouvrir/fermer une session de caisse" },
  { code: "pos.print.ticket", module: "POS", description: "Imprimer un ticket de caisse" },
  {
    code: "pos.price.override",
    module: "POS",
    description: "Modifier manuellement le prix d'un article en caisse (hors prix catalogue) — non accordé au Caissier par défaut",
  },

  // --- Stock -------------------------------------------------------------------
  { code: "stock.product.manage", module: "STOCK", description: "Créer/modifier les fiches produit" },
  { code: "stock.warehouse.manage", module: "STOCK", description: "Gérer les dépôts/entrepôts" },
  { code: "stock.transfer.manage", module: "STOCK", description: "Créer/valider un transfert inter-dépôts" },
  { code: "stock.movement.read", module: "STOCK", description: "Consulter les mouvements de stock" },

  // --- Comptabilité (SYSCOHADA) --------------------------------------------------
  { code: "accounting.journal.read", module: "ACCOUNTING", description: "Consulter les écritures comptables" },
  { code: "accounting.journal.write", module: "ACCOUNTING", description: "Saisir/valider des écritures" },
  { code: "accounting.invoice.manage", module: "ACCOUNTING", description: "Gérer factures/avoirs clients et fournisseurs" },
  { code: "accounting.report.read", module: "ACCOUNTING", description: "Consulter Bilan / Compte de résultat / SIG" },
  { code: "accounting.bank.reconcile", module: "ACCOUNTING", description: "Effectuer le rapprochement bancaire" },

  // --- RH & Paie -----------------------------------------------------------------
  { code: "hr.employee.manage", module: "HR", description: "Gérer les fiches employés et contrats" },
  { code: "hr.attendance.manage", module: "HR", description: "Gérer présences et congés" },
  { code: "hr.leave.approve", module: "HR", description: "Approuver une demande de congé" },
  { code: "hr.payroll.manage", module: "HR", description: "Exécuter la paie et générer les bulletins" },

  // --- CRM -------------------------------------------------------------------------
  { code: "crm.customer.manage", module: "CRM", description: "Gérer la base clients" },
  { code: "crm.opportunity.manage", module: "CRM", description: "Gérer le pipeline de prospection" },
  { code: "crm.reminder.manage", module: "CRM", description: "Gérer les relances impayés/marketing" },

  // --- Administration ---------------------------------------------------------------
  { code: "admin.user.manage", module: "ADMIN", description: "Gérer les utilisateurs" },
  { code: "admin.role.manage", module: "ADMIN", description: "Gérer les rôles et permissions" },
  { code: "admin.company.manage", module: "ADMIN", description: "Gérer société/magasins/paramètres" },
  { code: "admin.audit.read", module: "ADMIN", description: "Consulter le journal d'audit" },

  // --- Chaîne d'approvisionnement ----------------------------------------------------
  { code: "supplychain.quote.manage", module: "SUPPLYCHAIN", description: "Gérer les cotations fournisseurs" },
  { code: "supplychain.purchaseorder.manage", module: "SUPPLYCHAIN", description: "Créer/valider les commandes fournisseurs" },
  { code: "supplychain.receipt.manage", module: "SUPPLYCHAIN", description: "Réceptionner les commandes (GRN)" },

  // --- Livraison & Logistique ----------------------------------------------------------
  { code: "logistics.delivery.manage", module: "LOGISTICS", description: "Planifier/attribuer les livraisons, gérer zones et véhicules" },
  { code: "logistics.delivery.drive", module: "LOGISTICS", description: "Consulter ses propres livraisons et mettre à jour leur statut (chauffeur)" },

  // --- Trésorerie ----------------------------------------------------------------------
  { code: "treasury.cashbox.manage", module: "TREASURY", description: "Gérer les petites caisses/coffres et leurs mouvements" },
  { code: "treasury.transfer.manage", module: "TREASURY", description: "Effectuer des transferts entre caisses/coffre/banque" },
  { code: "treasury.session.close", module: "TREASURY", description: "Clôturer une session de caisse (Z de caisse) et valider l'écart" },

  // --- Crédit & Recouvrement -------------------------------------------------------------
  { code: "credit.installment.manage", module: "CREDIT", description: "Gérer les échéanciers de paiement à crédit" },
  { code: "credit.customer.block", module: "CREDIT", description: "Bloquer/débloquer un client pour dépassement d'encours" },

  // --- Actifs & Amortissements -----------------------------------------------------------
  { code: "assets.fixedasset.manage", module: "ASSETS", description: "Gérer le registre des immobilisations" },
  { code: "assets.depreciation.run", module: "ASSETS", description: "Générer et poster les dotations aux amortissements" },

  // --- GED & Approbations ------------------------------------------------------------------
  { code: "ged.document.manage", module: "GED", description: "Attacher/consulter des documents (factures, écritures, employés, actifs)" },
  { code: "ged.approval.manage", module: "GED", description: "Définir les règles d'approbation et statuer sur une demande" },
];

export const ALL_PERMISSION_CODES = PERMISSIONS.map((p) => p.code);
