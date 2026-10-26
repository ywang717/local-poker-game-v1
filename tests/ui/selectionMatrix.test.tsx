import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareer,getTableAvailability } from '../../src/career/careerService';
import { getTableLevel } from '../../src/career/tableLevels';
import { createDeck } from '../../src/game/cards';
import { createTable,startHand } from '../../src/game/gameEngine';
import { PokerTable } from '../../src/components/PokerTable/PokerTable';
import { TableSelectPage } from '../../src/pages/TableSelect/TableSelectPage';
import { selectAiNames } from '../../src/ai/names';
describe('two modes, seven sizes and five table levels',()=>{
 for(const mode of ['STANDARD','SHORT_DECK'] as const)for(const size of [2,3,4,5,6,8,9] as const)for(const id of [1,2,3,4,5] as const)it(`${mode} ${size} players LV${id} has valid names and blinds`,()=>{const level=getTableLevel(id), names=selectAiNames(size-1,()=>0.5);const state=startHand(createTable({mode,tableSize:size,smallBlind:level.smallBlind,bigBlind:level.bigBlind,tableLevel:id,players:Array.from({length:size},(_,seat)=>({id:seat?`ai-${seat}`:'human',name:seat?names[seat-1]:'玩家',seat,isHuman:seat===0,stack:level.buyIn}))}),createDeck(mode));const html=renderToStaticMarkup(<PokerTable game={state}/>);expect(state.players).toHaveLength(size);expect(new Set(names).size).toBe(size-1);for(const name of names)expect(html).toContain(name);expect(state.players.find(p=>p.seat===state.bigBlindSeat)?.streetContribution).toBe(level.bigBlind);});
 it('locks unavailable levels and does not expose seven-player tables',()=>{const career=createCareer('玩家');expect(getTableAvailability(career).map(x=>x.canEnter)).toEqual([true,false,false,false,false]);const html=renderToStaticMarkup(<TableSelectPage career={career} onEnter={()=>{}}/>);expect(html).not.toContain('7 人桌');expect(html).toContain('历史最高');});
});
