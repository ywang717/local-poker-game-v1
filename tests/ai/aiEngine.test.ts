import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai/aiEngine';
import { getPreflopProfile } from '../../src/ai/preflopRanges';
import { DIFFICULTY_LEVELS, getDifficultyProfile } from '../../src/ai/difficulty';
import { getPersonality, PERSONALITIES } from '../../src/ai/personalities';
import type { PublicTableContext } from '../../src/ai/publicContext';
import { buildPlayerModels, createPlayerModel, modelRates, recordObservedAction } from '../../src/ai/playerModel';
import { c } from '../game/cards.test';

function context(overrides: Partial<PublicTableContext> = {}): PublicTableContext {
  const self = {
    id: 'ai',
    name: 'AI',
    seat: 0,
    stack: 100,
    isHuman: false,
    streetContribution: 0,
    handContribution: 0,
    folded: false,
    allIn: false,
    hasActedStreet: false,
    status: 'ACTIVE' as const,
    holeCards: [c(9, 'spades'), c(8, 'spades')],
  };
  return {
    aiPlayerId: 'ai',
    aiSeat: 0,
    mode: 'STANDARD',
    tableSize: 6,
    street: 'PRE_FLOP',
    dealerSeat: 4,
    smallBlindSeat: 5,
    bigBlindSeat: 0,
    actingSeat: 0,
    smallBlind: 5,
    bigBlind: 10,
    currentBet: 10,
    lastFullRaise: 10,
    potAmount: 35,
    toCall: 10,
    position: 'EARLY',
    communityCards: [],
    self,
    players: [self, { id: 'opponent', name: 'Opponent', seat: 1, stack: 100, isHuman: false, streetContribution: 10, handContribution: 10, folded: false, allIn: false, hasActedStreet: true, status: 'ACTIVE' }],
    opponents: [{ id: 'opponent', name: 'Opponent', seat: 1, stack: 100, isHuman: false, streetContribution: 10, handContribution: 10, folded: false, allIn: false, hasActedStreet: true, status: 'ACTIVE' }],
    sidePots: [],
    actionHistory: [],
    legalActions: [
      { kind: 'fold' },
      { kind: 'call', amount: 10 },
      { kind: 'raise-to', minAmount: 20, maxAmount: 100 },
      { kind: 'all-in', amount: 100 },
    ],
    opponentModels: {},
    ...overrides,
  };
}

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function actionKind(action: ReturnType<typeof chooseAction>): string {
  return action.kind;
}

describe('heuristic AI', () => {
  it('uses wider opening thresholds heads-up and separate short-deck parameters', () => {
    const headsUp = getPreflopProfile('STANDARD', 2, 'HEADS_UP', 2);
    const fullRingEarly = getPreflopProfile('STANDARD', 9, 'EARLY', 2);
    const standard = getPreflopProfile('STANDARD', 6, 'MIDDLE', 3);
    const shortDeck = getPreflopProfile('SHORT_DECK', 6, 'MIDDLE', 3);
    expect(headsUp.openThreshold).toBeLessThan(fullRingEarly.openThreshold);
    expect(shortDeck.mode).toBe('SHORT_DECK');
    expect(shortDeck.pairBonus).not.toBe(standard.pairBonus);
    expect(shortDeck.connectedBonus).not.toBe(standard.connectedBonus);
  });

  it('always returns an action inside the supplied legal action set', () => {
    const table = context();
    for (const level of DIFFICULTY_LEVELS) {
      const action = chooseAction(table, level, PERSONALITIES.BALANCED, seeded(level));
      const legal = table.legalActions.find((entry) => entry.kind === action.kind);
      expect(legal).toBeDefined();
      if ((action.kind === 'bet-to' || action.kind === 'raise-to') && legal && 'minAmount' in legal) {
        expect(action.amount).toBeGreaterThanOrEqual(legal.minAmount);
        expect(action.amount).toBeLessThanOrEqual(legal.maxAmount);
      }
    }
  });

  it('keeps personality as a small threshold adjustment within the same difficulty', () => {
    const tight = getPersonality('TIGHT');
    const loose = getPersonality('LOOSE_AGGRESSIVE');
    expect(loose.looseness).toBeGreaterThan(tight.looseness);
    const levelTwo = getPreflopProfile('STANDARD', 6, 'MIDDLE', 2);
    expect(Math.abs(levelTwo.openThreshold + loose.looseness - levelTwo.openThreshold)).toBeLessThan(0.25);
    expect(getDifficultyProfile(2).quality).toBeLessThan(getDifficultyProfile(5).quality);
  });

  it('produces distinct seeded decision distributions as difficulty rises', () => {
    const counts = DIFFICULTY_LEVELS.map((level) => {
      const rng = seeded(0xabc000 + level);
      let aggressive = 0;
      for (let hand = 0; hand < 100; hand += 1) {
        const action = chooseAction(context({ self: {
          ...context().self,
          holeCards: [c(10, 'spades'), c(7, 'hearts')],
        } }), level, PERSONALITIES.BALANCED, rng);
        if (action.kind === 'bet-to' || action.kind === 'raise-to' || action.kind === 'all-in') aggressive += 1;
      }
      return aggressive;
    });
    expect(new Set(counts).size).toBeGreaterThan(1);
    expect(counts[4]).toBeGreaterThanOrEqual(counts[0]);
  });

  it('replays the same decision with the same supplied RNG seed', () => {
    expect(chooseAction(context(), 4, PERSONALITIES.BALANCED, seeded(12345)))
      .toEqual(chooseAction(context(), 4, PERSONALITIES.BALANCED, seeded(12345)));
  });

  it('records only visible action tendencies in the player model', () => {
    let model = createPlayerModel();
    model = recordObservedAction(model, { playerId: 'villain', handId: 'h1', street: 'PRE_FLOP', action: 'fold', amount: 0, totalTo: 0, facingBet: true });
    model = recordObservedAction(model, { playerId: 'villain', handId: 'h2', street: 'PRE_FLOP', action: 'call', amount: 10, totalTo: 10 });
    model = recordObservedAction(model, { playerId: 'villain', handId: 'h2', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30, facingBet: true, isThreeBet: true, potAmount: 50 });
    expect(model.handsObserved).toBe(2);
    expect(model.vpipHands).toBe(1);
    expect(model.pfrHands).toBe(1);
    expect(model.threeBetCount).toBe(1);
    expect(model.foldToBetCount).toBe(1);
    expect(modelRates(model).vpip).toBe(0.5);
  });

  it('builds AI opponent models from saved public action history', () => {
    const models = buildPlayerModels([{
      handId: 'h1', timestamp: '2026-09-30T00:00:00.000Z', mode: 'STANDARD', tableLevel: 1, tableSize: 2,
      smallBlind: 5, bigBlind: 10, dealerSeat: 0, playerHoleCards: [], communityCards: [], finalCategory: null,
      finalPot: 35, playerContribution: 10, playerNet: 0, result: 'FOLD',
      actionHistory: [{ playerId: 'human', street: 'PRE_FLOP', action: 'fold', amount: 0, totalTo: 10 }],
    }]);
    expect(models.human).toBeDefined();
    expect(modelRates(models.human!).foldToBet).toBe(1);
  });
});
