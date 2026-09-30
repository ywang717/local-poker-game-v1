import { describe, expect, it } from 'vitest';
import { createOpponentModel, updateOpponentModel } from '../../src/ai/opponentModel';

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
});
