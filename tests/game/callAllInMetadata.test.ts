import { it,expect } from 'vitest';
import { createTable,startHand,applyAction } from '../../src/game/gameEngine';
import { createDeck } from '../../src/game/cards';
it('marks a stack-exhausting call as an all-in call without counting a raise',()=>{
 const game=startHand(createTable({mode:'STANDARD',tableSize:2,smallBlind:25,bigBlind:50,players:[{id:'human',seat:0,stack:50,isHuman:true},{id:'ai',seat:1,stack:500}]}),createDeck('STANDARD'));
 const result=applyAction(game,{playerId:'human',action:{kind:'call'}});expect(result.ok).toBe(true);
 if(!result.ok)throw Error(result.error.message);
 expect(result.state.actionHistory.at(-1)).toMatchObject({action:'call',isAllInCall:true,isAggressiveRaise:false,isFullRaise:false});
});
