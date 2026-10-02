import { create } from 'zustand';
import { applyAction as applyBettingAction, getLegalActions } from '../game/betting';
import type { GameState, PlayerAction } from '../game/gameState';
import { clearHandSnapshot, saveHandSnapshot } from '../storage/saveSystem';
import { CURRENT_SAVE_VERSION } from '../types/persistence';

let persistenceQueue: Promise<void> = Promise.resolve();

function queuePersistence(task: () => Promise<void>): void {
  persistenceQueue = persistenceQueue.then(task, task).catch(() => undefined);
}

/** Wait for all previously queued hand writes before an atomic boundary write. */
export async function flushGamePersistenceQueue(): Promise<void> {
  await persistenceQueue;
}

function persistGame(game: GameState | null): void {
  if (game) {
    queuePersistence(() => saveHandSnapshot({ saveVersion: CURRENT_SAVE_VERSION, savedAt: new Date().toISOString(), state: structuredClone(game) }));
  } else {
    queuePersistence(clearHandSnapshot);
  }
}

export type GameStore = {
  game: GameState | null;
  paused: boolean;
  leaveRequested: boolean;
  zeroStackChoice: boolean;
  setGame: (game: GameState | null) => void;
  /** Update the in-memory state after an atomic save without enqueueing a second snapshot. */
  setGameWithoutPersistence: (game: GameState | null) => void;
  dispatchAction: (playerId: string, action: PlayerAction) => boolean;
  togglePause: () => void;
  requestLeave: () => 'IMMEDIATE' | 'AFTER_HAND';
  completeHand: () => void;
  chooseZeroStack: (choice: 'REBUY' | 'LEAVE') => void;
  legalActions: (playerId: string) => ReturnType<typeof getLegalActions>;
};

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  paused: false,
  leaveRequested: false,
  zeroStackChoice: false,
  setGame: (game) => {
    set((current) => ({ game, paused: false, leaveRequested: game ? current.leaveRequested : false, zeroStackChoice: Boolean(game?.street === 'SETTLEMENT' && game.players.find((player) => player.isHuman)?.stack === 0) }));
    persistGame(game);
  },
  setGameWithoutPersistence: (game) => set((current) => ({ game, paused: false, leaveRequested: game ? current.leaveRequested : false, zeroStackChoice: Boolean(game?.street === 'SETTLEMENT' && game.players.find((player) => player.isHuman)?.stack === 0) })),
  dispatchAction: (playerId, action) => {
    const game = get().game;
    if (!game || get().paused) return false;
    const result = applyBettingAction(game, { playerId, action });
    if (!result.ok) return false;
    set({ game: result.state });
    persistGame(result.state);
    return true;
  },
  togglePause: () => set((state) => ({ paused: !state.paused })),
  requestLeave: () => {
    const game = get().game;
    if (!game || game.street === 'SHOWDOWN' || game.street === 'SETTLEMENT') {
      set({ game: null, paused: false, leaveRequested: false, zeroStackChoice: false });
      persistGame(null);
      return 'IMMEDIATE';
    }
    set({ paused: false, leaveRequested: true });
    return 'AFTER_HAND';
  },
  completeHand: () => {
    if (get().leaveRequested) {
      set({ game: null, leaveRequested: false, zeroStackChoice: false });
      persistGame(null);
    }
  },
  chooseZeroStack: (choice) => {
    if (choice === 'LEAVE') set({ zeroStackChoice: false, leaveRequested: true });
    else set({ zeroStackChoice: true });
  },
  legalActions: (playerId) => {
    const game = get().game;
    return game ? getLegalActions(game, playerId) : [];
  },
}));
