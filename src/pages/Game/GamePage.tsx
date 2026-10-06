import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../game/gameState';
import type { PlayerAction } from '../../game/gameState';
import { aiDelayMs, createPausableTimer, type PausableTimer } from '../../game/timers';
import { chooseActionForState } from '../../ai/turn';
import { useSettingsStore } from '../../store/settingsStore';
import type { PlayerModel } from '../../ai/playerModel';
import { ActionPanel } from '../../components/ActionPanel/ActionPanel';
import { PokerTable } from '../../components/PokerTable/PokerTable';
import { HandReview } from '../../components/HandReview/HandReview';
import type { HandSummary } from '../../career/handHistory';
import type { MatchType } from '../../match/matchTypes';
import type { TableLevel } from '../../career/tableLevels';
import { CashBuyInModal } from '../../components/CashBuyInModal/CashBuyInModal';
import { TournamentInfo } from '../../components/TournamentInfo/TournamentInfo';
import type { TournamentState } from '../../tournament/types';

export function GamePage({ game, tournament, onAction, onPause, onLeave, onContinue, canContinue, previousHand, paused, leaveRequested, opponentModels = {}, matchType = game.matchType ?? game.session?.matchType ?? 'CASH', tableLevel, currentFunds = 0, pendingCashBuyIn = false, onBuyIn, onCancelBuyIn, onZeroStackRebuy, onFastSimulate, onExitTournament }: { game: GameState; tournament?: TournamentState; onAction: (playerId: string, action: PlayerAction) => void; onPause: () => void; onLeave: () => void; onContinue: () => void; canContinue: boolean; previousHand: HandSummary | null; paused: boolean; leaveRequested: boolean; opponentModels?: Readonly<Record<string, PlayerModel>>; matchType?: MatchType; tableLevel?: TableLevel; currentFunds?: number; pendingCashBuyIn?: boolean; onBuyIn?: (targetStack: number) => void; onCancelBuyIn?: () => void; onZeroStackRebuy?: () => void; onFastSimulate?: () => void; onExitTournament?: () => void }) {
  const human = game.players.find((player) => player.isHuman) ?? game.players[0];
  const tournamentInfo = tournament ?? game.tournamentState;
  const aiSpeed = useSettingsStore((state) => state.aiSpeed);
  const aiTimer = useRef<PausableTimer | null>(null);
  const onActionRef = useRef(onAction);
  const [showBuyIn, setShowBuyIn] = useState(false);

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

  const isCash = matchType === 'CASH';
  const cap = tableLevel ? tableLevel.bigBlind * 100 : Number.POSITIVE_INFINITY;
  const atBuyInCap = human.stack >= cap;
  const buyInUnavailableReason = leaveRequested
    ? '已申请离桌'
    : !pendingCashBuyIn && atBuyInCap
      ? '当前筹码已达到买入上限'
      : !pendingCashBuyIn && currentFunds <= 0
        ? '生涯资金不足'
        : undefined;
  // An existing request remains openable so the player can inspect or cancel
  // it.  Only a new request is blocked by the cap/funds checks.
  const canOpenBuyIn = isCash && !leaveRequested && Boolean(tableLevel && onBuyIn && onCancelBuyIn);
  const canRequestBuyIn = canOpenBuyIn && !buyInUnavailableReason;
  const isZeroStack = game.street === 'SETTLEMENT' && human.stack === 0;
  const openBuyIn = () => { if (!canOpenBuyIn) return; if (isZeroStack) onZeroStackRebuy?.(); setShowBuyIn(true); };
  const spectatorControls = tournamentInfo?.spectator ? <section className="spectator-controls" data-testid="tournament-spectator-controls" aria-label="淘汰后比赛选项"><p className="spectator-banner" role="status">你已被淘汰，可继续观战或直接模拟至比赛结束</p><div><button className="button button--primary" data-testid="tournament-fast-simulate" onClick={onFastSimulate}>快速模拟至结束</button><button className="button button--secondary" data-testid="tournament-exit-spectator" onClick={onExitTournament ?? onLeave}>退出比赛</button></div></section> : null;
  return <section className="game-page"><div className="game-toolbar"><span>本地牌桌</span><div>{game.street !== 'SETTLEMENT' && game.street !== 'SHOWDOWN' && <button className="link-button" onClick={onPause}>{paused ? '继续' : '暂停'}</button>}{isCash && <button className="link-button" data-testid="cash-buy-in" aria-label={buyInUnavailableReason} title={buyInUnavailableReason} disabled={!canOpenBuyIn || Boolean(buyInUnavailableReason)} onClick={openBuyIn}>买入</button>}<button className="link-button" data-testid="leave-table" onClick={onLeave}>{leaveRequested ? '本手结束后离开' : '离开牌桌'}</button></div></div>{tournamentInfo && <TournamentInfo tournament={tournamentInfo} />}{pendingCashBuyIn && <p className="cash-buy-in-status" role="status">买入申请已提交，将在下一手开始时生效</p>}{buyInUnavailableReason && !pendingCashBuyIn && <p className="cash-buy-in-status" role="status">{buyInUnavailableReason}</p>}<PokerTable game={game} />{game.street === 'SETTLEMENT' ? isZeroStack && isCash ? <section className="settlement-controls zero-stack-choice" data-testid="zero-stack-choice" aria-label="筹码耗尽选择"><strong>桌上筹码已用完</strong><span>重新买入后继续下一手，或离开牌桌取回剩余资金</span><div>{pendingCashBuyIn ? <button className="button button--primary" data-testid="zero-stack-continue" disabled={!canContinue} onClick={onContinue}>继续下一手</button> : <button className="button button--primary" data-testid="zero-stack-rebuy" disabled={!canRequestBuyIn} onClick={openBuyIn}>重新买入</button>}<button className="button button--secondary" onClick={onLeave}>离开牌桌</button></div></section> : <section className="settlement-controls" aria-label="结算操作"><strong>本手已结算</strong><span>请选择继续下一手或离开牌桌</span><div><button className="button button--primary" disabled={!canContinue} onClick={onContinue}>继续下一手</button><button className="button button--secondary" onClick={onLeave}>离开牌桌</button></div></section> : game.street === 'SHOWDOWN' ? <section className="showdown-controls" data-testid="showdown-controls" aria-label="摊牌"><strong>摊牌中</strong><span>正在展示最终牌面，稍候进入结算</span></section> : paused ? <div className="paused-banner">已暂停</div> : spectatorControls ?? <ActionPanel game={game} playerId={human.id} onAction={(action) => onAction(human.id, action)} />}{previousHand && <HandReview key={`${previousHand.handId}-${game.street === 'SETTLEMENT' ? 'settlement' : 'active'}`} hand={previousHand} defaultExpanded={game.street === 'SETTLEMENT'} />}{showBuyIn && !leaveRequested && tableLevel && onBuyIn && onCancelBuyIn && <CashBuyInModal level={tableLevel} tableStack={human.stack} currentFunds={currentFunds} pending={pendingCashBuyIn} onConfirm={onBuyIn} onClose={() => setShowBuyIn(false)} onCancelPending={() => { onCancelBuyIn(); setShowBuyIn(false); }} />}</section>;
}
