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
});
