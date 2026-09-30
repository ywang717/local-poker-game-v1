import { create } from 'zustand';
import { applyBankruptcyProtection, buyIn, createCareer, leaveTable, recordHand } from '../career/careerService';
import type { CareerState } from '../career/careerState';
import type { HandSummary } from '../career/handHistory';
import type { TableLevelId } from '../career/tableLevels';
import { loadCareer, saveCareer } from '../storage/saveSystem';

let careerPersistenceQueue: Promise<void> = Promise.resolve();

function queueCareerSave(career: CareerState): void {
  careerPersistenceQueue = careerPersistenceQueue.then(() => saveCareer(career), () => saveCareer(career)).catch(() => undefined);
}

export type CareerStore = {
  career: CareerState | null;
  setCareer: (career: CareerState | null) => void;
  createNewCareer: (nickname: string) => CareerState;
  buyIn: (level: TableLevelId) => ReturnType<typeof buyIn>;
  leaveTable: (tableStack: number) => CareerState;
  recordHand: (summary: HandSummary) => CareerState;
  applyBankruptcy: () => CareerState;
  save: () => Promise<void>;
  load: () => Promise<Awaited<ReturnType<typeof loadCareer>>>;
};

export const useCareerStore = create<CareerStore>((set, get) => ({
  career: null,
  setCareer: (career) => set({ career }),
  createNewCareer: (nickname) => {
    const career = createCareer(nickname);
    set({ career });
    queueCareerSave(career);
    return career;
  },
  buyIn: (level) => {
    const career = get().career;
    if (!career) throw new Error('Career has not been created');
    const result = buyIn(career, level);
    set({ career: result.career });
    queueCareerSave(result.career);
    return result;
  },
  leaveTable: (tableStack) => {
    const career = get().career;
    if (!career) throw new Error('Career has not been created');
    const next = leaveTable(career, tableStack);
    set({ career: next });
    queueCareerSave(next);
    return next;
  },
  recordHand: (summary) => {
    const career = get().career;
    if (!career) throw new Error('Career has not been created');
    const next = recordHand(career, summary);
    set({ career: next });
    queueCareerSave(next);
    return next;
  },
  applyBankruptcy: () => {
    const career = get().career;
    if (!career) throw new Error('Career has not been created');
    const next = applyBankruptcyProtection(career);
    set({ career: next });
    queueCareerSave(next);
    return next;
  },
  save: async () => {
    const career = get().career;
    if (career) {
      careerPersistenceQueue = careerPersistenceQueue.then(() => saveCareer(career), () => saveCareer(career));
      await careerPersistenceQueue;
    }
  },
  load: async () => {
    const result = await loadCareer();
    if (result.career) set({ career: result.career });
    return result;
  },
}));
