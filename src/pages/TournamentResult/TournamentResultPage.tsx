import type { TournamentState } from '../../tournament/types';

export function TournamentResultPage({ tournament, onDone }: { tournament: TournamentState; onDone: () => void }) {
  const humanId = tournament.players.find((player) => player.isHuman)?.id ?? 'human';
  const rank = tournament.rankings.find((entry) => entry.playerId === humanId)?.rank ?? (tournament.championId === humanId ? 1 : null);
  const champion = tournament.championId === humanId;
  return <section className="page tournament-result-page"><p className="eyebrow">Mini 锦标赛结束</p><h2>{champion ? '恭喜夺冠' : '比赛结果'}</h2>{rank && <div className="hero-stat"><span>你的排名</span><strong>第 {rank} 名</strong></div>}<p>{champion ? `获得冠军奖金 ${(tournament.entryFee * 10).toLocaleString('zh-CN')}` : '冠军奖金已由冠军获得'}</p><button className="button button--primary" onClick={onDone}>返回生涯</button></section>;
}
