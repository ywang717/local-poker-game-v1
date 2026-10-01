import { runAIExperienceSimulation } from '../src/simulation/aiExperienceSimulation';

const report = runAIExperienceSimulation({ mode: 'STANDARD', tableSize: 6, hands: 10_000, seed: 0x20261001, difficulty: 3 });
console.log(JSON.stringify(report, null, 2));
