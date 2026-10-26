import type { TournamentState } from '../../tournament/types';

export function TournamentResultPage({ tournament, onDone }: { tournament: TournamentState; onDone: () => void }) {
  const humanId = tournament.players.find((player) => player.isHuman)?.id
    ?? tournament.rankings.find((entry) => !entry.playerId.startsWith('ai-'))?.playerId
    ?? 'human';
  const rank = tournament.rankings.find((entry) => entry.playerId === humanId)?.rank ?? (tournament.championId === humanId ? 1 : null);
  const champion = tournament.championId === humanId;
  const championName = tournament.players.find(player => player.id === tournament.championId)?.name ?? tournament.eliminations.find(player => player.playerId === tournament.championId)?.playerName ?? '历史姓名未保存';
  return <section className="page tournament-result-page"><p className="eyebrow">Mini 锦标赛结束</p><h2>{champion ? '恭喜夺冠' : '比赛结果'}</h2>{tournament.championId && <p>冠军：{championName}</p>}<p>比赛共 {tournament.handNumber} 手</p>{rank && <div className="hero-stat"><span>你的排名</span><strong>第 {rank} 名</strong></div>}<p>{champion ? `获得冠军奖金 ${(tournament.entryFee * 10).toLocaleString('zh-CN')}` : tournament.championId ? '本次比赛未获得冠军奖金' : '已退出比赛，冠军尚未确定'}</p><button className="button button--primary" onClick={onDone}>返回生涯</button></section>;
}
