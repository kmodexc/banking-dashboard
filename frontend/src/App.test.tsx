import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { TRANSACTIONS_SESSION_KEY } from './data/session';

const csv = [
  'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
  '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
].join('\n');

const csvWithNextUnknown = [
  'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
  '03.01.2026;03.01.2026;Kartenzahlung;;NEXT SHOP;Sonstiges;Ausgang;;-12,00;;;',
  '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
].join('\n');

const csvWithIncome = [
  'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
  '02.01.2026;02.01.2026;Gehalt;;SALARY;Monthly salary;Eingang;;1000,00;;;',
  '01.01.2026;01.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
].join('\n');

describe('dashboard UI', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith('default-rules.json')) {
          return Promise.resolve(new Response('[]', { status: 200 }));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );
  });

  it('imports a CSV and shows its transactions', async () => {
    render(<App />);
    const input = screen.getByLabelText<HTMLInputElement>('Choose CSV export');
    fireEvent.change(input, {
      target: { files: [new File([csv], 'transactions.csv', { type: 'text/csv' })] },
    });
    expect(await screen.findByText('1 transactions loaded')).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN SHOP')).toBeInTheDocument();
  });

  it.each(['1,234', '', '1.23.456,78'])(
    'shows an import error and the offending line for %j',
    async (amount) => {
      render(<App />);
      const invalidCsv = csv.replace('-8,00', amount);
      fireEvent.change(screen.getByLabelText<HTMLInputElement>('Choose CSV export'), {
        target: { files: [new File([invalidCsv], 'invalid.csv', { type: 'text/csv' })] },
      });
      const error = await screen.findByRole('alert');
      expect(error).toHaveTextContent('Line 2:');
      expect(error).toHaveTextContent(invalidCsv.split('\n')[1]!);
      expect(screen.queryByText('1 transactions loaded')).not.toBeInTheDocument();
    },
  );

  it('imports a DKB amount with a thousands dot and no decimal cents', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Choose CSV export'), {
      target: {
        files: [new File([csv.replace('-8,00', '-1.480')], 'rent.csv', { type: 'text/csv' })],
      },
    });
    expect(await screen.findByText('1 transactions loaded')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem(TRANSACTIONS_SESSION_KEY)).not.toBeNull());
    const stored: unknown = JSON.parse(sessionStorage.getItem(TRANSACTIONS_SESSION_KEY)!);
    expect(stored).toEqual([expect.objectContaining({ amount: -1480 })]);
  });

  it('shows income only in the top aggregate, not in categories or the transaction list', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Choose CSV export'), {
      target: { files: [new File([csvWithIncome], 'income.csv', { type: 'text/csv' })] },
    });

    expect(await screen.findByText('2 transactions loaded')).toBeInTheDocument();
    expect(screen.queryByText('SALARY')).not.toBeInTheDocument();
    expect(screen.getByText('€1,000.00')).toBeInTheDocument();
    expect(screen.getByText('€992.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Income', pressed: false }));
    expect(screen.getByText('SALARY')).toBeInTheDocument();
    expect(screen.queryByText('UNKNOWN SHOP')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'unknown' }));
    expect(screen.getByRole('button', { name: 'Expenses', pressed: true })).toBeInTheDocument();
    expect(screen.queryByText('SALARY')).not.toBeInTheDocument();
    const metrics = within(document.querySelector('#metrics')!);
    expect(metrics.getAllByText('€1,000.00')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'All transactions' }));
    expect(screen.getByText('SALARY')).toBeInTheDocument();
    expect(screen.getByText('Income', { selector: '.type-badge' })).toBeInTheDocument();
    expect(screen.getByText('2 rows · click a row for details')).toBeInTheDocument();
  });

  it('restores imported transactions after a page reload', async () => {
    sessionStorage.setItem(
      TRANSACTIONS_SESSION_KEY,
      JSON.stringify([
        {
          id: '2026-01-02-1',
          date: '2026-01-02',
          period: '2026-01',
          recipient: 'RESTORED SHOP',
          purpose: 'Sonstiges',
          type: 'Ausgang',
          amount: -8,
          category: 'unknown',
        },
      ]),
    );

    render(<App />);

    expect(await screen.findByText('1 transactions loaded')).toBeInTheDocument();
    expect(screen.getByText('RESTORED SHOP')).toBeInTheDocument();
  });

  it('does not call the API for a local rule', async () => {
    render(<App />);
    const input = screen.getByLabelText<HTMLInputElement>('Choose CSV export');
    fireEvent.change(input, {
      target: { files: [new File([csv], 'transactions.csv', { type: 'text/csv' })] },
    });
    await screen.findByText('1 transactions loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Categorize unknown' }));
    fireEvent.click(screen.getByRole('radio', { name: 'items' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Save rule' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('0 rows')).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem('dkb-dashboard-rules-v1')).toContain('"category":"items"');
  });

  it('updates the keyword and research links when another unknown entry is selected', async () => {
    render(<App />);
    const input = screen.getByLabelText<HTMLInputElement>('Choose CSV export');
    fireEvent.change(input, {
      target: {
        files: [new File([csvWithNextUnknown], 'transactions.csv', { type: 'text/csv' })],
      },
    });
    await screen.findByText('2 transactions loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Categorize unknown' }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Unknown transaction' }), {
      target: { value: '2026-01-02-2' },
    });

    expect(screen.getByRole('textbox', { name: 'Keyword' })).toHaveValue('UNKNOWN SHOP');
    expect(screen.getByText('UNKNOWN SHOP', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Search the web for this recipient/ })).toHaveAttribute(
      'href',
      'https://www.google.com/search?q=UNKNOWN%20SHOP',
    );
  });

  it('selects the next unknown transaction and fills its recipient after saving a rule', async () => {
    render(<App />);
    const input = screen.getByLabelText<HTMLInputElement>('Choose CSV export');
    fireEvent.change(input, {
      target: {
        files: [new File([csvWithNextUnknown], 'transactions.csv', { type: 'text/csv' })],
      },
    });
    await screen.findByText('2 transactions loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Categorize unknown' }));
    fireEvent.click(screen.getByRole('radio', { name: 'items' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Save rule' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Keyword' })).toHaveValue('UNKNOWN SHOP');
      expect(screen.getByText('UNKNOWN SHOP', { selector: 'strong' })).toBeInTheDocument();
    });
    expect(screen.getByText('1 rows')).toBeInTheDocument();
  });

  it('shows the categories page with user changes locked while signed out', async () => {
    render(<App />);
    const input = screen.getByLabelText<HTMLInputElement>('Choose CSV export');
    fireEvent.change(input, {
      target: { files: [new File([csv], 'transactions.csv', { type: 'text/csv' })] },
    });
    await screen.findByText('1 transactions loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Categories' }));

    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export categories' })).toBeDisabled();
    expect(
      screen.getByText(/Sign in to add, rename, delete, import, or export/),
    ).toBeInTheDocument();
  });
});
