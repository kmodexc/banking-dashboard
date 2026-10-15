import type { ReactElement } from 'react';
import type { CategoryRule } from '../types';

export function RuleSummaryList({ rules }: { rules: CategoryRule[] }): ReactElement {
  return (
    <section className="panel recent-rules" aria-labelledby="recent-rules-heading">
      <h2 id="recent-rules-heading">Recently added rules</h2>
      {rules.length ? (
        <ol className="recent-rule-list" aria-label="Recently added rules">
          {rules.map((rule) => (
            <li className="recent-rule" key={`${rule.keyword}-${rule.category}-${rule.column}`}>
              <strong>{rule.keyword}</strong>
              <span className="recent-rule-category">{rule.category}</span>
              <span className="recent-rule-column">Searches {rule.column}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No rules added yet.</p>
      )}
    </section>
  );
}
