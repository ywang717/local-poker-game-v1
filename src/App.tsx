import { useEffect, useMemo, useRef, useState } from 'react';
import type { CareerState } from './career/careerState';
import { createDeck, shuffleDeck } from './game/cards';
import { createTable, startHand } from './game/gameEngine';
import { nextDealerSeat } from './game/dealer';
import { evaluateHand } from './game/handEvaluator';
import { settleGameState } from './game/handSettlement';
import type { GameState, PlayerAction } from './game/gameState';
import type { GameMode } from './game/rules';
import type { TableLevelId } from './career/tableLevels';
import { getTableLevel } from './career/tableLevels';
import type { HandSummary } from './career/handHistory';
import type { HandSnapshot } from './types/persistence';
import { CareerPage } from './pages/Career/CareerPage';
import { GamePage } from './pages/Game/GamePage';
import { HistoryPage } from './pages/History/HistoryPage';
import { HomePage } from './pages/Home/HomePage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { StatisticsPage } from './pages/Statistics/StatisticsPage';
import { TableSelectPage } from './pages/TableSelect/TableSelectPage';
import { TournamentSelectPage } from './pages/TournamentSelect/TournamentSelectPage';
import { TournamentResultPage } from './pages/TournamentResult/TournamentResultPage';
import { flushCareerPersistenceQueue, useCareerStore } from './store/careerStore';
import { flushGamePersistenceQueue, useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';
import { buildPlayerModels } from './ai/playerModel';
import { selectAiNames } from './ai/names';
import { loadCareer, loadHandSnapshot } from './storage/saveSystem';
import { cancelPendingCashBuyIn, syncActiveTableStack } from './career/cashBuyInService';
import { persistPreparedCashNextHandTransition, prepareCashNextHandTransition, type PreparedCashNextHandTransition } from './career/cashBuyInTransition';
import { leaveTable } from './career/careerService';
import { startTournamentHand, settleTournamentHand } from './tournament/tournamentEngine';
import { finishTournament, forfeitTournament } from './tournament/tournamentSettlement';
import { fastSimulateTournamentToEnd } from './tournament/fastSimulation';
import type { TournamentState } from './tournament/types';

export type AppView = 'HOME' | 'CAREER' | 'TABLE_SELECT' | 'TOURNAMENT_SELECT' | 'TOURNAMENT_RESULT' | 'GAME' | 'STATISTICS' | 'HISTORY' | 'SETTINGS';

export function getStartupDestination(career: CareerState | null, snapshot: HandSnapshot | null): AppView {
  if (snapshot?.state?.handId) return 'GAME';
  if (career) return 'CAREER';
  return 'HOME';
}

export function shouldFinishTableExitAfterSettlement(game: GameState | null, leaveRequested: boolean): boolean {
  return Boolean(game && leaveRequested && game.street === 'SETTLEMENT');
}

/** Publish a next hand only after its career/hand pair has been committed. */
export async function commitCashNextHandAndPublish(
  prepared: PreparedCashNextHandTransition,
  publishCareer: (career: CareerState) => void,
  publishGame: (game: GameState) => void,
): Promise<void> {
  await flushCareerPersistenceQueue();
  await flushGamePersistenceQueue();
  await persistPreparedCashNextHandTransition(prepared);
  publishCareer(prepared.career);
  publishGame(prepared.game);
}

/** Production cash-out ordering shared by the App transition and integration tests. */
export function finishTableExitTransition(career: CareerState, tableState: GameState): CareerState {
  let next = career;
  for (const pending of next.pendingCashBuyIns.filter((entry) => entry.status === 'PENDING' && entry.sessionId === tableState.sessionId)) {
    next = cancelPendingCashBuyIn(next, pending.transactionId);
  }
  const human = tableState.players.find((player) => player.isHuman);
  return leaveTable(next, human?.stack ?? 0, tableState.sessionId);
}

function levelForBigBlind(bigBlind: number): TableLevelId {
  if (bigBlind >= 1_000) return 5;
  if (bigBlind >= 500) return 4;
  if (bigBlind >= 200) return 3;
  if (bigBlind >= 100) return 2;
  return 1;
}

export function createNextHand(current: GameState): GameState {
  if (current.street !== 'SETTLEMENT') throw new Error('Next hand can only start after settlement');
  const human = current.players.find((player) => player.isHuman);
  if (!human || human.stack <= 0) throw new Error('Human player cannot continue without chips');
  const level = getTableLevel(levelForBigBlind(current.bigBlind));
  const occupiedSeats = new Set(current.players.map((player) => player.seat));
  const nextDealer = nextDealerSeat(current.tableSize, current.dealerSeat, occupiedSeats);
  const players = current.players.map((player) => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    isHuman: player.isHuman,
    personalityId: player.personalityId,
    stack: player.isHuman ? player.stack : player.stack > 0 ? player.stack : level.buyIn,
  }));
  const table = createTable({ mode: current.mode, tableSize: current.tableSize, smallBlind: current.smallBlind, bigBlind: current.bigBlind, dealerSeat: nextDealer, players, sessionId: current.sessionId, matchType: current.matchType, tableLevel: current.tableLevel, session: current.session });
  const next = startHand(table, shuffleDeck(createDeck(current.mode)));
  next.handNumber = current.handNumber + 1;
  return next;
}

export function handSummary(state: GameState): HandSummary | null {
  const human = state.players.find((player) => player.isHuman);
  if (!human || !state.handId) return null;
  const playerAward = state.pots.flatMap((pot) => pot.awards)
    .filter((award) => award.playerId === human.id)
    .reduce((sum, award) => sum + award.amount, 0);
  const playerRefund = (state.refunds ?? [])
    .filter((refund) => refund.playerId === human.id)
    .reduce((sum, refund) => sum + refund.amount, 0);
  const humanAllIn = state.actionHistory.some((record) => record.playerId === human.id && record.action === 'all-in');
  const winnerPots = state.pots.filter((pot) => pot.winnerPlayerIds.includes(human.id));
  const hasSplitPot = winnerPots.some((pot) => pot.winnerPlayerIds.length > 1);
  const evaluation = !human.folded && state.communityCards.length >= 5
    ? evaluateHand(human.holeCards, state.communityCards, state.mode)
    : null;
  return {
    handId: state.handId,
    timestamp: new Date().toISOString(),
    mode: state.mode,
    tableLevel: getTableLevel(levelForBigBlind(state.bigBlind)).id,
    tableSize: state.tableSize,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    dealerSeat: state.dealerSeat,
    playerHoleCards: [...human.holeCards],
    communityCards: [...state.communityCards],
    finalCategory: evaluation?.labelZh ?? null,
    finalPot: state.pots.reduce((sum, pot) => sum + pot.amount, 0),
    playerContribution: human.handContribution,
    playerNet: playerAward + playerRefund - human.handContribution,
    result: human.folded ? 'FOLD' : playerAward === 0 ? 'LOSS' : hasSplitPot ? 'SPLIT' : 'WIN',
    actionHistory: state.actionHistory.map((record) => ({ ...record })),
    playerNames: Object.fromEntries(state.players.map((player) => [player.id, player.name])),
    potResults: state.pots.map((pot) => ({ amount: pot.amount, winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })),
    allIn: humanAllIn,
    allInWon: humanAllIn && playerAward > 0,
  };
}

export function App({ initialCareer, initialGame, initialView }: { initialCareer?: CareerState | null; initialGame?: GameState | null; initialView?: AppView }) {
  const storeCareer = useCareerStore((state) => state.career);
  const setCareer = useCareerStore((state) => state.setCareer);
  const createNewCareer = useCareerStore((state) => state.createNewCareer);
  const buyIn = useCareerStore((state) => state.buyIn);
  const requestCashBuyIn = useCareerStore((state) => state.requestCashBuyIn);
  const syncCareerStack = useCareerStore((state) => state.syncActiveTableStack);
  const chooseZeroStack = useGameStore((state) => state.chooseZeroStack);
  const recordHand = useCareerStore((state) => state.recordHand);
  const leaveTable = useCareerStore((state) => state.leaveTable);
  const applyBankruptcy = useCareerStore((state) => state.applyBankruptcy);
  const enterTournament = useCareerStore((state) => state.enterTournament);
  const recordTournamentFinish = useCareerStore((state) => state.recordTournamentFinish);
  const storeGame = useGameStore((state) => state.game);
  const setGame = useGameStore((state) => state.setGame);
  const setGameWithoutPersistence = useGameStore((state) => state.setGameWithoutPersistence);
  const dispatchAction = useGameStore((state) => state.dispatchAction);
  const paused = useGameStore((state) => state.paused);
  const togglePause = useGameStore((state) => state.togglePause);
  const leaveRequested = useGameStore((state) => state.leaveRequested);
  const requestLeave = useGameStore((state) => state.requestLeave);
  const loadSettings = useSettingsStore((state) => state.load);
  const career = storeCareer ?? initialCareer ?? null;
  const game = storeGame ?? initialGame ?? null;
  const opponentModels = useMemo(() => buildPlayerModels(career?.handHistory ?? []), [career?.handHistory]);
  const [view, setView] = useState<AppView>(initialView ?? (game ? 'GAME' : career ? 'CAREER' : 'HOME'));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cashBuyInError, setCashBuyInError] = useState<string | null>(null);
  const [tournamentResult, setTournamentResult] = useState<TournamentState | null>(initialGame?.tournamentState ?? null);
  const recordedSettlement = useRef<string | null>(null);
  const hydratedInitialGame = useRef(false);
  const cashTransitionInFlight = useRef(false);

  useEffect(() => { if (initialCareer && !storeCareer) setCareer(initialCareer); }, [initialCareer, setCareer, storeCareer]);
  useEffect(() => {
    if (hydratedInitialGame.current || !initialGame) return;
    hydratedInitialGame.current = true;
    if (!storeGame) setGame(initialGame);
  }, [initialGame, setGame, storeGame]);
  useEffect(() => {
    let active = true;
    void loadSettings();
    void Promise.all([
      initialCareer || storeCareer ? Promise.resolve(null) : loadCareer(),
      initialGame || storeGame ? Promise.resolve(null) : loadHandSnapshot(),
    ]).then(([careerResult, snapshot]) => {
      if (!active) return;
      if (careerResult?.career) setCareer(careerResult.career);
      if (careerResult?.status === 'corrupt') setLoadError(careerResult.error ?? '存档无法恢复');
      if (snapshot && !initialGame && !storeGame) {
        setGame(snapshot.state);
        setView('GAME');
      } else if (careerResult?.career && !initialView && !initialGame && !storeGame) {
        setView('CAREER');
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [initialCareer, initialGame, initialView, loadSettings, setCareer, setGame]);

  useEffect(() => {
    if (!game || game.street !== 'SHOWDOWN') return;
    setGame(settleGameState(game).state);
  }, [game, setGame]);

  const recordSettledHand = (tableState: GameState) => {
    if (tableState.street !== 'SETTLEMENT' || !tableState.handId || recordedSettlement.current === tableState.handId) return;
    recordedSettlement.current = tableState.handId;
    const summary = handSummary(tableState);
    if (summary && tableState.matchType !== 'MINI_TOURNAMENT' && useCareerStore.getState().career) recordHand(summary);
  };

  const finishTableExit = (tableState: GameState) => {
    recordSettledHand(tableState);
    const currentCareer = useCareerStore.getState().career;
    if (tableState.matchType === 'MINI_TOURNAMENT') {
      let forfeited = tableState.tournamentState;
      if (forfeited && tableState.street === 'SETTLEMENT') {
        try { forfeited = settleTournamentHand(forfeited, tableState); } catch { /* retain the last persisted tournament state */ }
      }
      if (forfeited) {
        const result = forfeitTournament(forfeited);
        if (currentCareer) recordTournamentFinish(result);
        setTournamentResult(result);
        setView('TOURNAMENT_RESULT');
      } else {
        setView('CAREER');
      }
      setGame(null);
      return;
    }
    if (currentCareer && currentCareer.activeTableStack !== null) {
      const exitCareer = finishTableExitTransition(currentCareer, tableState);
      setCareer(exitCareer);
      applyBankruptcy();
    }
    setGame(null);
    setView('CAREER');
  };

  useEffect(() => {
    if (!game || game.street !== 'SETTLEMENT') return;
    if (shouldFinishTableExitAfterSettlement(game, leaveRequested)) finishTableExit(game);
    else recordSettledHand(game);
  }, [game, leaveRequested]);

  const ensureCareer = () => career ?? createNewCareer('玩家');
  const startNewCareer = (nickname: string) => {
    if (career && typeof window !== 'undefined' && !window.confirm('新建生涯将清除当前进度，是否继续？')) return;
    setGame(null);
    setLoadError(null);
    createNewCareer(nickname);
    setView('CAREER');
  };
  const enterTable = (mode: GameMode, tableSize: 2 | 3 | 4 | 5 | 6 | 8 | 9, level: TableLevelId) => {
    const currentCareer = ensureCareer();
    const buyInResult = buyIn(level);
    const human = { id: 'human', name: currentCareer.nickname, seat: 0, stack: buyInResult.tableStack, isHuman: true };
    const aiNames = selectAiNames(tableSize - 1);
    const players = Array.from({ length: tableSize }, (_, seat) => seat === 0 ? human : { id: `ai-${seat}`, name: aiNames[seat - 1], seat, stack: buyInResult.level.buyIn });
    const table = createTable({ mode, tableSize, smallBlind: buyInResult.level.smallBlind, bigBlind: buyInResult.level.bigBlind, players, dealerSeat: 0, sessionId: buyInResult.sessionId, matchType: 'CASH', tableLevel: level });
    setGame(startHand(table, shuffleDeck(createDeck(mode))));
    setView('GAME');
  };
  const enterMiniTournament = (mode: GameMode, level: TableLevelId) => {
    const tournament = enterTournament(mode, level);
    const hand = startTournamentHand(tournament);
    setTournamentResult(null);
    setGame({ ...hand, tournamentState: tournament });
    setView('GAME');
  };
  const handleLeave = () => {
    const current = useGameStore.getState().game;
    if (!current) { setView('CAREER'); return; }
    if (current.street === 'SHOWDOWN') {
      finishTableExit(settleGameState(current).state);
      return;
    }
    if (current.street === 'SETTLEMENT') {
      finishTableExit(current);
      return;
    }
    requestLeave();
  };
  const continueHand = async () => {
    if (cashTransitionInFlight.current) return;
    const current = useGameStore.getState().game;
    if (!current || current.street !== 'SETTLEMENT') return;
    const human = current.players.find((player) => player.isHuman);
    let nextCareer = useCareerStore.getState().career;
    if (current.matchType === 'MINI_TOURNAMENT' && current.tournamentState) {
      const advanced = settleTournamentHand(current.tournamentState, current);
      if (advanced.players.length === 1) {
        const finished = finishTournament(advanced).state;
        setTournamentResult(finished);
        if (useCareerStore.getState().career) recordTournamentFinish(finished);
        setGame(null);
        setView('TOURNAMENT_RESULT');
        return;
      }
      const nextHand = startTournamentHand(advanced);
      setGame({ ...nextHand, tournamentState: advanced });
      return;
    }
    if (nextCareer && human && current.matchType !== 'MINI_TOURNAMENT') {
      const pendingForCurrent = nextCareer.pendingCashBuyIns.some((entry) => entry.status === 'PENDING' && entry.sessionId === current.sessionId);
      if (human.stack === 0 && !pendingForCurrent) {
        // A zero stack is a choice point. The leave action is the explicit
        // cash-out path; continue waits for a rebuy request from the UI.
        return;
      }
      if (leaveRequested) {
        finishTableExit(current);
        return;
      }
      cashTransitionInFlight.current = true;
      try {
        const prepared = prepareCashNextHandTransition(nextCareer, current, createNextHand);
        // Keep settlement visible until the previous writes drain and the
        // career/hand pair is durable. Publishing early lets instant AI act
        // against a next hand that has not yet been committed.
        await commitCashNextHandAndPublish(prepared, setCareer, setGameWithoutPersistence);
      } catch (error) {
        setCashBuyInError(error instanceof Error ? error.message : '下一手保存失败，请重试');
      } finally {
        cashTransitionInFlight.current = false;
      }
      return;
    }
    if (human?.stack === 0) {
      // A zero stack is a choice point. The leave action is the explicit
      // cash-out path; continue waits for a rebuy request from the UI.
      return;
    }
    if (leaveRequested) {
      finishTableExit(current);
      return;
    }
    setGame(createNextHand(current));
  };
  const requestTableBuyIn = (targetStack: number) => {
    const current = useGameStore.getState().game;
    const currentCareer = useCareerStore.getState().career;
    if (!current || !currentCareer || current.matchType === 'MINI_TOURNAMENT') return;
    const human = current.players.find((player) => player.isHuman);
    if (!human) return;
    syncCareerStack(human.stack);
    const session = current.session ?? (current.sessionId && current.tableLevel ? { sessionId: current.sessionId, matchType: current.matchType ?? 'CASH', tableLevel: current.tableLevel, mode: current.mode } : null);
    if (!session || session.matchType !== 'CASH') return;
    try {
      requestCashBuyIn(session, targetStack);
      setCashBuyInError(null);
    } catch (error) {
      setCashBuyInError(error instanceof Error ? error.message : '买入失败');
    }
  };
  const cancelTableBuyIn = () => {
    const current = useGameStore.getState().game;
    const transaction = useCareerStore.getState().career?.pendingCashBuyIns.find((entry) => entry.status === 'PENDING' && entry.sessionId === current?.sessionId);
    if (transaction) useCareerStore.getState().cancelPendingCashBuyIn(transaction.transactionId);
    setCashBuyInError(null);
  };
  const fastSimulateTournament = () => {
    const current = useGameStore.getState().game;
    const tournament = current?.tournamentState;
    if (!current || !tournament || !tournament.spectator || tournament.players.length <= 1) return;
    try {
      const finished = fastSimulateTournamentToEnd({ tournament, game: current });
      if (useCareerStore.getState().career) recordTournamentFinish(finished);
      setTournamentResult(finished);
      setGame(null);
      setView('TOURNAMENT_RESULT');
    } catch (error) {
      setCashBuyInError(error instanceof Error ? error.message : '快速模拟失败，请继续观战');
    }
  };
  const exitTournamentSpectator = () => {
    const current = useGameStore.getState().game;
    const tournament = current?.tournamentState;
    if (!tournament) return;
    const result = forfeitTournament(tournament);
    if (useCareerStore.getState().career) recordTournamentFinish(result);
    setTournamentResult(result);
    setGame(null);
    setView('TOURNAMENT_RESULT');
  };
  const navigate = (next: AppView) => setView(next);
  let content: React.ReactNode;
  if (view === 'HOME') content = <HomePage career={career} loadError={loadError} onContinue={() => setView(career ? 'CAREER' : 'HOME')} onNewCareer={startNewCareer} onNavigate={(next) => setView(next)} />;
  else if (view === 'CAREER' && career) content = <CareerPage career={career} onEnterTable={() => setView('TABLE_SELECT')} onEnterTournament={() => setView('TOURNAMENT_SELECT')} onNavigate={(next) => setView(next)} />;
  else if (view === 'TABLE_SELECT' && career) content = <TableSelectPage career={career} onEnter={enterTable} />;
  else if (view === 'TOURNAMENT_SELECT' && career) content = <TournamentSelectPage career={career} onEnter={enterMiniTournament} onBack={() => setView('CAREER')} />;
  else if (view === 'TOURNAMENT_RESULT' && tournamentResult) content = <TournamentResultPage tournament={tournamentResult} onDone={() => setView('CAREER')} />;
  else if (view === 'GAME' && game) {
    const activePending = Boolean(career?.pendingCashBuyIns.some((entry) => entry.status === 'PENDING' && entry.sessionId === game.sessionId));
    const currentLevel = getTableLevel(game.tableLevel ?? levelForBigBlind(game.bigBlind));
    content = <GamePage game={game} tournament={game.tournamentState} matchType={game.matchType ?? game.session?.matchType ?? 'CASH'} tableLevel={currentLevel} currentFunds={career?.currentFunds ?? 0} pendingCashBuyIn={activePending} onBuyIn={requestTableBuyIn} onCancelBuyIn={cancelTableBuyIn} onZeroStackRebuy={() => chooseZeroStack('REBUY')} onFastSimulate={fastSimulateTournament} onExitTournament={exitTournamentSpectator} opponentModels={opponentModels} previousHand={career?.handHistory[0] ?? null} paused={paused} leaveRequested={leaveRequested} canContinue={Boolean(game.street === 'SETTLEMENT' && ((game.matchType === 'MINI_TOURNAMENT') || game.players.find((player) => player.isHuman)?.stack || activePending))} onContinue={continueHand} onLeave={handleLeave} onPause={togglePause} onAction={(playerId, action: PlayerAction) => { dispatchAction(playerId, action); }} />;
  }
  else if (view === 'STATISTICS' && career) content = <StatisticsPage career={career} />;
  else if (view === 'HISTORY' && career) content = <HistoryPage career={career} />;
  else if (view === 'SETTINGS') content = <SettingsPage />;
  else content = <HomePage career={career} loadError={loadError} onContinue={() => setView('CAREER')} onNewCareer={startNewCareer} onNavigate={(next) => setView(next)} />;
  return <div className="app-shell" style={{ '--color-bg': '#FFFFFF' } as React.CSSProperties}><header className="app-header"><button className="brand-button" disabled={Boolean(game)} onClick={() => navigate('HOME')}>本地德州扑克生涯</button><nav>{career && !game && <><button className="link-button" onClick={() => navigate('CAREER')}>生涯</button><button className="link-button" onClick={() => navigate('TABLE_SELECT')}>牌桌</button><button className="link-button" onClick={() => navigate('SETTINGS')}>设置</button></>}</nav></header>{cashBuyInError && game && <p className="cash-buy-in-status cash-buy-in-status--error" role="alert">{cashBuyInError}</p>}{content}</div>;
}
