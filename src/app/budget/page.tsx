import { MonthlyBudgetSetup } from '@/components/budget/MonthlyBudgetSetup';

export const metadata = {
  title: 'Monthly Budget Setup | SaveMoney',
  description: 'Setup your monthly income, fixed bills, EMIs, and savings target.',
};

export default function BudgetPage() {
  return <MonthlyBudgetSetup />;
}
