import { createCard } from '../../src/game/cards';
import type { HandSummary } from '../../src/career/handHistory';

export function tournamentSummary(handId: string, changes: Partial<HandSummary> = {}): HandSummary {
  return { handId, matchType: 'MINI_TOURNAMENT', tournamentId: 't1', timestamp: '2026-10-09T00:00:00Z',
    mode: 'STANDARD', tableLevel: 1, tableSize: 6, smallBlind: 25, bigBlind: 50, dealerSeat: 0,
    playerHoleCards: [createCard(14, 'spades'), createCard(14, 'hearts')], communityCards: [], finalCategory: null,
    finalPot: 500, playerContribution: 100, playerNet: 400, result: 'WIN', actionHistory: [], ...changes };
}

