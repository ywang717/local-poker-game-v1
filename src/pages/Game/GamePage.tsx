import { useEffect, useRef } from 'react';
import type { GameState } from '../../game/gameState';
import type { PlayerAction } from '../../game/gameState';
import { aiDelayMs, createPausableTimer, type PausableTimer } from '../../game/timers';
import { chooseActionForState } from '../../ai/turn';
import { useSettingsStore } from '../../store/settingsStore';
import type { PlayerModel } from '../../ai/playerModel';
import { ActionPanel } from '../../components/ActionPanel/ActionPanel';
import { PokerTable } from '../../components/PokerTable/PokerTable';

export function GamePage({ game, onAction, onPause, onLeave, paused, leaveRequested, opponentModels = {} }: { game: GameState; onAction: (playerId: string, action: PlayerAction) => void; onPause: () => void; onLeave: () => void; paused: boolean; leaveRequested: boolean; opponentModels?: Readonly<Record<string, PlayerModel>> }) {
  const human = game.players.find((player) => player.isHuman) ?? game.players[0];
  const aiSpeed = useSettingsStore((state) => state.aiSpeed);
  const aiTimer = useRef<PausableTimer | null>(null);
  const onActionRef = useRef(onAction);

  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  useEffect(() => {
    aiTimer.current?.cancel();
    aiTimer.current = null;
    const actor = game.actingSeat === null ? undefined : game.players.find((player) => player.seat === game.actingSeat);
    // A timer is created only for an AI seat. Human players can think for as
    // long as they need and never receive an action countdown.
    if (!actor || actor.isHuman || actor.folded || actor.allIn || game.street === 'SHOWDOWN' || game.street === 'SETTLEMENT') return undefined;
    const potAmount = game.players.reduce((sum, player) => sum + player.handContribution, 0);
    const importance = potAmount / Math.max(game.bigBlind * 20, 1);
    const timer = createPausableTimer(() => {
      const decision = chooseActionForState(game, Math.random, opponentModels);
      if (decision) onActionRef.current(decision.playerId, decision.action);
    }, aiDelayMs(aiSpeed, importance));
    aiTimer.current = timer;
    if (paused) timer.pause();
    return () => timer.cancel();
  }, [aiSpeed, game, opponentModels]);

  useEffect(() => {
    if (!aiTimer.current) return;
    if (paused) aiTimer.current.pause();
    else aiTimer.current.resume();
  }, [paused]);

  return <section className="game-page"><div className="game-toolbar"><span>本地牌桌</span><div><button className="link-button" onClick={onPause}>{paused ? '继续' : '暂停'}</button><button className="link-button" onClick={onLeave}>{leaveRequested ? '本手结束后离开' : '离开牌桌'}</button></div></div><PokerTable game={game} />{paused ? <div className="paused-banner">已暂停</div> : <ActionPanel game={game} playerId={human.id} onAction={(action) => onAction(human.id, action)} />}</section>;
}
