import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCareer, recordHand } from '../../src/career/careerService';
import { loadCareer, resetStorageForTests, saveCareer } from '../../src/storage/saveSystem';
import { createCard } from '../../src/game/cards';
import type { HandSummary } from '../../src/career/handHistory';

beforeEach(async () => { await resetStorageForTests(); });

function hand(id: string): HandSummary {
  return { handId: id, matchType: 'CASH', timestamp: '2026-10-09T00:00:00.000Z', mode: 'STANDARD', tableLevel: 1, tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, playerHoleCards: [createCard(14, 'spades'), createCard(14, 'hearts')], communityCards: [], finalCategory: null, finalPot: 20, playerContribution: 10, playerNet: 10, result: 'WIN', actionHistory: [] };
}

describe('long-term hand stats persistence', () => {
  it('keeps compact facts beyond the 500-hand history boundary and reloads them', async () => {
    let career = createCareer('统计玩家');
    for (let index = 0; index < 505; index += 1) career = recordHand(career, hand(`h-${index}`));
    expect(career.handHistory).toHaveLength(500);
    expect(career.handStats).toHaveLength(505);
    await saveCareer(career);
    const loaded = await loadCareer();
    expect(loaded.career?.handStats).toHaveLength(505);
    expect(new Set(loaded.career?.handStats?.map(fact => fact.factKey)).size).toBe(505);
  });
});
