import type { GameState } from '../../game/gameState';

export function PotDisplay({ game }: { game: GameState }) {
  const total = game.players.reduce((sum, player) => sum + player.handContribution, 0);
  return <section className="pot-display" aria-label="底池">
    <span className="eyebrow">底池</span>
    <strong>{total.toLocaleString('zh-CN')}</strong>
    {game.pots.map((pot, index) => <span className="side-pot" key={`${index}-${pot.amount}`}>{index === 0 ? '主池' : `边池 ${index}`} {pot.amount.toLocaleString('zh-CN')}{pot.winnerPlayerIds.length > 0 ? ` · ${pot.winnerPlayerIds.map((id) => game.players.find((player) => player.id === id)?.name ?? id).join('、')}` : ''}</span>)}
  </section>;
}
