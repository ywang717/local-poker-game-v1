import { describe, expect, it, vi } from 'vitest';
import { commitTournamentNextHandAndPublish, handSummary } from '../../src/App';
import { createCareer, recordHand } from '../../src/career/careerService';
import { startTournament, startTournamentHand } from '../../src/tournament/tournamentEngine';
import { loadCareer, loadHandSnapshot, resetStorageForTests, saveCareerAndHandSnapshot } from '../../src/storage/saveSystem';
import type { GameState } from '../../src/game/gameState';

describe('tournament hand history transition', () => {
  it('saves the settled history and next hand together before publishing the next hand', async () => {
    await resetStorageForTests();
    const tournament = startTournament({ tournamentId: 'history-transition', humanId: 'human' });
    const previous = startTournamentHand(tournament, () => 0.5);
    const settled = { ...previous, street: 'SETTLEMENT' as const };
    const career = recordHand(createCareer('玩家'), handSummary(settled)!);
    const next = startTournamentHand({ ...tournament, handNumber: 1 }, () => 0.6);
    const published: string[] = [];
    let visibleGame: GameState = settled;
    await commitTournamentNextHandAndPublish(career, next,
      () => published.push('career'),
      (game) => {
        expect(published).toEqual(['career']);
        visibleGame = game;
        published.push('game');
      });
    expect(published).toEqual(['career', 'game']);
    expect(visibleGame.handId).toBe(next.handId);
    expect((await loadCareer()).career?.handHistory[0].handId).toBe(previous.handId);
    expect((await loadHandSnapshot())?.state.handId).toBe(next.handId);
    await resetStorageForTests();
  });

  it('keeps settlement visible while the joint save is pending', async () => {
    await resetStorageForTests();
    const tournament = startTournament({ tournamentId: 'history-pending', humanId: 'human' });
    const settled = { ...startTournamentHand(tournament, () => 0.5), street: 'SETTLEMENT' as const };
    const career = recordHand(createCareer('玩家'), handSummary(settled)!);
    const next = startTournamentHand({ ...tournament, handNumber: 1 }, () => 0.6);
    const originalSave = saveCareerAndHandSnapshot;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const saveSpy = vi.spyOn(await import('../../src/storage/saveSystem'), 'saveCareerAndHandSnapshot')
      .mockImplementationOnce(async (nextCareer, snapshot) => {
        await gate;
        return originalSave(nextCareer, snapshot);
      });
    let visibleGame: GameState = settled;
    const pending = commitTournamentNextHandAndPublish(career, next, () => undefined, (game) => { visibleGame = game; });
    try {
      await vi.waitFor(() => expect(saveSpy).toHaveBeenCalledOnce());
      expect(visibleGame.handId).toBe(settled.handId);
      expect(visibleGame.street).toBe('SETTLEMENT');
    } finally {
      release();
      await pending;
      saveSpy.mockRestore();
    }
    expect(visibleGame.handId).toBe(next.handId);
    await resetStorageForTests();
  });
});
