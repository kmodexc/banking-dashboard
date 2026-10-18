import { useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { readTransactions } from '../data/csv';
import { loadSessionTransactions, saveSessionTransactions } from '../data/session';
import type { Transaction } from '../types';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function useTransactions(): {
  transactions: Transaction[];
  period: string;
  setPeriod: Dispatch<SetStateAction<string>>;
  loadError: string;
  handleFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  clearTransactions: () => void;
} {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadSessionTransactions());
  const [period, setPeriod] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    saveSessionTransactions(transactions);
  }, [transactions]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const next = await readTransactions(file);
      setTransactions(next);
      setPeriod(next[0]?.period ?? '');
      setLoadError('');
    } catch (error: unknown) {
      setLoadError(errorMessage(error));
    }
  }

  function clearTransactions(): void {
    setTransactions([]);
    setPeriod('');
    setLoadError('');
  }

  return { transactions, period, setPeriod, loadError, handleFile, clearTransactions };
}
