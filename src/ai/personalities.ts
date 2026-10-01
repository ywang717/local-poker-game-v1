export type PersonalityId = 'TIGHT' | 'LOOSE_AGGRESSIVE' | 'CALLING' | 'BALANCED';

export type AIPersonality = {
  id: PersonalityId;
  label: string;
  looseness: number;
  aggression: number;
  callBias: number;
  bluffFrequency: number;
};

export const PERSONALITIES: Readonly<Record<PersonalityId, AIPersonality>> = {
  TIGHT: { id: 'TIGHT', label: '偏紧', looseness: -0.06, aggression: 0.02, callBias: -0.04, bluffFrequency: -0.03 },
  LOOSE_AGGRESSIVE: { id: 'LOOSE_AGGRESSIVE', label: '偏松激进', looseness: 0.08, aggression: 0.08, callBias: -0.02, bluffFrequency: 0.05 },
  CALLING: { id: 'CALLING', label: '偏跟注', looseness: 0.04, aggression: -0.08, callBias: 0.1, bluffFrequency: -0.01 },
  BALANCED: { id: 'BALANCED', label: '均衡', looseness: 0, aggression: 0, callBias: 0, bluffFrequency: 0 },
};

export function getPersonality(personality: PersonalityId | AIPersonality): AIPersonality {
  const value = typeof personality === 'string' ? PERSONALITIES[personality] : personality;
  return {
    ...value,
    // Personality is a bounded nudge. It cannot turn a fold range into an
    // unrestricted range or bypass the explicit all-in gates.
    looseness: Math.max(-0.12, Math.min(0.12, value.looseness)),
    aggression: Math.max(-0.12, Math.min(0.12, value.aggression)),
    callBias: Math.max(-0.12, Math.min(0.12, value.callBias)),
    bluffFrequency: Math.max(-0.1, Math.min(0.1, value.bluffFrequency)),
  };
}
