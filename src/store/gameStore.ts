import { create } from 'zustand';
import { applyAction as applyBettingAction, getLegalActions } from '../game/betting';
import type { GameState, PlayerAction } from '../game/gameState';
import { clearHandSnapshot, saveHandSnapshot } from '../storage/saveSystem';
import { CURRENT_SAVE_VERSION } from '../types/persistence';

let persistenceQueue: Promise<void> = Promise.resolve();

function queuePersistence(task: () => Promise<void>): void {
  persistenceQueue = persistenceQueue.then(task, task).catch(() => undefined);
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
  setGame: (game: GameState | null) => void;
  dispatchAction: (playerId: string, action: PlayerAction) => boolean;
  togglePause: () => void;
  requestLeave: () => 'IMMEDIATE' | 'AFTER_HAND';
  completeHand: () => void;
  legalActions: (playerId: string) => ReturnType<typeof getLegalActions>;
};

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  paused: false,
  leaveRequested: false,
  setGame: (game) => {
    set((current) => ({ game, paused: false, leaveRequested: game ? current.leaveRequested : false }));
    persistGame(game);
  },
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
      set({ game: null, paused: false, leaveRequested: false });
      persistGame(null);
      return 'IMMEDIATE';
    }
    set({ paused: false, leaveRequested: true });
    return 'AFTER_HAND';
  },
  completeHand: () => {
    if (get().leaveRequested) {
      set({ game: null, leaveRequested: false });
      persistGame(null);
    }
  },
  legalActions: (playerId) => {
    const game = get().game;
    return game ? getLegalActions(game, playerId) : [];
  },
}));
