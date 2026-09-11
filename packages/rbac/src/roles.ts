import { ALL_PERMISSION_CODES } from "./permissions";

export interface DefaultRoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

const byPrefix = (...prefixes: string[]) => ALL_PERMISSION_CODES.filter((c) => prefixes.some((p) => c.startsWith(p)));

/**
 * The predefined roles required by the RBAC spec. Seeded as system roles
 * (`companyId: null`) so every company can assign them without redefining
 * the matrix — a company can still clone one into a custom role later.
 */
export const DEFAULT_ROLES: DefaultRoleDefinition[] = [
  {
    name: "Administrateur Général",
    description: "Accès complet à tous les modules",
    permissions: ALL_PERMISSION_CODES,
  },
  {
    name: "Caissier",
    description: "Vente en caisse, sessions de caisse, impression de tickets",
    permissions: [...byPrefix("pos."), "treasury.session.close"],
  },
  {
    name: "Gestionnaire de Stock",
    description: "Catalogue produits, dépôts, transferts, mouvements de stock, chaîne d'approvisionnement, dispatch livraisons",
    permissions: [...byPrefix("stock."), "pos.product.read", ...byPrefix("supplychain."), "logistics.delivery.manage"],
  },
  {
    name: "Comptable",
    description: "Écritures, factures, rapports financiers, rapprochement bancaire, trésorerie, crédit, immobilisations, GED",
    permissions: [
      ...byPrefix("accounting."),
      "pos.sale.read",
      "stock.movement.read",
      ...byPrefix("treasury."),
      ...byPrefix("credit."),
      ...byPrefix("assets."),
      ...byPrefix("ged."),
    ],
  },
  {
    name: "DRH",
    description: "Employés, contrats, présences, congés, paie",
    permissions: byPrefix("hr."),
  },
  {
    name: "Livreur",
    description: "Consultation et mise à jour de ses propres livraisons (chauffeur)",
    permissions: byPrefix("logistics.delivery.drive"),
  },
];
