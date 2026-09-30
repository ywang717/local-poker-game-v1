export const AI_NAME_POOL = [
  '杰克', '凯文', '托尼', '迈克', '汤姆', '丹尼', '史蒂夫', '杰森',
  '安迪', '克里斯', '布莱恩', '卢克', '奥利弗', '本', '艾米', '莉萨',
  '保罗', '马克', '乔治', '亨利', '萨姆', '亚历克斯', '瑞恩', '埃里克',
] as const;

export type AiName = (typeof AI_NAME_POOL)[number];
export type NameRandomSource = () => number;

function normalizedRandom(rng: NameRandomSource): number {
  const value = rng();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5;
}

export function selectAiNames(count: number, rng: NameRandomSource = Math.random): AiName[] {
  if (!Number.isInteger(count) || count < 0 || count > AI_NAME_POOL.length) {
    throw new RangeError(`Cannot select ${count} names from the AI name pool`);
  }
  const shuffled = [...AI_NAME_POOL];
  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + Math.floor(normalizedRandom(rng) * (shuffled.length - index));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}
