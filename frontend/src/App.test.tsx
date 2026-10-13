import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const csv = [
  'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
  '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
].join('\n');

const csvWithNextUnknown = [
  'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
  '03.01.2026;03.01.2026;Kartenzahlung;;NEXT SHOP;Sonstiges;Ausgang;;-12,00;;;',
  '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
].join('\n');

describe('dashboard UI', () => {
  beforeEach(() => {
    localStorage.clear();
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
    expect(fetch).toHaveBeenCalledTimes(1);
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
