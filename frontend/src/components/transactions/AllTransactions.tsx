import { useState, type ReactElement } from 'react';
import type { Transaction } from '../../types';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { TransactionFilters, type TransactionTypeFilter } from './TransactionFilters';
import { TransactionTable } from './TransactionTable';

export function AllTransactions({
  transactions,
  categories,
  onCategoryChange,
}: {
  transactions: Transaction[];
  categories: string[];
  onCategoryChange: (transactionId: string, category: string) => void;
}): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(null);
  const outgoingRows = transactions.filter((transaction) => transaction.type === 'Ausgang');
  const incomeRows = transactions.filter((transaction) => transaction.type === 'Eingang');
  const activeCategories = selectedCategories ?? categories;
  const expenseRows = outgoingRows.filter((transaction) =>
    activeCategories.includes(transaction.category),
  );
  const displayedRows =
    typeFilter === 'income' ? incomeRows : typeFilter === 'expenses' ? expenseRows : transactions;
  const selectedTransaction = selectedId
    ? (transactions.find((transaction) => transaction.id === selectedId) ?? null)
    : null;

  return (
    <section id="all-transactions-tab" className="tab-panel">
      <div className="period-header">
        <div>
          <span className="eyebrow accent-eyebrow">Transactions</span>
          <h2 className="period-title">Every imported transaction</h2>
          <p className="muted period-subtitle">All periods, income, and expenses are shown here.</p>
        </div>
      </div>
      <TransactionFilters
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        categories={categories}
        selectedCategories={selectedCategories}
        onCategoryFilterChange={setSelectedCategories}
        showAll
      />
      <article className="panel transactions-panel">
        <TransactionTable rows={displayedRows} onSelect={setSelectedId} />
      </article>
      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          categories={categories}
          onClose={() => setSelectedId(null)}
          onCategoryChange={onCategoryChange}
        />
      )}
    </section>
  );
}
