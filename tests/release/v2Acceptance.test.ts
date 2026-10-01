import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GamePage } from '../../src/pages/Game/GamePage';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { CURRENT_SAVE_VERSION } from '../../src/types/persistence';

const root = new URL('../../', import.meta.url);

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, root), 'utf8');
}

describe('V2 release acceptance', () => {
  it('keeps every required release script in package.json', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(packageJson.scripts).toMatchObject({
      typecheck: expect.any(String),
      test: expect.any(String),
      'test:ai': expect.any(String),
      'test:ai:experience': expect.any(String),
      'test:cash-buyin': expect.any(String),
      'test:tournament': expect.any(String),
      'test:simulation': expect.any(String),
      build: expect.any(String),
    });
  });

  it('uses the V2 save contract for new persistence records', () => {
    expect(CURRENT_SAVE_VERSION).toBe(2);
    expect(read('src/types/persistence.ts')).toContain('CURRENT_SAVE_VERSION = 2');
  });

  it('does not render a cash buy-in control during tournament play', () => {
    const table = createTable({
      mode: 'STANDARD',
      tableSize: 6,
      smallBlind: 25,
      bigBlind: 50,
      dealerSeat: 0,
      matchType: 'MINI_TOURNAMENT',
      tableLevel: 1,
      sessionId: 'release-tournament',
      players: Array.from({ length: 6 }, (_, seat) => ({ id: seat === 0 ? 'human' : `ai-${seat}`, name: seat === 0 ? '玩家' : `AI ${seat}`, seat, stack: 5_000, isHuman: seat === 0 })),
    });
    const html = renderToStaticMarkup(createElement(GamePage, { game: startHand(table, createDeck('STANDARD')), matchType: 'MINI_TOURNAMENT', previousHand: null, paused: false, leaveRequested: false, canContinue: false, onContinue: () => undefined, onLeave: () => undefined, onPause: () => undefined, onAction: () => undefined }));
    expect(html).not.toContain('data-testid="cash-buy-in"');
    expect(html).not.toContain('买入</button>');
  });

  it('ships the checked-in V2 release artifacts with completed acceptance evidence', () => {
    const report = read('docs/release/V2-ACCEPTANCE.md');
    expect(report).toContain('`npm run build` | PASS');
    expect(report).not.toMatch(/build.*pending/i);
    for (const artifact of [
      'docs/ai-balance/BASELINE.md',
      'docs/ai-balance/AI-V2-REPORT.md',
      'docs/ai-balance/AI-V2-RESULTS.json',
      'docs/ai-balance/AI-V2-CASES.csv',
      'docs/cash-buyin/BUYIN-TEST-REPORT.md',
      'docs/tournament/TOURNAMENT-TEST-REPORT.md',
    ]) {
      expect(() => statSync(new URL(`../../${artifact}`, import.meta.url))).not.toThrow();
    }
  });
});
