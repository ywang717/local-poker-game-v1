import type { CareerState } from './careerState';
import type { PendingCashBuyIn, FinancialTransaction } from './transactionTypes';
export type { PendingCashBuyIn, FinancialTransaction } from './transactionTypes';

type ReserveRequest = { transactionId: string; sessionId: string; requestedAmount?: number; amount?: number; kind?: FinancialTransaction['kind'] };
export type TransactionResult = { career: CareerState; pending: PendingCashBuyIn; transaction: FinancialTransaction; duplicate: boolean };
function clone<T>(v: T): T { return structuredClone(v); }
function validAmount(amount: number): boolean { return Number.isSafeInteger(amount) && amount > 0; }
function ensureLedger(career: CareerState): CareerState { return { ...career, financialTransactions: career.financialTransactions ?? [], pendingCashBuyIns: career.pendingCashBuyIns ?? [] }; }
function appendRefundTransaction(career: CareerState, pending: PendingCashBuyIn, amount: number): void {
  if (amount <= 0 || career.financialTransactions.some((entry) => entry.transactionId === `${pending.transactionId}:refund`)) return;
  career.financialTransactions.push({ transactionId: `${pending.transactionId}:refund`, sessionId: pending.sessionId, kind: 'BUY_IN_REFUND', amount, status: 'APPLIED', createdAt: new Date().toISOString() });
}
export function reserveFunds(career: CareerState, request: ReserveRequest): TransactionResult {
  const amount = request.requestedAmount ?? request.amount;
  if (!request.transactionId || !request.sessionId) throw new Error('Transaction and session IDs are required');
  if (!validAmount(amount ?? NaN)) throw new Error('Transaction amount must be a positive safe integer');
  const source = ensureLedger(clone(career));
  const existing = source.pendingCashBuyIns.find((p) => p.transactionId === request.transactionId);
  const existingTx = source.financialTransactions.find((t) => t.transactionId === request.transactionId);
  if (existing && existingTx) return { career: source, pending: existing, transaction: existingTx, duplicate: true };
  if (source.financialTransactions.some((t) => t.transactionId === request.transactionId) || source.pendingCashBuyIns.some((p) => p.transactionId === request.transactionId)) throw new Error('Duplicate transaction ID');
  if (source.currentFunds < amount!) throw new Error('Insufficient career funds');
  const pending: PendingCashBuyIn = { transactionId: request.transactionId, sessionId: request.sessionId, requestedAmount: amount!, reservedAmount: amount!, status: 'PENDING' };
  const transaction: FinancialTransaction = { transactionId: request.transactionId, sessionId: request.sessionId, kind: request.kind ?? 'TOP_UP', amount: amount!, status: 'APPLIED', createdAt: new Date().toISOString() };
  source.currentFunds -= amount!;
  source.pendingCashBuyIns.push(pending); source.financialTransactions.push(transaction);
  return { career: source, pending, transaction, duplicate: false };
}
export function refundPendingCashBuyIn(career: CareerState, transactionId: string): CareerState {
  const source = ensureLedger(clone(career));
  const pending = source.pendingCashBuyIns.find((p) => p.transactionId === transactionId);
  if (!pending || pending.status !== 'PENDING') return source;
  if (!validAmount(pending.reservedAmount) || !validAmount(pending.requestedAmount)) throw new Error('Invalid pending cash buy-in amount');
  pending.status = 'REFUNDED'; source.currentFunds += pending.reservedAmount;
  appendRefundTransaction(source, pending, pending.reservedAmount);
  const tx = source.financialTransactions.find((t) => t.transactionId === transactionId);
  if (tx) tx.status = 'REFUNDED';
  return source;
}
