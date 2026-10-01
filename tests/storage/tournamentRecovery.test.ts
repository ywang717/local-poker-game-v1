import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { startTournament } from '../../src/tournament/tournamentEngine';
import { loadHandSnapshot, resetStorageForTests, saveHandSnapshot } from '../../src/storage/saveSystem';
import { CURRENT_SAVE_VERSION } from '../../src/types/persistence';

describe('tournament snapshot recovery', () => {
  it('restores the exact hand, blinds, eliminations, and reward guard', async () => {
    await resetStorageForTests();
    const tournament = startTournament({ tournamentId: 'recovery-t1', humanId: 'human', tableLevel: 2 });
    const state = { ...tournament, blindLevel: 3, handsAtLevel: 2, handNumber: 14, eliminations: [{ playerId: 'ai-1', rank: 6, handNumber: 14, stackBeforeHand: 100, seat: 1 }], rewardPaid: true };
    const snapshot = { saveVersion: CURRENT_SAVE_VERSION, savedAt: '2026-10-02T00:00:00.000Z', state: { handId: 'recovery-hand', handNumber: 14, mode: 'STANDARD' as const, tableSize: 6 as const, smallBlind: 100, bigBlind: 200, dealerSeat: 0, smallBlindSeat: null, bigBlindSeat: null, street: 'FLOP' as const, deck: [], deckIndex: 0, burnCards: [], communityCards: [], players: [], actingSeat: null, currentBet: 0, lastFullRaise: 200, pots: [], actionHistory: [], matchType: 'MINI_TOURNAMENT' as const, tableLevel: 2 as const, sessionId: 'recovery-t1', tournamentBlindLevel: 3, tournamentHandsAtLevel: 2, tournamentPlayersRemaining: 5, tournamentState: state } };
    await saveHandSnapshot(snapshot);
    const loaded = await loadHandSnapshot();
    expect(loaded?.state.handId).toBe('recovery-hand');
    expect(loaded?.state.tournamentState).toMatchObject({ tournamentId: 'recovery-t1', handNumber: 14, blindLevel: 3, handsAtLevel: 2, rewardPaid: true, eliminations: state.eliminations });
    await resetStorageForTests();
  });
});
