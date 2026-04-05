import { DataSource } from 'typeorm';
import { Expense } from '../../modules/financial/entity/expense.entity';
import { FinancialReport } from '../../modules/financial/entity/financial-report.entity';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';

export const seedDemoFinancial = async (
  dataSource: DataSource,
  aircraft: Aircraft[],
): Promise<void> => {
  const expenseRepository = dataSource.getRepository(Expense);
  const reportRepository = dataSource.getRepository(FinancialReport);

  const now = new Date();

  const demoExpenses = [
    // Carburant
    {
      expense_date: new Date(now.getTime() - 2 * 24 * 3600000),
      amount: 1250.00,
      category: 'Carburant',
      sub_category: '100LL',
      description: 'Avitaillement 510L de 100LL - citerne club',
      aircraft: aircraft[0],
    },
    {
      expense_date: new Date(now.getTime() - 8 * 24 * 3600000),
      amount: 890.00,
      category: 'Carburant',
      sub_category: 'JET-A1',
      description: 'Avitaillement 320L de JET-A1 pour Diamond DA40',
      aircraft: aircraft[3],
    },
    // Assurances
    {
      expense_date: new Date(now.getFullYear(), 0, 15),
      amount: 8500.00,
      category: 'Assurance',
      sub_category: 'Flotte',
      description: 'Prime annuelle assurance flotte 6 appareils - Allianz Aviation',
    },
    {
      expense_date: new Date(now.getFullYear(), 0, 15),
      amount: 2200.00,
      category: 'Assurance',
      sub_category: 'Responsabilité civile',
      description: 'RC exploitation aérodrome - couverture 5M€',
    },
    // Maintenance
    {
      expense_date: new Date(now.getTime() - 30 * 24 * 3600000),
      amount: 850.00,
      category: 'Maintenance',
      sub_category: 'Inspection',
      description: 'Visite annuelle Cessna 172 F-GSKY',
      aircraft: aircraft[0],
    },
    {
      expense_date: new Date(now.getTime() - 20 * 24 * 3600000),
      amount: 2200.00,
      category: 'Maintenance',
      sub_category: 'Réparation',
      description: 'Remplacement train avant Piper PA-28 F-HCRE',
      aircraft: aircraft[1],
    },
    {
      expense_date: new Date(now.getTime() - 10 * 24 * 3600000),
      amount: 450.00,
      category: 'Maintenance',
      sub_category: 'Avionique',
      description: 'Mise à jour Garmin G1000 NXi Diamond DA40',
      aircraft: aircraft[3],
    },
    // Hangar et infrastructure
    {
      expense_date: new Date(now.getFullYear(), 0, 1),
      amount: 3600.00,
      category: 'Infrastructure',
      sub_category: 'Location hangar',
      description: 'Loyer trimestriel hangar principal - T1 2026',
    },
    {
      expense_date: new Date(now.getTime() - 45 * 24 * 3600000),
      amount: 320.00,
      category: 'Infrastructure',
      sub_category: 'Électricité',
      description: 'Facture électricité hangar et club-house - Janvier',
    },
    // Formation
    {
      expense_date: new Date(now.getTime() - 60 * 24 * 3600000),
      amount: 1200.00,
      category: 'Formation',
      sub_category: 'Instructeur',
      description: 'Stage recyclage instructeur FI - Marie Laurent',
    },
    // Divers
    {
      expense_date: new Date(now.getTime() - 25 * 24 * 3600000),
      amount: 180.00,
      category: 'Entretien',
      sub_category: 'Nettoyage',
      description: 'Nettoyage complet Robin DR400 F-GAER',
      aircraft: aircraft[2],
    },
    {
      expense_date: new Date(now.getTime() - 40 * 24 * 3600000),
      amount: 450.00,
      category: 'Administratif',
      sub_category: 'Logiciel',
      description: 'Abonnement annuel base de données navigation Jeppesen',
    },
  ];

  for (const data of demoExpenses) {
    const expense = expenseRepository.create(data);
    await expenseRepository.save(expense);
  }

  // Financial reports mensuels
  const demoReports = [
    {
      report_date: new Date(now.getFullYear(), 0, 31),
      total_revenue: 12450.00,
      total_expense: 18520.00,
      net_profit: -6070.00,
      recommendations: 'Mois de janvier traditionnellement déficitaire (cotisations vs primes assurance annuelles). Situation normale.',
      average_revenue_per_member: 415.00,
    },
    {
      report_date: new Date(now.getFullYear(), 1, 28),
      total_revenue: 8920.00,
      total_expense: 5340.00,
      net_profit: 3580.00,
      recommendations: 'Activité de vol en hausse par rapport à N-1. Bonne maîtrise des coûts de maintenance.',
      average_revenue_per_member: 297.33,
    },
    {
      report_date: new Date(now.getFullYear(), 2, 31),
      total_revenue: 11280.00,
      total_expense: 7650.00,
      net_profit: 3630.00,
      recommendations: 'Excellente activité avec le retour des beaux jours. Prévoir budget maintenance été (visites 100h Tecnam et Cirrus).',
      average_revenue_per_member: 376.00,
    },
  ];

  for (const data of demoReports) {
    const report = reportRepository.create(data);
    await reportRepository.save(report);
  }

  console.log(`${demoExpenses.length} demo expenses and ${demoReports.length} demo financial reports created`);
};
