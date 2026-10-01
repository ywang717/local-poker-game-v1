import type { MatchSession } from '../match/matchTypes';
import { getTableLevel, type TableLevelId } from './tableLevels';
import type { CareerState } from './careerState';
import type { PendingCashBuyIn, FinancialTransaction } from './transactionTypes';

export type CashBuyInOption = {
  targetStack: number;
  amount: number;
  label: string;
  affordable: boolean;
};

function clone<T>(value: T): T { return structuredClone(value); }
function safePositive(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }
function safeNonNegative(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function ledger(career: CareerState): CareerState {
  const next = clone(career);
  next.financialTransactions = next.financialTransactions ?? [];
  next.pendingCashBuyIns = next.pendingCashBuyIns ?? [];
  return next;
}
function appendRefundTransaction(career: CareerState, pending: PendingCashBuyIn, amount: number): void {
  if (amount <= 0 || career.financialTransactions.some((entry) => entry.transactionId === `${pending.transactionId}:refund`)) return;
  const transaction: FinancialTransaction = {
    transactionId: `${pending.transactionId}:refund`,
    sessionId: pending.sessionId,
    kind: 'BUY_IN_REFUND',
    amount,
    status: 'APPLIED',
    createdAt: new Date().toISOString(),
  };
  career.financialTransactions.push(transaction);
}
function makeId(): string { return globalThis.crypto?.randomUUID?.() ?? `cash-buyin-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function getCashBuyInOptions(tableLevel: TableLevelId, tableStack: number, currentFunds: number, customTargetStack?: number): CashBuyInOption[] {
  const level = getTableLevel(tableLevel);
  if (!safeNonNegative(tableStack)) throw new Error('Table stack must be a non-negative safe integer');
  if (!safeNonNegative(currentFunds)) throw new Error('Current funds must be a non-negative safe integer');
  const cap = level.bigBlind * 100;
  const targets = [25, 50, 100].map((bbs) => level.bigBlind * bbs);
  if (customTargetStack !== undefined) {
    if (!safePositive(customTargetStack)) throw new Error('Custom target stack must be a positive safe integer');
    targets.push(customTargetStack);
  }
  return [...new Set(targets)].map((targetStack) => {
    const amount = Math.max(0, targetStack - tableStack);
    const bbs = targetStack / level.bigBlind;
    return { targetStack, amount, label: Number.isInteger(bbs) ? `${bbs}BB` : `${targetStack}`, affordable: amount > 0 && amount <= currentFunds && targetStack <= cap };
  }).filter((option) => option.amount > 0);
}

export type CashBuyInRequest = { transactionId?: string };

export function requestCashBuyIn(career: CareerState, session: MatchSession, targetStack: number, request: CashBuyInRequest = {}): { career: CareerState; pending: PendingCashBuyIn } {
  if (!session || session.matchType !== 'CASH' || !session.sessionId) throw new Error('Cash buy-in requires an active cash session');
  if (!safePositive(targetStack)) throw new Error('Target stack must be a positive safe integer');
  const level = getTableLevel(session.tableLevel);
  const currentStack = career.activeTableStack;
  if (currentStack === null || !safeNonNegative(currentStack)) throw new Error('Career is not seated at a cash table');
  const cap = level.bigBlind * 100;
  if (targetStack > cap) throw new Error('Cash table stack cannot exceed 100BB');
  if (targetStack <= currentStack) throw new Error('Target stack must exceed the current table stack');
  const amount = targetStack - currentStack;
  if (!safePositive(amount)) throw new Error('Buy-in amount must be positive');
  const source = ledger(career);
  const transactionId = request.transactionId ?? makeId();
  const existing = source.pendingCashBuyIns.find((entry) => entry.transactionId === transactionId);
  if (existing) {
    if (existing.sessionId !== session.sessionId || existing.requestedAmount !== amount) throw new Error('Duplicate transaction ID');
    return { career: source, pending: existing };
  }
  const existingTx = source.financialTransactions.find((entry) => entry.transactionId === transactionId);
  if (existingTx) throw new Error('Duplicate transaction ID');
  if (source.currentFunds < amount) throw new Error('Insufficient career funds');
  const pending: PendingCashBuyIn = { transactionId, sessionId: session.sessionId, requestedAmount: amount, reservedAmount: amount, maxStack: cap, status: 'PENDING' };
  const transaction: FinancialTransaction = { transactionId, sessionId: session.sessionId, kind: 'TOP_UP', amount, status: 'APPLIED', createdAt: new Date().toISOString() };
  source.currentFunds -= amount;
  source.pendingCashBuyIns.push(pending);
  source.financialTransactions.push(transaction);
  return { career: source, pending };
}

export function applyPendingCashBuyIn(career: CareerState, pending: PendingCashBuyIn, settledStack: number): { career: CareerState; appliedAmount: number; refundedAmount: number } {
  if (!safeNonNegative(settledStack)) throw new Error('Settled stack must be a non-negative safe integer');
  const source = ledger(career);
  const stored = source.pendingCashBuyIns.find((entry) => entry.transactionId === pending.transactionId) ?? pending;
  if (stored.status === 'APPLIED' || stored.status === 'REFUNDED') return { career: source, appliedAmount: stored.appliedAmount ?? 0, refundedAmount: stored.refundedAmount ?? 0 };
  if (!safePositive(stored.requestedAmount) || !safePositive(stored.reservedAmount)) throw new Error('Invalid pending cash buy-in amount');
  const maxAdditional = Math.max(0, (stored.maxStack ?? Number.MAX_SAFE_INTEGER) - settledStack);
  const appliedAmount = Math.min(stored.requestedAmount, maxAdditional);
  const refundedAmount = stored.reservedAmount - appliedAmount;
  source.currentFunds += refundedAmount;
  appendRefundTransaction(source, stored, refundedAmount);
  stored.status = 'APPLIED'; stored.appliedAmount = appliedAmount; stored.refundedAmount = refundedAmount;
  const tx = source.financialTransactions.find((entry) => entry.transactionId === stored.transactionId);
  if (tx) tx.status = 'APPLIED';
  return { career: source, appliedAmount, refundedAmount };
}

export function cancelPendingCashBuyIn(career: CareerState, transactionId: string): CareerState {
  const source = ledger(career);
  const pending = source.pendingCashBuyIns.find((entry) => entry.transactionId === transactionId);
  if (!pending || pending.status !== 'PENDING') return source;
  if (!safePositive(pending.reservedAmount)) throw new Error('Invalid pending cash buy-in amount');
  pending.status = 'REFUNDED'; pending.refundedAmount = pending.reservedAmount;
  source.currentFunds += pending.reservedAmount;
  appendRefundTransaction(source, pending, pending.reservedAmount);
  const tx = source.financialTransactions.find((entry) => entry.transactionId === transactionId);
  if (tx) tx.status = 'REFUNDED';
  return source;
}

export function syncActiveTableStack(career: CareerState, stack: number): CareerState {
  if (!safeNonNegative(stack)) throw new Error('Table stack must be a non-negative safe integer');
  const next = ledger(career);
  next.activeTableStack = stack;
  return next;
}
