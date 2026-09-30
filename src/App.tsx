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
import { useCareerStore } from './store/careerStore';
import { useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';
import { buildPlayerModels } from './ai/playerModel';
import { loadCareer, loadHandSnapshot } from './storage/saveSystem';

export type AppView = 'HOME' | 'CAREER' | 'TABLE_SELECT' | 'GAME' | 'STATISTICS' | 'HISTORY' | 'SETTINGS';

export function getStartupDestination(career: CareerState | null, snapshot: HandSnapshot | null): AppView {
  if (snapshot?.state?.handId) return 'GAME';
  if (career) return 'CAREER';
  return 'HOME';
}

export function shouldFinishTableExitAfterSettlement(game: GameState | null, leaveRequested: boolean): boolean {
  return Boolean(game && leaveRequested && game.street === 'SETTLEMENT');
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
    stack: player.isHuman ? player.stack : player.stack > 0 ? player.stack : level.buyIn,
  }));
  const table = createTable({ mode: current.mode, tableSize: current.tableSize, smallBlind: current.smallBlind, bigBlind: current.bigBlind, dealerSeat: nextDealer, players });
  const next = startHand(table, shuffleDeck(createDeck(current.mode)));
  next.handNumber = current.handNumber + 1;
  return next;
}

function handSummary(state: GameState): HandSummary | null {
  const human = state.players.find((player) => player.isHuman);
  if (!human || !state.handId) return null;
  const playerAward = state.pots.flatMap((pot) => pot.awards)
    .filter((award) => award.playerId === human.id)
    .reduce((sum, award) => sum + award.amount, 0);
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
    playerNet: playerAward - human.handContribution,
    result: human.folded ? 'FOLD' : playerAward === 0 ? 'LOSS' : hasSplitPot ? 'SPLIT' : 'WIN',
    actionHistory: state.actionHistory.map((record) => ({ ...record })),
    potResults: state.pots.map((pot) => ({ amount: pot.amount, winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })),
    allIn: state.players.some((player) => player.allIn),
    allInWon: state.players.some((player) => player.allIn) && playerAward > 0,
  };
}

export function App({ initialCareer, initialGame, initialView }: { initialCareer?: CareerState | null; initialGame?: GameState | null; initialView?: AppView }) {
  const storeCareer = useCareerStore((state) => state.career);
  const setCareer = useCareerStore((state) => state.setCareer);
  const createNewCareer = useCareerStore((state) => state.createNewCareer);
  const buyIn = useCareerStore((state) => state.buyIn);
  const recordHand = useCareerStore((state) => state.recordHand);
  const leaveTable = useCareerStore((state) => state.leaveTable);
  const applyBankruptcy = useCareerStore((state) => state.applyBankruptcy);
  const storeGame = useGameStore((state) => state.game);
  const setGame = useGameStore((state) => state.setGame);
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
  const recordedSettlement = useRef<string | null>(null);

  useEffect(() => { if (initialCareer && !storeCareer) setCareer(initialCareer); }, [initialCareer, setCareer, storeCareer]);
  useEffect(() => { if (initialGame && !storeGame) setGame(initialGame); }, [initialGame, setGame, storeGame]);
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
  }, [initialCareer, initialGame, initialView, loadSettings, setCareer, setGame, storeCareer, storeGame]);

  useEffect(() => {
    if (!game || game.street !== 'SHOWDOWN') return;
    setGame(settleGameState(game).state);
  }, [game, setGame]);

  const recordSettledHand = (tableState: GameState) => {
    if (tableState.street !== 'SETTLEMENT' || !tableState.handId || recordedSettlement.current === tableState.handId) return;
    recordedSettlement.current = tableState.handId;
    const summary = handSummary(tableState);
    if (summary && useCareerStore.getState().career) recordHand(summary);
  };

  const finishTableExit = (tableState: GameState) => {
    recordSettledHand(tableState);
    const currentCareer = useCareerStore.getState().career;
    const human = tableState.players.find((player) => player.isHuman);
    if (currentCareer && currentCareer.activeTableStack !== null) {
      leaveTable(human?.stack ?? 0);
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
    const players = Array.from({ length: tableSize }, (_, seat) => seat === 0 ? human : { id: `ai-${seat}`, name: `AI ${seat}`, seat, stack: buyInResult.level.buyIn });
    const table = createTable({ mode, tableSize, smallBlind: buyInResult.level.smallBlind, bigBlind: buyInResult.level.bigBlind, players, dealerSeat: 0 });
    setGame(startHand(table, shuffleDeck(createDeck(mode))));
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
  const continueHand = () => {
    const current = useGameStore.getState().game;
    if (!current || current.street !== 'SETTLEMENT') return;
    if (leaveRequested || current.players.find((player) => player.isHuman)?.stack === 0) {
      finishTableExit(current);
      return;
    }
    setGame(createNextHand(current));
  };
  const navigate = (next: AppView) => setView(next);
  let content: React.ReactNode;
  if (view === 'HOME') content = <HomePage career={career} loadError={loadError} onContinue={() => setView(career ? 'CAREER' : 'HOME')} onNewCareer={startNewCareer} onNavigate={(next) => setView(next)} />;
  else if (view === 'CAREER' && career) content = <CareerPage career={career} onEnterTable={() => setView('TABLE_SELECT')} onNavigate={(next) => setView(next)} />;
  else if (view === 'TABLE_SELECT' && career) content = <TableSelectPage career={career} onEnter={enterTable} />;
  else if (view === 'GAME' && game) content = <GamePage game={game} opponentModels={opponentModels} previousHand={career?.handHistory[0] ?? null} paused={paused} leaveRequested={leaveRequested} canContinue={Boolean(game.street === 'SETTLEMENT' && game.players.find((player) => player.isHuman)?.stack)} onContinue={continueHand} onLeave={handleLeave} onPause={togglePause} onAction={(playerId, action: PlayerAction) => { dispatchAction(playerId, action); }} />;
  else if (view === 'STATISTICS' && career) content = <StatisticsPage career={career} />;
  else if (view === 'HISTORY' && career) content = <HistoryPage career={career} />;
  else if (view === 'SETTINGS') content = <SettingsPage />;
  else content = <HomePage career={career} loadError={loadError} onContinue={() => setView('CAREER')} onNewCareer={startNewCareer} onNavigate={(next) => setView(next)} />;
  return <div className="app-shell" style={{ '--color-bg': '#FFFFFF' } as React.CSSProperties}><header className="app-header"><button className="brand-button" disabled={Boolean(game)} onClick={() => navigate('HOME')}>本地德州扑克生涯</button><nav>{career && !game && <><button className="link-button" onClick={() => navigate('CAREER')}>生涯</button><button className="link-button" onClick={() => navigate('TABLE_SELECT')}>牌桌</button><button className="link-button" onClick={() => navigate('SETTINGS')}>设置</button></>}</nav></header>{content}</div>;
}
