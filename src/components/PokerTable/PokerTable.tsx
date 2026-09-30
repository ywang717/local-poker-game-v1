import type { GameState } from '../../game/gameState';
import { evaluateHand } from '../../game/handEvaluator';
import { CommunityCards } from '../CommunityCards/CommunityCards';
import { PlayingCard } from '../PlayingCard/PlayingCard';
import { PotDisplay } from '../PotDisplay/PotDisplay';
import { useSettingsStore } from '../../store/settingsStore';
import { PlayerActionBadge } from '../PlayerActionBadge/PlayerActionBadge';

function latestActionFor(game: GameState, playerId: string) {
  return [...game.actionHistory].reverse().find((action) => action.playerId === playerId);
}

export function PokerTable({ game }: { game: GameState }) {
  const showdown = game.street === 'SHOWDOWN' || game.street === 'SETTLEMENT';
  const autoShowWinningHand = useSettingsStore((state) => state.autoShowWinningHand);
  const human = game.players.find((player) => player.isHuman);
  const humanAward = game.pots.flatMap((pot) => pot.awards).filter((award) => award.playerId === human?.id).reduce((sum, award) => sum + award.amount, 0);
  return <main className="poker-table" aria-label="牌桌">
    <div className="table-header"><span>{game.street === 'PRE_FLOP' ? '翻牌前' : game.street}</span><span>第 {game.handNumber} 手</span></div>
    <div className="seat-grid">
      {game.players.filter((player) => !player.folded).map((player) => <article className={`player-seat${game.actingSeat === player.seat ? ' player-seat--acting' : ''}`} key={player.id}>
        <div className="avatar">{player.name.slice(0, 1)}</div>
        <div><strong>{player.name}</strong><span className="seat-meta">{player.stack.toLocaleString('zh-CN')} 筹码</span><span className="seat-contribution">本轮下注 {player.streetContribution.toLocaleString('zh-CN')}</span></div>
        <div className="seat-badges">
          {player.seat === game.dealerSeat && <span>D</span>}
          {player.seat === game.smallBlindSeat && <span>SB</span>}
          {player.seat === game.bigBlindSeat && <span>BB</span>}
        </div>
        <div className="seat-status">{player.allIn ? '全下' : game.actingSeat === player.seat && !player.isHuman ? '思考中' : player.status === 'ACTIVE' ? '进行中' : '等待'}</div>
        {latestActionFor(game, player.id) && <PlayerActionBadge action={latestActionFor(game, player.id)!} />}
        <div className="hole-cards">{player.isHuman || (game.street === 'SHOWDOWN' || game.street === 'SETTLEMENT') ? player.holeCards.map((card) => <PlayingCard card={card} key={card.id} />) : player.holeCards.map((card) => <PlayingCard hidden key={card.id} />)}</div>
        {showdown && autoShowWinningHand && game.communityCards.length >= 5 && <span className="seat-hand-category">{evaluateHand(player.holeCards, game.communityCards, game.mode).labelZh}</span>}
      </article>)}
    </div>
    <section className="table-center"><CommunityCards cards={game.communityCards} /><PotDisplay game={game} />{showdown && autoShowWinningHand && game.street === 'SETTLEMENT' && <div className="showdown-summary" aria-live="polite">{humanAward > 0 ? `你赢得 ${humanAward.toLocaleString('zh-CN')}` : '本手未获胜'}</div>}</section>
  </main>;
}
