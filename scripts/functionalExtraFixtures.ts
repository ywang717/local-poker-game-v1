import { readFileSync,writeFileSync } from 'node:fs';
import { applyAction } from '../src/game/gameEngine';
const fixtures=JSON.parse(readFileSync('.audit-evidence/fixtures.json','utf8'));
for(const mode of ['STANDARD','SHORT_DECK']) {
 const f=fixtures[`stages-${mode}-2`];let game=f.stages.FLOP;
 while(game.players.find(p=>p.seat===game.actingSeat).id!=='human') {
 const player=game.players.find(p=>p.seat===game.actingSeat);const result=applyAction(game,{playerId:player.id,action:{kind:'check'}});
 if(!result.ok)throw Error(result.error.message);game=result.state;
 }
 fixtures[`bet-${mode}`]={career:f.career,game};
}
writeFileSync('.audit-evidence/extra-fixtures.json',JSON.stringify(fixtures));
