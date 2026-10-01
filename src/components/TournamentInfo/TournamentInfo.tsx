import type { TournamentState } from '../../tournament/types';

export function TournamentInfo({ tournament, state }: { tournament?: TournamentState; state?: TournamentState }) {
  const info = tournament ?? state;
  if (!info) return null;
  const human = info.players.find((player) => player.isHuman)?.id ?? 'human';
  const humanRank = info.rankings.find((entry) => entry.playerId === human)?.rank;
  return <section className="tournament-info" aria-label="锦标赛信息">
    <div className="tournament-info__heading"><div><p className="eyebrow">Mini 锦标赛</p><strong>{info.spectator ? '观战中' : '比赛进行中'}</strong></div><span>存活 {info.players.length} 人</span></div>
    <div className="stat-grid"><div><span>当前盲注</span><strong>{info.smallBlind} / {info.bigBlind}</strong></div><div><span>盲注阶段</span><strong>Lv.{info.blindLevel}</strong></div><div><span>本阶段手数</span><strong>{info.handsAtLevel} / 8</strong></div><div><span>冠军奖金</span><strong>{(info.entryFee * 10).toLocaleString('zh-CN')}</strong></div></div>
    {humanRank && <p role="status">你的排名：第 {humanRank} 名</p>}
    <div><span>筹码排名</span><ol>{[...info.players].sort((left, right) => right.stack - left.stack).map((player) => <li key={player.id}>{player.name} · {player.stack.toLocaleString('zh-CN')}</li>)}</ol></div>
    {info.eliminations.length > 0 && <div><span>已淘汰</span><ul>{info.eliminations.map((entry) => <li key={`${entry.playerId}-${entry.rank}`}>第 {entry.rank} 名 · {entry.playerId}</li>)}</ul></div>}
  </section>;
}
