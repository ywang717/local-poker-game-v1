import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/theme.css', import.meta.url), 'utf8');

describe('responsive cash buy-in UI', () => {
  it('keeps cash buy-in controls touch safe and within the viewport', () => {
    expect(css).toContain('.cash-buy-in-modal');
    expect(css).toMatch(/\.cash-buy-in-modal[^{]*\{[^}]*max-width:\s*min\(/);
    expect(css).toMatch(/\.cash-buy-in-modal button[^{]*\{[^}]*min-height:\s*44px/);
    expect(css).toContain('overflow-x: hidden');
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.cash-buy-in-modal/);
  });
});
