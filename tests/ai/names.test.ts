import { describe, expect, it } from 'vitest';
import { AI_NAME_POOL, selectAiNames } from '../../src/ai/names';

describe('AI name selection', () => {
  it('selects unique transliterated English names for a table', () => {
    const names = selectAiNames(8, () => 0.1);

    expect(names).toHaveLength(8);
    expect(new Set(names).size).toBe(8);
    expect(names.every((name) => AI_NAME_POOL.includes(name))).toBe(true);
    expect(names.every((name) => !/^AI \\d+$/.test(name))).toBe(true);
  });

  it('is reproducible with a supplied random source and rejects impossible counts', () => {
    const sequence = [0.02, 0.41, 0.83, 0.17, 0.62, 0.29];
    let index = 0;
    const rng = () => sequence[index++ % sequence.length];
    let secondIndex = 0;
    const secondRng = () => sequence[secondIndex++ % sequence.length];

    expect(selectAiNames(6, rng)).toEqual(selectAiNames(6, secondRng));
    expect(() => selectAiNames(AI_NAME_POOL.length + 1, () => 0.5)).toThrow(/names/i);
  });
});
