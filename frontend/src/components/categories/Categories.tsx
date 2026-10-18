import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { RuleList } from '../rules/RuleList';
import type { RulesController } from '../rules/ruleTypes';
import { CategoryEditor } from './CategoryEditor';
import type { CategoriesController } from './categoryTypes';

export function Categories({
  categoriesController,
  rulesController,
  transactions = [],
}: {
  categoriesController: CategoriesController;
  rulesController: RulesController;
  transactions?: Transaction[];
}): ReactElement {
  return (
    <section id="categories-tab" className="tab-panel">
      <CategoryEditor categoriesController={categoriesController} />
      <RuleList rulesController={rulesController} transactions={transactions} />
    </section>
  );
}
