// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareer } from '../../src/career/careerService';
import { TournamentSelectPage } from '../../src/pages/TournamentSelect/TournamentSelectPage';
import { TournamentResultPage } from '../../src/pages/TournamentResult/TournamentResultPage';
import { TournamentInfo } from '../../src/components/TournamentInfo/TournamentInfo';
import { startTournament } from '../../src/tournament/tournamentEngine';
import { GamePage } from '../../src/pages/Game/GamePage';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';

describe('mini tournament flow UI', () => {
  it('shows affordability/unlock, fixed six seats and tournament information', () => {
    const career = createCareer('玩家');
    const select = renderToStaticMarkup(<TournamentSelectPage career={career} onEnter={() => undefined} />);
    expect(select).toContain('Mini 锦标赛');
    expect(select).toContain('可进入');
    const tournament = startTournament({ tournamentId: 'ui-t1', humanId: 'human' });
    expect(tournament.players).toHaveLength(6);
    const info = renderToStaticMarkup(<TournamentInfo tournament={tournament} />);
    expect(info).toContain('存活 6 人');
    expect(info).toContain('冠军奖金');
  });

  it('renders result rank and omits cash buy-in in tournament play', () => {
    const tournament = startTournament({ tournamentId: 'ui-t2', humanId: 'human' });
    const result = renderToStaticMarkup(<TournamentResultPage tournament={{ ...tournament, championId: 'ai-1', rankings: [{ playerId: 'human', rank: 2 }], spectator: true }} onDone={() => undefined} />);
    expect(result).toContain('第 2 名');
    const table = createTable({ mode: 'STANDARD', tableSize: 6, smallBlind: 25, bigBlind: 50, matchType: 'MINI_TOURNAMENT', tableLevel: 1, sessionId: 'ui-game', players: Array.from({ length: 6 }, (_, seat) => ({ id: seat === 0 ? 'human' : `ai-${seat}`, seat, stack: 1_000, isHuman: seat === 0 })) });
    const game = startHand(table, createDeck('STANDARD'));
    const html = renderToStaticMarkup(<GamePage game={game} matchType="MINI_TOURNAMENT" tableLevel={undefined} previousHand={null} paused={false} leaveRequested={false} canContinue={false} onContinue={() => undefined} onLeave={() => undefined} onPause={() => undefined} onAction={() => undefined} />);
    expect(html).not.toContain('data-testid="cash-buy-in"');
  });
});
