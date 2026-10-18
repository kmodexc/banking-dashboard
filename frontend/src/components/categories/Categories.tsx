import type { ReactElement } from 'react';
import { RuleList } from '../rules/RuleList';
import type { RulesController } from '../rules/ruleTypes';
import { CategoryEditor } from './CategoryEditor';
import type { CategoriesController } from './categoryTypes';

export function Categories({
  categoriesController,
  rulesController,
}: {
  categoriesController: CategoriesController;
  rulesController: RulesController;
}): ReactElement {
  return (
    <section id="categories-tab" className="tab-panel">
      <CategoryEditor categoriesController={categoriesController} />
      <RuleList rulesController={rulesController} />
    </section>
  );
}
