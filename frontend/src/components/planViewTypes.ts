export const MAX_VISUAL_PERCENTAGE = 150;

export interface PlanBudgetRow {
  category: string;
  spent: number;
  budget: number;
  hasMonthlyBudget: boolean;
  percentage: number | null;
}

export interface PlanViewProps {
  rows: PlanBudgetRow[];
}
