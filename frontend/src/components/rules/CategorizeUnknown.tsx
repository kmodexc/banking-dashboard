import { useState, type ReactElement } from 'react';
import { OidcClient } from '../../auth';
import type { AuthSnapshot, CategoryRule, ClassificationRule, Transaction } from '../../types';
import { matchesRule, unknownTransactions } from '../../data/rules';
import { AiSuggestions } from './AiSuggestions';
import { RuleForm } from './RuleForm';
import { RuleList } from './RuleList';
import { UnknownTransactionPicker } from './UnknownTransactionPicker';
import type { RulesController } from './ruleTypes';

export function CategorizeUnknown({
  transactions,
  rules,
  auth,
  client,
  onAddRule,
  onAddRules,
  rulesController,
  categories: availableCategories = [],
}: {
  transactions: Transaction[];
  rules: CategoryRule[];
  auth: AuthSnapshot;
  client: OidcClient;
  onAddRule: (rule: CategoryRule) => void;
  onAddRules: (rules: ClassificationRule[]) => void;
  rulesController: RulesController;
  categories?: string[];
}): ReactElement {
  const unknown = unknownTransactions(transactions);
  const [selectedId, setSelectedId] = useState(unknown[0]?.id ?? '');
  const selected = unknown.find((row) => row.id === selectedId) ?? unknown[0];
  const categories = [...new Set([...availableCategories, ...rules.map((rule) => rule.category)])];
  const categoryOptions = categories.map((value) => ({ value, label: value }));

  function selectTransaction(transaction: Transaction | undefined): void {
    setSelectedId(transaction?.id ?? '');
  }

  function addRule(rule: CategoryRule): void {
    const selectedIndex = selected ? unknown.findIndex((row) => row.id === selected.id) : -1;
    const following = unknown.slice(selectedIndex + 1);
    const preceding = unknown.slice(0, Math.max(selectedIndex, 0));
    const nextTransaction =
      following.find((transaction) => !matchesRule(transaction, rule)) ??
      preceding.find((transaction) => !matchesRule(transaction, rule));
    selectTransaction(nextTransaction);
    onAddRule(rule);
  }

  return (
    <section id="unknown-tab" className="tab-panel">
      <div className="content-grid two-columns">
        <UnknownTransactionPicker
          transactions={unknown}
          selected={selected}
          onSelect={selectTransaction}
        />
        <article className="panel">
          <RuleForm
            key={selected?.id ?? 'new-rule'}
            initialValues={{ keyword: selected?.recipient ?? '' }}
            categories={categoryOptions}
            onAdd={addRule}
          />
          <AiSuggestions
            transactions={unknown}
            categories={categories}
            auth={auth}
            client={client}
            onAddRules={onAddRules}
          />
        </article>
      </div>
      <RuleList rulesController={rulesController} />
    </section>
  );
}
