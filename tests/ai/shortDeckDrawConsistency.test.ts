import { describe,it,expect } from 'vitest';
import { createCard as c,createDeck } from '../../src/game/cards';
import { postflopStrength } from '../../src/ai/postflop';
import { evaluateHand } from '../../src/game/handEvaluator';
describe('short-deck draw rules agree with settlement',()=>{
 it('does not grant a private ace a phantom low straight draw',()=>{const hole=[c(14,'spades'),c(13,'clubs')],board=[c(6,'hearts'),c(7,'diamonds'),c(8,'clubs'),c(12,'clubs')];const known=new Set([...hole,...board].map(c=>c.id));const outs=createDeck('SHORT_DECK').filter(c=>!known.has(c.id)).filter(c=>evaluateHand(hole,[...board,c],'SHORT_DECK').category==='STRAIGHT');expect(outs).toHaveLength(0);expect(postflopStrength(hole,board,'SHORT_DECK').drawPotential).toBe(0);});
 it('retains the low draw with a community ace',()=>expect(postflopStrength([c(6,'hearts'),c(13,'clubs')],[c(14,'spades'),c(7,'diamonds'),c(8,'clubs'),c(12,'clubs')],'SHORT_DECK').drawPotential).toBeGreaterThan(0));
});
