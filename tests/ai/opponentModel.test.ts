import { describe, expect, it } from 'vitest';
import { createOpponentModel, updateOpponentModel } from '../../src/ai/opponentModel';
import { buildPlayerModels } from '../../src/ai/playerModel';

describe('opponent model', () => {
  it('records explicit aggression events and sizing samples', () => {
    let model = createOpponentModel();
    model = updateOpponentModel(model, { handId: 'h1', action: 'raise-to', street: 'PRE_FLOP', voluntary: true, pfr: true, facingOpen: true, threeBet: true, amount: 30, potAmount: 20 });
    model = updateOpponentModel(model, { handId: 'h2', action: 'raise-to', street: 'PRE_FLOP', voluntary: true, pfr: true, facingThreeBet: true, fourBet: true, amount: 90, potAmount: 60 });
    model = updateOpponentModel(model, { handId: 'h3', action: 'fold', street: 'PRE_FLOP', facingThreeBet: true, foldToThreeBet: true });
    expect(model.threeBetCount).toBe(1);
    expect(model.fourBetCount).toBe(1);
    expect(model.foldToThreeBetCount).toBe(1);
    expect(model.raiseSizingSamples).toBe(2);
    expect(model.raiseSizingSum).toBeGreaterThan(0);
  });

  it('does not infer a three-bet from an arbitrary raise or final pot size', () => {
    const model = updateOpponentModel(createOpponentModel(), { handId: 'h1', action: 'raise-to', street: 'PRE_FLOP', amount: 100, potAmount: 10 });
    expect(model.threeBetCount).toBe(0);
    expect(model.threeBetOpportunities).toBe(0);
  });

  it('keeps actual zero-fold data and counts raises as faced-bet responses', () => {
    const models = buildPlayerModels([{
      handId: 'h-post', actionHistory: [
        { playerId: 'villain', street: 'FLOP', action: 'bet-to', amount: 20, totalTo: 20, isAggressiveRaise: true },
        { playerId: 'hero', street: 'FLOP', action: 'raise-to', amount: 60, totalTo: 80, isAggressiveRaise: true },
      ],
      finalPot: 100,
    } as any]);
    expect(models.hero.facedBetCount).toBe(1);
    expect(models.hero.foldToBetCount).toBe(0);
    expect(models.hero.threeBetCount).toBe(0);
  });
});
