export const MAX_VISUAL_PERCENTAGE = 150;

export type PlanView = 'list' | 'chart' | 'boxplot';

export interface PlanBudgetHistory {
  months: number;
  min: number;
  q1: number;
  median: number;
  average: number;
  q3: number;
  max: number;
}

export interface PlanBudgetRow {
  category: string;
  spent: number;
  budget: number;
  hasMonthlyBudget: boolean;
  percentage: number | null;
  history: PlanBudgetHistory | null;
}

export interface PlanViewProps {
  rows: PlanBudgetRow[];
}
