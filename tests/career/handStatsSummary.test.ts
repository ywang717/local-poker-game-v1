import { describe, expect, it } from 'vitest';
import { handSummary } from '../../src/App';
import { createTable, startHand } from '../../src/game/gameEngine';
import { createDeck } from '../../src/game/cards';
function state(size: 2 | 3 | 6 | 9 = 6) {
  return startHand(createTable({ mode: 'STANDARD', tableSize: size, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
    players: Array.from({length: size}, (_, seat) => ({ id: seat === 0 ? 'human' : `ai-${seat}`, seat, stack: seat === 0 ? 1000 : 500, isHuman: seat === 0 })) }), createDeck('STANDARD'));
}
describe('settlement analysis metadata', () => {
  it('captures initial stacks before blinds and awards', () => {
    const hand = state();
    expect(hand.handStartStacks).toMatchObject({ human: 1000, 'ai-1': 500 });
    hand.street = 'SETTLEMENT'; hand.players[0].stack = 1500;
    expect(handSummary(hand)).toMatchObject({ initialPlayerStack: 1000, effectiveStackBB: 50 });
  });
  it('does not count a folded player in a showdown between opponents', () => {
    const hand = state(); hand.street = 'SETTLEMENT'; hand.communityCards = hand.deck.slice(14, 19);
    hand.players[0].folded = true;
    hand.actionHistory.push({ playerId: 'human', street: 'PRE_FLOP', action: 'fold', amount: 0, totalTo: 0 });
    expect(handSummary(hand)).toMatchObject({ trueShowdown: false, sawFlop: false, sawTurn: false, sawRiver: false });
  });
  it('keeps an all-in human in every actual runout street', () => {
    const hand = state(); hand.street = 'SETTLEMENT'; hand.communityCards = hand.deck.slice(14, 19); hand.players[0].allIn = true;
    expect(handSummary(hand)).toMatchObject({ trueShowdown: true, sawFlop: true, sawTurn: true, sawRiver: true });
  });
  it('classifies a side-pot award and a refund independently', () => {
    const hand = state(3); hand.street = 'SETTLEMENT';
    hand.pots = [
      {amount: 300, eligiblePlayerIds: ['human','ai-1','ai-2'], winnerPlayerIds:['ai-1'], awards:[{playerId:'ai-1',amount:300}]},
      {amount: 200, eligiblePlayerIds: ['human','ai-2'], winnerPlayerIds:['human'], awards:[{playerId:'human',amount:200}]}];
    hand.players[0].handContribution = 180; hand.refunds = [{playerId:'human',amount:20}];
    expect(handSummary(hand)).toMatchObject({result:'PARTIAL_WIN',playerNet:40});
    hand.pots[1].winnerPlayerIds=['human','ai-2'];
    expect(handSummary(hand)?.result).toBe('SPLIT');
    hand.pots = []; expect(handSummary(hand)?.result).toBe('LOSS');
  });
  it('preserves heads-up BTN/SB and BB roles for statistics', () => {
    const hand = state(2); hand.street = 'SETTLEMENT';
    expect(handSummary(hand)?.playerPosition).toBe('SB');
  });
});
