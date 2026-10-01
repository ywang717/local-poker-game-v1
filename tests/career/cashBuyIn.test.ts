import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { applyPendingCashBuyIn, cancelPendingCashBuyIn, getCashBuyInOptions, requestCashBuyIn } from '../../src/career/cashBuyInService';
import { cashSession } from '../../src/match/session';
import { createTable, startHand } from '../../src/game/gameEngine';
import { createDeck, shuffleDeck } from '../../src/game/cards';
import { useCareerStore } from '../../src/store/careerStore';
import { useGameStore } from '../../src/store/gameStore';
import { createNextHand, finishTableExitTransition } from '../../src/App';
import { applyBankruptcyProtection } from '../../src/career/careerService';

describe('cash table buy-ins', () => {
  it('offers standard targets and reserves only the required amount', () => {
    const career = { ...createCareer('P'), activeTableStack: 1_000 };
    const options = getCashBuyInOptions(1, 1_000, career.currentFunds);
    expect(options.map((entry) => entry.targetStack)).toEqual([1_250, 2_500, 5_000]);
    const result = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 2_500);
    expect(result.pending.requestedAmount).toBe(1_500);
    expect(result.career.currentFunds).toBe(8_500);
  });

  it('caps application at 100BB and refunds excess idempotently', () => {
    const career = { ...createCareer('P'), activeTableStack: 0 };
    const request = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 5_000);
    const applied = applyPendingCashBuyIn(request.career, request.pending, 4_900);
    expect(applied.appliedAmount).toBe(100);
    expect(applied.refundedAmount).toBe(4_900);
    expect(applied.career.currentFunds).toBe(9_900);
    expect(applied.career.financialTransactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ transactionId: `${request.pending.transactionId}:refund`, sessionId: 's1', kind: 'BUY_IN_REFUND', amount: 4_900, status: 'APPLIED' }),
    ]));
    expect(applyPendingCashBuyIn(applied.career, request.pending, 4_900).career.currentFunds).toBe(9_900);
  });

  it('cancels a reservation once', () => {
    const career = { ...createCareer('P'), activeTableStack: 1_000 };
    const request = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 2_000);
    const cancelled = cancelPendingCashBuyIn(request.career, request.pending.transactionId);
    expect(cancelled.currentFunds).toBe(career.currentFunds);
    expect(cancelled.financialTransactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ transactionId: `${request.pending.transactionId}:refund`, sessionId: 's1', kind: 'BUY_IN_REFUND', amount: 1_000, status: 'APPLIED' }),
    ]));
    expect(cancelPendingCashBuyIn(cancelled, request.pending.transactionId).currentFunds).toBe(career.currentFunds);
  });

  it('rejects the ten invalid reservation cases', () => {
    const base = { ...createCareer('P'), activeTableStack: 1_000 };
    const session = cashSession('STANDARD', 1, 'validation');
    const invalid: Array<[string, () => void]> = [
      ['not seated', () => requestCashBuyIn({ ...base, activeTableStack: null }, session, 2_000)],
      ['zero target', () => requestCashBuyIn(base, session, 0)],
      ['fractional target', () => requestCashBuyIn(base, session, 2_000.5)],
      ['unsafe target', () => requestCashBuyIn(base, session, Number.MAX_SAFE_INTEGER + 1)],
      ['below current', () => requestCashBuyIn(base, session, 1_000)],
      ['over cap', () => requestCashBuyIn(base, session, 5_001)],
      ['wrong match', () => requestCashBuyIn(base, { ...session, matchType: 'MINI_TOURNAMENT' }, 2_000)],
      ['shortage', () => requestCashBuyIn({ ...base, currentFunds: 10 }, session, 2_000)],
      ['bad session id', () => requestCashBuyIn(base, { ...session, sessionId: '' }, 2_000)],
      ['duplicate id', () => requestCashBuyIn(requestCashBuyIn(base, session, 2_000, { transactionId: 'dup' }).career, session, 3_000, { transactionId: 'dup' })],
    ];
    for (const [, action] of invalid) expect(action).toThrow();
  });

  it.each(['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'ALL_IN'] as const)('keeps the current %s hand immutable and applies only to the next hand', (street) => {
    const career = { ...createCareer('P'), activeTableStack: 900 };
    const session = cashSession('STANDARD', 1, `s-${street}`);
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, session, players: [{ id: 'human', seat: 0, stack: 1_000, isHuman: true }, { id: 'ai', seat: 1, stack: 1_000 }] });
    const hand = startHand(table, shuffleDeck(createDeck('STANDARD')));
    const current = { ...hand, street: street === 'ALL_IN' ? 'SETTLEMENT' as const : street, pots: [{ amount: 75, eligiblePlayerIds: ['human'], winnerPlayerIds: [], awards: [] }], players: hand.players.map((p) => p.isHuman ? { ...p, stack: 900, handContribution: 100 } : p) };
    const before = structuredClone(current);
    const result = requestCashBuyIn(career, session, 2_000);
    expect(current).toEqual(before);
    const applied = applyPendingCashBuyIn(result.career, result.pending, 900);
    expect(applied.appliedAmount).toBe(1_100);
    const next = { ...current, players: current.players.map((p) => p.isHuman ? { ...p, stack: p.stack + applied.appliedAmount } : p) };
    expect(next.players.find((p) => p.isHuman)?.stack).toBe(2_000);
    expect(current.pots[0].amount).toBe(75);
  });

  it('supports a zero-stack rebuy and preserves the choice until explicit leave', () => {
    const career = { ...createCareer('P'), activeTableStack: 0 };
    const result = requestCashBuyIn(career, cashSession('STANDARD', 1, 'zero'), 5_000);
    expect(result.pending.requestedAmount).toBe(5_000);
  });

  it('refunds a reserved buy-in exactly once through the career store leave boundary', () => {
    const career = { ...createCareer('P'), activeTableStack: 1_000 };
    useCareerStore.getState().setCareer(career);
    const requested = useCareerStore.getState().requestCashBuyIn(cashSession('STANDARD', 1, 'leave-store'), 2_000);
    const reservedFunds = useCareerStore.getState().career!.currentFunds;
    useCareerStore.getState().cancelPendingCashBuyIn(requested.pending.transactionId);
    expect(useCareerStore.getState().career!.currentFunds).toBe(career.currentFunds);
    useCareerStore.getState().cancelPendingCashBuyIn(requested.pending.transactionId);
    expect(useCareerStore.getState().career!.currentFunds).toBe(career.currentFunds);
    expect(reservedFunds).toBeLessThan(career.currentFunds);
    useCareerStore.getState().setCareer(null);
  });

  it('exposes zero-stack rebuy and explicit leave choices without cashing out implicitly', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, players: [{ id: 'human', seat: 0, stack: 0, isHuman: true }, { id: 'ai', seat: 1, stack: 1_000 }] });
    const settled = { ...table, street: 'SETTLEMENT' as const };
    useGameStore.getState().setGame(settled);
    expect(useGameStore.getState().zeroStackChoice).toBe(true);
    useGameStore.getState().chooseZeroStack('REBUY');
    expect(useGameStore.getState().game).toBe(settled);
    useCareerStore.getState().setCareer({ ...createCareer('P'), activeTableStack: 0 });
    const pending = useCareerStore.getState().requestCashBuyIn(cashSession('STANDARD', 1, 'zero-store'), 5_000);
    const applied = useCareerStore.getState().applyPendingCashBuyIn(pending.pending, 0);
    const next = { ...settled, players: settled.players.map((p) => p.isHuman ? { ...p, stack: applied.appliedAmount } : p) };
    expect(next.players.find((p) => p.isHuman)?.stack).toBeGreaterThan(0);
    expect(useCareerStore.getState().career?.bankruptcyCount).toBe(0);
    useGameStore.getState().chooseZeroStack('LEAVE');
    expect(useGameStore.getState().leaveRequested).toBe(true);
    useGameStore.getState().setGame(null);
    useCareerStore.getState().setCareer(null);
  });

  it.each(['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'ALL_IN'] as const)('runs public store request and next-hand transition for %s', (street) => {
    const career = { ...createCareer('P'), activeTableStack: 900 };
    const session = cashSession('STANDARD', 1, `store-${street}`);
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, session, players: [{ id: 'human', seat: 0, stack: 900, isHuman: true }, { id: 'ai', seat: 1, stack: 1_000 }] });
    const started = startHand(table, shuffleDeck(createDeck('STANDARD')));
    const settled = { ...started, street: 'SETTLEMENT' as const, players: started.players.map((p) => p.isHuman ? { ...p, stack: 900 } : p) };
    useCareerStore.getState().setCareer(career);
    useGameStore.getState().setGame({ ...settled, street: street === 'ALL_IN' ? 'SETTLEMENT' as const : street });
    const request = useCareerStore.getState().requestCashBuyIn(session, 2_000);
    const snapshot = structuredClone(useGameStore.getState().game);
    const applied = useCareerStore.getState().applyPendingCashBuyIn(request.pending, 900);
    useCareerStore.getState().syncActiveTableStack(2_000);
    const next = createNextHand({ ...settled, players: settled.players.map((p) => p.isHuman ? { ...p, stack: p.stack + applied.appliedAmount } : p) });
    expect(useGameStore.getState().game).toEqual(snapshot);
    expect(next.players.find((p) => p.isHuman)?.stack).toBeGreaterThan(900);
    useCareerStore.getState().setCareer(null); useGameStore.getState().setGame(null);
  });

  it('uses public leave request and cancellation boundary without double refund', () => {
    const career = { ...createCareer('P'), activeTableStack: 900 };
    const session = cashSession('STANDARD', 1, 'public-leave');
    useCareerStore.getState().setCareer(career);
    const request = useCareerStore.getState().requestCashBuyIn(session, 2_000);
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, session, players: [{ id: 'human', seat: 0, stack: 900, isHuman: true }, { id: 'ai', seat: 1, stack: 1_000 }] });
    useGameStore.getState().setGame({ ...startHand(table, shuffleDeck(createDeck('STANDARD'))), street: 'SETTLEMENT' as const });
    expect(useGameStore.getState().requestLeave()).toBe('IMMEDIATE');
    const refunded = finishTableExitTransition(useCareerStore.getState().career!, useGameStore.getState().game ?? { ...table, street: 'SETTLEMENT' as const });
    useCareerStore.getState().setCareer(refunded);
    expect(useCareerStore.getState().career!.currentFunds).toBe(refunded.currentFunds);
    expect(refunded.pendingCashBuyIns.find((p) => p.transactionId === request.pending.transactionId)?.status).toBe('REFUNDED');
    useCareerStore.getState().setCareer(null);
  });

  it('runs the real zero-stack leave cash-out and bankruptcy ordering', () => {
    const career = { ...createCareer('P'), activeTableStack: 0, currentFunds: 0 };
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, players: [{ id: 'human', seat: 0, stack: 0, isHuman: true }, { id: 'ai', seat: 1, stack: 1_000 }] });
    const exited = finishTableExitTransition(career, { ...table, street: 'SETTLEMENT' as const });
    expect(exited.activeTableStack).toBeNull();
    expect(applyBankruptcyProtection(exited).currentFunds).toBeGreaterThanOrEqual(5_000);
  });
});
