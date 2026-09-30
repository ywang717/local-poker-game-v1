import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/theme.css', import.meta.url), 'utf8');

describe('responsive layout contract', () => {
  it('allows the document to shrink below the desktop layout width', () => {
    expect(css).not.toContain('body { margin: 0; min-width: 1280px;');
    expect(css).toContain('overflow-x: hidden');
  });

  it('defines touch-safe phone and landscape layouts', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@media (orientation: landscape) and (max-height: 600px)');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('keeps quick bet controls large enough to tap', () => {
    expect(css).toMatch(/\.quick-bet\s*\{[^}]*min-height:\s*44px/);
    expect(css).not.toContain('.quick-bet { min-height: 36px');
  });

  it('keeps mobile seats in one column with the action bar in page flow', () => {
    const mobileRules = css.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(mobileRules).toMatch(/\.seat-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(mobileRules).toMatch(/\.table-center\s*\{[^}]*min-height:\s*120px/);
    expect(mobileRules).toMatch(/\.action-panel\s*\{[^}]*position:\s*sticky/);
  });
});
