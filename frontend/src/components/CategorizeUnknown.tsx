import { useState, type ReactElement } from 'react';
import { OidcClient } from '../auth';
import { DEFAULT_CATEGORIES } from '../types';
import type {
  AuthSnapshot,
  CategoryRule,
  ClassificationRule,
  RuleColumn,
  Transaction,
} from '../types';
import { matchesRule, unknownTransactions } from '../data/rules';
import { AiSuggestions } from './AiSuggestions';
import { LocalRuleForm } from './LocalRuleForm';
import { RuleSummaryList } from './RuleSummaryList';
import { UnknownTransactionPicker } from './UnknownTransactionPicker';

export function CategorizeUnknown({
  transactions,
  rules,
  auth,
  client,
  onAddRule,
  onAddRules,
  userRules,
  categories: availableCategories = [...DEFAULT_CATEGORIES],
}: {
  transactions: Transaction[];
  rules: CategoryRule[];
  auth: AuthSnapshot;
  client: OidcClient;
  onAddRule: (rule: CategoryRule) => void;
  onAddRules: (rules: ClassificationRule[]) => void;
  userRules: CategoryRule[];
  categories?: string[];
}): ReactElement {
  const unknown = unknownTransactions(transactions);
  const [selectedId, setSelectedId] = useState(unknown[0]?.id ?? '');
  const [keyword, setKeyword] = useState(unknown[0]?.recipient ?? '');
  const [category, setCategory] = useState('');
  const [column, setColumn] = useState<RuleColumn>('recipient');
  const selected = unknown.find((row) => row.id === selectedId) ?? unknown[0];
  const categories = [...new Set([...availableCategories, ...rules.map((rule) => rule.category)])];

  function selectTransaction(transaction: Transaction | undefined): void {
    setSelectedId(transaction?.id ?? '');
    setKeyword(transaction?.recipient ?? '');
  }

  function addRule(rule: CategoryRule): void {
    selectTransaction(unknown.find((transaction) => !matchesRule(transaction, rule)));
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
          <LocalRuleForm
            keyword={keyword}
            category={category}
            column={column}
            categories={categories}
            onKeywordChange={setKeyword}
            onCategoryChange={setCategory}
            onColumnChange={setColumn}
            onAddRule={addRule}
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
      <RuleSummaryList rules={userRules} />
    </section>
  );
}
