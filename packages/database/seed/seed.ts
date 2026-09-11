import bcrypt from "bcryptjs";
import { AccountClass, AccountType, JournalType, PrismaClient } from "@prisma/client";
import { PERMISSIONS, DEFAULT_ROLES } from "@ixoris/rbac";
import { SYSCOHADA_CHART_OF_ACCOUNTS, WELL_KNOWN_ACCOUNTS, computeDepreciationSchedule } from "@ixoris/accounting-engine";
import { DEFAULT_SALARY_COMPONENTS } from "@ixoris/payroll-engine";

const prisma = new PrismaClient();

const PRISMA_ACCOUNT_CLASS: Record<number, AccountClass> = {
  1: AccountClass.CLASS_1,
  2: AccountClass.CLASS_2,
  3: AccountClass.CLASS_3,
  4: AccountClass.CLASS_4,
  5: AccountClass.CLASS_5,
  6: AccountClass.CLASS_6,
  7: AccountClass.CLASS_7,
  8: AccountClass.CLASS_8,
  9: AccountClass.CLASS_9,
};

const STANDARD_JOURNALS: { code: string; label: string; type: JournalType }[] = [
  { code: "VE", label: "Journal des ventes", type: JournalType.VENTES },
  { code: "AC", label: "Journal des achats", type: JournalType.ACHATS },
  { code: "BQ", label: "Journal de banque", type: JournalType.BANQUE },
  { code: "CA", label: "Journal de caisse", type: JournalType.CAISSE },
  { code: "OD", label: "Opérations diverses", type: JournalType.OPERATIONS_DIVERSES },
  { code: "PA", label: "Journal de paie", type: JournalType.PAIE },
];

const DEMO_ADMIN_PASSWORD = "Admin123!";
const DEMO_CASHIER_PASSWORD = "Caissier123!";
const DEMO_DRIVER_PASSWORD = "Livreur123!";

const CURRENCIES = [
  { code: "XOF", name: "Franc CFA (BCEAO)", symbol: "FCFA" },
  { code: "KMF", name: "Franc comorien", symbol: "CF" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "USD", name: "Dollar américain", symbol: "$" },
];

async function seedCurrency() {
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({ where: { code: currency.code }, update: {}, create: currency });
  }
}

async function seedPermissions() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }
}

async function seedDefaultRoles() {
  for (const role of DEFAULT_ROLES) {
    const existing = await prisma.role.findFirst({ where: { companyId: null, name: role.name } });
    const roleRow = existing
      ? await prisma.role.update({ where: { id: existing.id }, data: { isSystem: true } })
      : await prisma.role.create({ data: { name: role.name, companyId: null, isSystem: true } });

    const permissions = await prisma.permission.findMany({ where: { code: { in: role.permissions } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: roleRow.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: roleRow.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
}

async function seedDemoTenant() {
  const company = await prisma.company.upsert({
    where: { id: "demo-company" },
    update: {},
    create: {
      id: "demo-company",
      name: "IXORIS Demo",
      legalName: "IXORIS Demo SARL",
      taxId: "CI-NIF-000000",
      country: "CI",
      baseCurrencyCode: "XOF",
      stockValuationMethod: "CUMP",
    },
  });

  const store = await prisma.store.upsert({
    where: { companyId_code: { companyId: company.id, code: "MAIN" } },
    update: {},
    create: { companyId: company.id, name: "Magasin Principal", code: "MAIN", address: "Abidjan, Plateau" },
  });

  const warehouse = await prisma.warehouse.findFirst({ where: { storeId: store.id } });
  const resolvedWarehouse =
    warehouse ?? (await prisma.warehouse.create({ data: { companyId: company.id, storeId: store.id, name: "Dépôt principal" } }));

  const register = await prisma.register.upsert({
    where: { storeId_code: { storeId: store.id, code: "CAISSE-1" } },
    update: {},
    create: { storeId: store.id, warehouseId: resolvedWarehouse.id, name: "Caisse 1", code: "CAISSE-1" },
  });

  const adminRole = await prisma.role.findFirstOrThrow({ where: { companyId: null, name: "Administrateur Général" } });
  const cashierRole = await prisma.role.findFirstOrThrow({ where: { companyId: null, name: "Caissier" } });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ixoris.dev" },
    update: {},
    create: {
      email: "admin@ixoris.dev",
      passwordHash: bcrypt.hashSync(DEMO_ADMIN_PASSWORD, 10),
      firstName: "Admin",
      lastName: "IXORIS",
      companyId: company.id,
    },
  });
  // storeId is nullable, and Postgres treats each NULL as distinct for unique
  // constraints — an upsert on the compound key wouldn't reliably find this
  // row again, so check-then-create instead to keep the seed idempotent.
  const existingAdminRole = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: adminRole.id, storeId: null },
  });
  if (!existingAdminRole) {
    await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id, storeId: null } });
  }

  const cashier = await prisma.user.upsert({
    where: { email: "caissier@ixoris.dev" },
    update: {},
    create: {
      email: "caissier@ixoris.dev",
      passwordHash: bcrypt.hashSync(DEMO_CASHIER_PASSWORD, 10),
      firstName: "Awa",
      lastName: "Caissière",
      companyId: company.id,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId_storeId: { userId: cashier.id, roleId: cashierRole.id, storeId: store.id } },
    update: {},
    create: { userId: cashier.id, roleId: cashierRole.id, storeId: store.id },
  });

  const unit = await prisma.unit.upsert({ where: { code: "pcs" }, update: {}, create: { code: "pcs", label: "Pièce" } });

  const demoProducts = [
    { sku: "DEMO-001", name: "Riz parfumé 5kg", barcode: "6180000000011", purchasePrice: 3500, sellingPrice: 4500, stock: 100 },
    { sku: "DEMO-002", name: "Huile végétale 1L", barcode: "6180000000028", purchasePrice: 1200, sellingPrice: 1600, stock: 100 },
    { sku: "DEMO-003", name: "Savon de Marseille", barcode: "6180000000035", purchasePrice: 400, sellingPrice: 650, stock: 100 },
    // Stock volontairement sous le seuil : de quoi tester le réappro auto dès le seed.
    { sku: "DEMO-004", name: "Eau minérale 1.5L", barcode: "6180000000042", purchasePrice: 250, sellingPrice: 400, stock: 8, minStockAlert: 20, reorderQuantity: 200 },
  ];

  const products: Record<string, Awaited<ReturnType<typeof prisma.product.upsert>>> = {};
  for (const p of demoProducts) {
    const product = await prisma.product.upsert({
      where: { companyId_sku: { companyId: company.id, sku: p.sku } },
      update: {},
      create: {
        companyId: company.id,
        sku: p.sku,
        name: p.name,
        unitId: unit.id,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        tvaRate: 18,
        minStockAlert: p.minStockAlert ?? 0,
        reorderQuantity: p.reorderQuantity,
      },
    });
    products[p.sku] = product;
    await prisma.productBarcode.upsert({
      where: { barcode: p.barcode },
      update: {},
      create: { productId: product.id, barcode: p.barcode, type: "EAN13" },
    });
    await prisma.stock.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: resolvedWarehouse.id } },
      update: {},
      create: { productId: product.id, warehouseId: resolvedWarehouse.id, quantity: p.stock },
    });
  }

  return { company, store, register, cashier, admin, warehouse: resolvedWarehouse, products };
}

const AUXILIARY_ACCOUNT_CODES = new Set(["401", "411"]);

async function seedAccounting(companyId: string) {
  for (const account of SYSCOHADA_CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { companyId_code: { companyId, code: account.code } },
      update: { label: account.label },
      create: {
        companyId,
        code: account.code,
        label: account.label,
        class: PRISMA_ACCOUNT_CLASS[account.class],
        type: account.type as AccountType,
        isAuxiliary: AUXILIARY_ACCOUNT_CODES.has(account.code),
      },
    });
  }

  for (const journal of STANDARD_JOURNALS) {
    await prisma.journal.upsert({
      where: { companyId_code: { companyId, code: journal.code } },
      update: { label: journal.label, type: journal.type },
      create: { companyId, code: journal.code, label: journal.label, type: journal.type },
    });
  }

  const year = new Date().getFullYear();
  const fiscalYear = await prisma.fiscalYear.upsert({
    where: { companyId_label: { companyId, label: `Exercice ${year}` } },
    update: {},
    create: {
      companyId,
      label: `Exercice ${year}`,
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year, 11, 31)),
    },
  });

  for (let month = 0; month < 12; month++) {
    const label = `${year}-${String(month + 1).padStart(2, "0")}`;
    await prisma.accountingPeriod.upsert({
      where: { fiscalYearId_label: { fiscalYearId: fiscalYear.id, label } },
      update: {},
      create: {
        fiscalYearId: fiscalYear.id,
        label,
        startDate: new Date(Date.UTC(year, month, 1)),
        endDate: new Date(Date.UTC(year, month + 1, 0)),
      },
    });
  }

  const bankGlAccount = await prisma.account.findFirstOrThrow({ where: { companyId, code: WELL_KNOWN_ACCOUNTS.banque } });
  const bankAccount = await prisma.bankAccount.upsert({
    where: { glAccountId: bankGlAccount.id },
    update: {},
    create: { companyId, bankName: "Banque Atlantique CI", accountNumber: "CI93-DEMO-0000-0001", glAccountId: bankGlAccount.id },
  });

  return { fiscalYear, bankAccount, accountCount: SYSCOHADA_CHART_OF_ACCOUNTS.length, journalCount: STANDARD_JOURNALS.length };
}

const COMPONENT_GL_ACCOUNT: Record<string, string> = {
  PRIME_TRANSPORT: WELL_KNOWN_ACCOUNTS.chargesPersonnel,
  CNPS_SALARIE: WELL_KNOWN_ACCOUNTS.securiteSociale,
  ITS: WELL_KNOWN_ACCOUNTS.etatAutresImpotsTaxes,
  CNPS_RETRAITE_PATRONALE: WELL_KNOWN_ACCOUNTS.securiteSociale,
  CNPS_PRESTATIONS_FAMILIALES: WELL_KNOWN_ACCOUNTS.securiteSociale,
  CNPS_ACCIDENTS_TRAVAIL: WELL_KNOWN_ACCOUNTS.securiteSociale,
};

async function seedPayroll(companyId: string, cashierUserId: string) {
  const glAccounts = await prisma.account.findMany({
    where: { companyId, code: { in: [...new Set(Object.values(COMPONENT_GL_ACCOUNT))] } },
  });
  const accountIdByCode = new Map(glAccounts.map((a) => [a.code, a.id]));

  // Every PayslipLine references a SalaryComponent — "Salaire de base" is always
  // computed by the engine but isn't in DEFAULT_SALARY_COMPONENTS (it comes from
  // Employee.baseSalary, not a configurable rate), so it needs its own DB row too.
  await prisma.salaryComponent.upsert({
    where: { companyId_code: { companyId, code: "BASE" } },
    update: {},
    create: {
      companyId,
      code: "BASE",
      label: "Salaire de base",
      type: "EARNING",
      calculationMethod: "FIXED",
      rateOrAmount: 0,
      isTaxable: true,
      glAccountId: accountIdByCode.get(WELL_KNOWN_ACCOUNTS.chargesPersonnel),
    },
  });

  for (const component of DEFAULT_SALARY_COMPONENTS) {
    const glAccountId = accountIdByCode.get(COMPONENT_GL_ACCOUNT[component.code]);
    await prisma.salaryComponent.upsert({
      where: { companyId_code: { companyId, code: component.code } },
      update: {
        label: component.label,
        type: component.type,
        calculationMethod: component.calculationMethod,
        rateOrAmount: component.rateOrAmount,
        isTaxable: component.isTaxable,
        glAccountId,
      },
      create: {
        companyId,
        code: component.code,
        label: component.label,
        type: component.type,
        calculationMethod: component.calculationMethod,
        rateOrAmount: component.rateOrAmount,
        isTaxable: component.isTaxable,
        glAccountId,
      },
    });
  }

  let department = await prisma.department.findFirst({ where: { companyId, name: "Ventes" } });
  department ??= await prisma.department.create({ data: { companyId, name: "Ventes" } });

  let position = await prisma.position.findFirst({ where: { companyId, title: "Caissier" } });
  position ??= await prisma.position.create({ data: { companyId, departmentId: department.id, title: "Caissier" } });

  const baseSalary = 150000;
  const employee = await prisma.employee.upsert({
    where: { companyId_employeeNumber: { companyId, employeeNumber: "EMP-001" } },
    update: {},
    create: {
      companyId,
      userId: cashierUserId,
      employeeNumber: "EMP-001",
      firstName: "Awa",
      lastName: "Caissière",
      hireDate: new Date(Date.UTC(new Date().getFullYear(), 0, 15)),
      departmentId: department.id,
      positionId: position.id,
      baseSalary,
    },
  });

  const existingContract = await prisma.contract.findFirst({ where: { employeeId: employee.id } });
  if (!existingContract) {
    await prisma.contract.create({
      data: { employeeId: employee.id, type: "CDI", startDate: employee.hireDate, grossSalary: baseSalary },
    });
  }

  return { employee, componentCount: DEFAULT_SALARY_COMPONENTS.length };
}

const DEMO_LEAVE_TYPES = [
  { name: "Congés payés", isPaid: true },
  { name: "Congé maladie", isPaid: true },
  { name: "Congé sans solde", isPaid: false },
];

async function seedHrExtras(companyId: string, employeeId: string) {
  const leaveTypes = [];
  for (const lt of DEMO_LEAVE_TYPES) {
    let leaveType = await prisma.leaveType.findFirst({ where: { companyId, name: lt.name } });
    leaveType ??= await prisma.leaveType.create({ data: { companyId, name: lt.name, isPaid: lt.isPaid } });
    leaveTypes.push(leaveType);
  }
  const unpaidLeaveType = leaveTypes.find((lt) => !lt.isPaid)!;

  // 2 unpaid days this month, already approved — gives payroll proration something real to reduce.
  const existingLeaveRequest = await prisma.leaveRequest.findFirst({ where: { employeeId, leaveTypeId: unpaidLeaveType.id } });
  if (!existingLeaveRequest) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 6));
    await prisma.leaveRequest.create({
      data: { employeeId, leaveTypeId: unpaidLeaveType.id, startDate: start, endDate: end, status: "APPROVED" },
    });
  }

  return { leaveTypeCount: leaveTypes.length };
}

/** A posted bank deposit + a matching/non-matching statement line, so the reconciliation endpoints have something real to work with. */
async function seedBankReconciliationDemo(companyId: string, bankAccountId: string) {
  const bankAccountRow = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
  const capitalAccount = await prisma.account.findFirstOrThrow({ where: { companyId, code: "101" } });
  const journal = await prisma.journal.findFirstOrThrow({ where: { companyId, code: "OD" } });

  const now = new Date();
  const period = await prisma.accountingPeriod.findFirstOrThrow({
    where: { fiscalYear: { companyId }, startDate: { lte: now }, endDate: { gte: now } },
  });
  const depositDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  let entry = await prisma.journalEntry.findFirst({ where: { companyId, sourceType: "SeedDemo", sourceId: "bank-deposit" } });
  entry ??= await prisma.journalEntry.create({
    data: {
      companyId,
      journalId: journal.id,
      fiscalYearId: period.fiscalYearId,
      periodId: period.id,
      reference: "OD-DEMO-0001",
      date: depositDate,
      description: "Apport en compte bancaire",
      sourceType: "SeedDemo",
      sourceId: "bank-deposit",
      isPosted: true,
      lines: {
        create: [
          { accountId: bankAccountRow.glAccountId, debit: 1_000_000, credit: 0, label: "Apport en compte bancaire" },
          { accountId: capitalAccount.id, debit: 0, credit: 1_000_000, label: "Apport en compte bancaire" },
        ],
      },
    },
  });

  const existingStatement = await prisma.bankStatement.findFirst({ where: { bankAccountId } });
  if (!existingStatement) {
    await prisma.bankStatement.create({
      data: {
        bankAccountId,
        statementDate: now,
        startBalance: 0,
        endBalance: 995_000,
        lines: {
          create: [
            { date: depositDate, label: "VIR APPORT CAPITAL", amount: 1_000_000 }, // matches the journal entry above
            { date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), label: "FRAIS TENUE COMPTE", amount: -5_000 }, // left unmatched on purpose
          ],
        },
      },
    });
  }

  return { statementLines: 2 };
}

async function seedCrm(companyId: string, assignedToUserId: string) {
  const demoCustomers = [
    { code: "CLI-001", name: "Boutique Aïcha", email: "aicha@example.ci", phone: "+225 07 00 00 01" },
    { code: "CLI-002", name: "Supermarché Koné", email: "kone@example.ci", phone: "+225 07 00 00 02" },
    { code: "CLI-003", name: "Restaurant Le Baobab", email: "baobab@example.ci", phone: "+225 07 00 00 03" },
  ];

  const customers = [];
  for (const c of demoCustomers) {
    const customer = await prisma.customer.upsert({
      where: { companyId_code: { companyId, code: c.code } },
      update: {},
      create: { companyId, code: c.code, name: c.name, type: "COMPANY", email: c.email, phone: c.phone, category: "NEW" },
    });
    customers.push(customer);
  }
  const [, kone, baobab] = customers;

  // An overdue invoice gives the "relance impayés" flow something real to find.
  const existingInvoice = await prisma.invoice.findFirst({ where: { companyId, type: "CUSTOMER", customerId: baobab.id } });
  if (!existingInvoice) {
    const pastDueDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    await prisma.invoice.create({
      data: {
        companyId,
        type: "CUSTOMER",
        customerId: baobab.id,
        number: `FC-DEMO-${baobab.code}`,
        dueDate: pastDueDate,
        status: "OVERDUE",
        totalHT: 254237,
        totalTVA: 45763,
        totalTTC: 300000,
      },
    });
  }
  await prisma.customer.update({ where: { id: baobab.id }, data: { category: "LATE_PAYER" } });

  const existingOpportunity = await prisma.opportunity.findFirst({ where: { companyId, customerId: kone.id } });
  if (!existingOpportunity) {
    await prisma.opportunity.create({
      data: {
        companyId,
        customerId: kone.id,
        title: "Contrat fourniture mensuelle — Supermarché Koné",
        stage: "PROPOSAL",
        amount: 300000,
        expectedCloseDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        assignedToId: assignedToUserId,
      },
    });
  }

  return { customerCount: customers.length, customers };
}

async function seedSupplyChain(companyId: string, product: { id: string }) {
  const suppliersData = [
    { code: "SUP-001", name: "Grossiste Abidjan", email: "contact@grossiste-abidjan.ci", leadTimeDaysAvg: 3 },
    { code: "SUP-002", name: "Import Express Dakar", email: "vente@import-express.sn", leadTimeDaysAvg: 10 },
  ];
  const suppliers = [];
  for (const s of suppliersData) {
    const supplier = await prisma.supplier.upsert({
      where: { companyId_code: { companyId, code: s.code } },
      update: {},
      create: { companyId, code: s.code, name: s.name, email: s.email, leadTimeDaysAvg: s.leadTimeDaysAvg },
    });
    suppliers.push(supplier);
  }
  const [grossiste, importExpress] = suppliers;

  // Two competing quotes on the low-stock demo product — the cheapest wins the auto-generated PO.
  const quotesData = [
    { supplier: grossiste, unitPrice: 230, leadTimeDays: 3 },
    { supplier: importExpress, unitPrice: 210, leadTimeDays: 10 },
  ];
  for (const q of quotesData) {
    const existing = await prisma.supplierQuote.findFirst({ where: { companyId, supplierId: q.supplier.id, productId: product.id } });
    if (!existing) {
      await prisma.supplierQuote.create({
        data: { companyId, supplierId: q.supplier.id, productId: product.id, unitPrice: q.unitPrice, leadTimeDays: q.leadTimeDays },
      });
    }
  }

  return { supplierCount: suppliers.length };
}

async function seedLogistics(companyId: string, storeId: string, customerId: string | undefined) {
  const zonesData = [
    { name: "Abidjan Centre", description: "Livraison intra-muros", feeFlat: 1000, estimatedDurationMinutes: 45 },
    { name: "Abidjan Périphérie", description: "Zones excentrées, tarif au km", feeFlat: 1500, feePerKm: 100, estimatedDurationMinutes: 90 },
  ];
  const zones = [];
  for (const z of zonesData) {
    let zone = await prisma.deliveryZone.findFirst({ where: { companyId, name: z.name } });
    zone ??= await prisma.deliveryZone.create({ data: { companyId, ...z } });
    zones.push(zone);
  }

  let vehicle = await prisma.vehicle.findFirst({ where: { companyId, plateNumber: "CI-1234-AB" } });
  vehicle ??= await prisma.vehicle.create({ data: { companyId, plateNumber: "CI-1234-AB", type: "MOTO", capacityKg: 50 } });

  const livreurRole = await prisma.role.findFirstOrThrow({ where: { companyId: null, name: "Livreur" } });
  const driver = await prisma.user.upsert({
    where: { email: "livreur@ixoris.dev" },
    update: {},
    create: {
      email: "livreur@ixoris.dev",
      passwordHash: bcrypt.hashSync(DEMO_DRIVER_PASSWORD, 10),
      firstName: "Ibrahim",
      lastName: "Livreur",
      companyId,
    },
  });
  const existingDriverRole = await prisma.userRole.findFirst({ where: { userId: driver.id, roleId: livreurRole.id, storeId } });
  if (!existingDriverRole) {
    await prisma.userRole.create({ data: { userId: driver.id, roleId: livreurRole.id, storeId } });
  }

  const existingDelivery = await prisma.delivery.findFirst({ where: { companyId, driverId: driver.id } });
  if (!existingDelivery) {
    await prisma.delivery.create({
      data: {
        companyId,
        storeId,
        customerId,
        driverId: driver.id,
        vehicleId: vehicle.id,
        deliveryZoneId: zones[0].id,
        number: `DEL-DEMO-0001`,
        address: "Cocody Angré, 8ème tranche, Abidjan",
        status: "PENDING",
        feeAmount: zones[0].feeFlat ?? 0,
        statusHistory: { create: [{ status: "PENDING" }] },
      },
    });
  }

  return { zoneCount: zones.length, driverEmail: driver.email };
}

async function seedTreasury(companyId: string, register: { id: string; glAccountId: string | null }) {
  const registerAccount = await prisma.account.findFirstOrThrow({ where: { companyId, code: WELL_KNOWN_ACCOUNTS.caisse } });
  if (!register.glAccountId) {
    await prisma.register.update({ where: { id: register.id }, data: { glAccountId: registerAccount.id } });
  }

  const pettyCashAccount = await prisma.account.upsert({
    where: { companyId_code: { companyId, code: "5712" } },
    update: {},
    create: { companyId, code: "5712", label: "Petite caisse", class: "CLASS_5", type: "ASSET" },
  });

  const pettyCash = await prisma.cashBox.upsert({
    where: { id: `${companyId}-petty-cash` },
    update: {},
    create: { id: `${companyId}-petty-cash`, companyId, name: "Petite caisse — Magasin Principal", type: "PETTY_CASH", glAccountId: pettyCashAccount.id },
  });

  // Left unposted on purpose — hit POST /treasury/cashboxes/:id/movements to see it post to the ledger live.
  const existingMovement = await prisma.cashMovement.findFirst({ where: { companyId, cashBoxId: pettyCash.id } });
  if (!existingMovement) {
    await prisma.cashMovement.create({
      data: { companyId, cashBoxId: pettyCash.id, type: "DEPOSIT", amount: 50000, counterAccountId: registerAccount.id, notes: "Dotation initiale de la petite caisse" },
    });
  }

  // Left PENDING on purpose — hit POST /treasury/transfers/:id/complete to post it.
  const existingTransfer = await prisma.cashTransfer.findFirst({ where: { companyId, fromAccountId: registerAccount.id, toAccountId: pettyCashAccount.id } });
  if (!existingTransfer) {
    await prisma.cashTransfer.create({
      data: { companyId, fromAccountId: registerAccount.id, toAccountId: pettyCashAccount.id, amount: 20000, status: "PENDING", reference: "Réassort petite caisse" },
    });
  }

  return { pettyCash };
}

async function seedCreditControl(companyId: string, customers: { id: string; code: string; name: string }[]) {
  const kone = customers.find((c) => c.code === "CLI-002");
  const baobab = customers.find((c) => c.code === "CLI-003");

  // Baobab's overdue invoice (seeded in seedCrm) now exceeds this limit — auto-blocked, demonstrating "contrôle du crédit".
  if (baobab) {
    await prisma.customer.update({
      where: { id: baobab.id },
      data: {
        creditLimit: 250000,
        isBlocked: true,
        blockedReason: "Encours (300000.00) supérieur à la limite de crédit (250000.00)",
        blockedAt: new Date(),
      },
    });
  }

  // Koné gets a healthy credit limit and a 3-installment schedule on a fresh invoice — nothing overdue, nothing blocked.
  if (kone) {
    await prisma.customer.update({ where: { id: kone.id }, data: { creditLimit: 1000000 } });

    let invoice = await prisma.invoice.findFirst({ where: { companyId, type: "CUSTOMER", customerId: kone.id, number: `FC-DEMO-${kone.code}` } });
    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          companyId,
          type: "CUSTOMER",
          customerId: kone.id,
          number: `FC-DEMO-${kone.code}`,
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: "VALIDATED",
          totalHT: 508475,
          totalTVA: 91525,
          totalTTC: 600000,
        },
      });
    }

    const existingInstallments = await prisma.paymentInstallment.count({ where: { invoiceId: invoice.id } });
    if (existingInstallments === 0) {
      const now = Date.now();
      await prisma.paymentInstallment.createMany({
        data: [1, 2, 3].map((n) => ({
          invoiceId: invoice!.id,
          installmentNumber: n,
          dueDate: new Date(now + n * 30 * 24 * 60 * 60 * 1000),
          amount: 200000,
        })),
      });
    }

    return { invoice };
  }

  return { invoice: undefined };
}

async function seedFixedAssets(companyId: string) {
  const assetAccount = await prisma.account.findFirstOrThrow({ where: { companyId, code: "245" } });
  const depreciationAccount = await prisma.account.findFirstOrThrow({ where: { companyId, code: "2845" } });

  const existing = await prisma.fixedAsset.findFirst({ where: { companyId, code: "IMMO-001" } });
  if (existing) return { asset: existing };

  const acquisitionDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
  const acquisitionCost = 15000000;
  const residualValue = 1000000;
  const usefulLifeYears = 5;
  const decliningBalanceRate = 2;

  const asset = await prisma.fixedAsset.create({
    data: {
      companyId,
      code: "IMMO-001",
      name: "Véhicule de livraison — Toyota Hilux",
      assetAccountId: assetAccount.id,
      depreciationAccountId: depreciationAccount.id,
      acquisitionDate,
      acquisitionCost,
      residualValue,
      usefulLifeYears,
      depreciationMethod: "DECLINING_BALANCE",
      decliningBalanceRate,
    },
  });

  const rows = computeDepreciationSchedule({ acquisitionCost, residualValue, usefulLifeYears, method: "DECLINING_BALANCE", decliningBalanceRate });
  for (const row of rows) {
    const periodEndDate = new Date(acquisitionDate);
    periodEndDate.setFullYear(periodEndDate.getFullYear() + row.sequenceNumber);
    await prisma.depreciationEntry.create({
      data: {
        fixedAssetId: asset.id,
        sequenceNumber: row.sequenceNumber,
        periodEndDate,
        depreciationAmount: row.depreciationAmount,
        accumulatedDepreciation: row.accumulatedDepreciation,
        netBookValue: row.netBookValue,
      },
    });
  }

  return { asset };
}

async function seedDocuments(companyId: string, invoiceId: string | undefined, adminRoleId: string) {
  if (invoiceId) {
    const existing = await prisma.document.findFirst({ where: { companyId, attachableType: "Invoice", attachableId: invoiceId } });
    if (!existing) {
      await prisma.document.create({
        data: {
          companyId,
          attachableType: "Invoice",
          attachableId: invoiceId,
          fileName: "facture-signee.pdf",
          fileUrl: "demo://documents/facture-signee.pdf",
          mimeType: "application/pdf",
        },
      });
    }
  }

  // Any purchase order at or above 500 000 XOF is held for approval by an Administrateur Général.
  const existingRule = await prisma.approvalRule.findFirst({ where: { companyId, appliesTo: "PURCHASE_ORDER" } });
  if (!existingRule) {
    await prisma.approvalRule.create({ data: { companyId, appliesTo: "PURCHASE_ORDER", minAmount: 500000, requiredRoleId: adminRoleId } });
  }
}

async function main() {
  await seedCurrency();
  await seedPermissions();
  await seedDefaultRoles();
  const { company, store, register, cashier, admin, products } = await seedDemoTenant();
  const accounting = await seedAccounting(company.id);
  const payroll = await seedPayroll(company.id, cashier.id);
  const hr = await seedHrExtras(company.id, payroll.employee.id);
  const bank = await seedBankReconciliationDemo(company.id, accounting.bankAccount.id);
  const crm = await seedCrm(company.id, admin.id);
  const supplyChain = await seedSupplyChain(company.id, products["DEMO-004"]);
  const logistics = await seedLogistics(company.id, store.id, crm.customers[0]?.id);
  const treasury = await seedTreasury(company.id, register);
  const creditControl = await seedCreditControl(company.id, crm.customers);
  const fixedAssets = await seedFixedAssets(company.id);
  const adminRole = await prisma.role.findFirstOrThrow({ where: { companyId: null, name: "Administrateur Général" } });
  await seedDocuments(company.id, creditControl.invoice?.id, adminRole.id);

  // eslint-disable-next-line no-console
  console.log(`
Seed complete.

Demo tenant : ${company.name} (${company.id})
Store       : ${store.name} (${store.id})
Register    : ${register.name} (${register.id})

Login
  admin@ixoris.dev    / ${DEMO_ADMIN_PASSWORD}    (Administrateur Général, tous magasins)
  caissier@ixoris.dev / ${DEMO_CASHIER_PASSWORD}  (Caissier, scope: ${store.name})
  livreur@ixoris.dev  / ${DEMO_DRIVER_PASSWORD}   (Livreur, scope: ${store.name})

4 demo products seeded with barcodes 6180000000011/28/35/42, 100 units each in "${store.name}".

Accounting : ${accounting.accountCount} accounts (plan SYSCOHADA), ${accounting.journalCount} journals, ${accounting.fiscalYear.label} (12 periods).
Payroll    : ${payroll.componentCount} salary components, employee ${payroll.employee.employeeNumber} (${payroll.employee.firstName} ${payroll.employee.lastName}) with a CDI contract.
HR         : ${hr.leaveTypeCount} leave types, 1 approved unpaid leave request (2 days this month — try a payroll run to see it prorate the base salary).
Bank       : 1 demo statement (${bank.statementLines} lines) on ${accounting.bankAccount.bankName} — try POST /accounting/bank-statements/:id/auto-match (1 of 2 lines should match).
CRM        : ${crm.customerCount} demo customers (one overdue invoice, one open opportunity).
Supply chain: ${supplyChain.supplierCount} suppliers with competing quotes on "Eau minérale 1.5L" (stock 8, below its threshold of 20) — try POST /supply-chain/reorder-check/run to see the auto-PO pick the cheapest one. Purchase orders ≥ 500 000 XOF now need an Administrateur Général to approve before they can be sent.
Logistics  : ${logistics.zoneCount} delivery zones, 1 demo delivery assigned to ${logistics.driverEmail} / ${DEMO_DRIVER_PASSWORD}.
Treasury   : petty cash box "${treasury.pettyCash.name}" with 1 unposted deposit and 1 pending transfer — try POST /treasury/cashboxes/movements/:movementId/post and POST /treasury/transfers/:id/complete to post them.
Credit control: Restaurant Le Baobab is auto-blocked (encours > limite de crédit) from its overdue invoice; Supermarché Koné has a healthy 3-installment schedule on a fresh 600 000 XOF invoice.
Fixed assets: 1 vehicle (Toyota Hilux, 15M XOF, dégressif sur 5 ans) with its full depreciation plan generated — try POST /fixed-assets/depreciation/run once its first exercise is due.
GED        : 1 document attached to Koné's invoice; purchase orders ≥ 500 000 XOF are held for Administrateur Général approval (POST /approvals/requests/:id/decide).
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
