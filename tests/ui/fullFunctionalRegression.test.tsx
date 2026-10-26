// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HandReview } from '../../src/components/HandReview/HandReview';
import { HistoryPage } from '../../src/pages/History/HistoryPage';
import { TournamentResultPage } from '../../src/pages/TournamentResult/TournamentResultPage';
import { ActionPanel } from '../../src/components/ActionPanel/ActionPanel';
import { createCareer } from '../../src/career/careerService';
import { startTournament } from '../../src/tournament/tournamentEngine';
import { createTable, startHand } from '../../src/game/gameEngine';
import { createDeck } from '../../src/game/cards';
import type { HandSummary } from '../../src/career/handHistory';
const hand = (id = 'h-0'): HandSummary => ({handId:id, timestamp:'2026-10-26T00:00:00Z',mode:'STANDARD',tableLevel:1,tableSize:2,smallBlind:25,bigBlind:50,dealerSeat:0,playerHoleCards:[],communityCards:[],finalCategory:null,finalPot:200,playerContribution:60,playerNet:40,result:'PARTIAL_WIN',playerNames:{'human':'玩家','ai-1':'托尼'},actionHistory:[{playerId:'ai-1',street:'PRE_FLOP',action:'raise-to',amount:100,totalTo:300}]});
let host: HTMLDivElement; let root: Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('full functional acceptance regressions',()=>{
 it('labels partial pot wins honestly',()=>expect(renderToStaticMarkup(<HandReview hand={hand()} defaultExpanded/>)).toContain('部分获胜'));
 it('distinguishes raise-to from chips paid',()=>{const html=renderToStaticMarkup(<HandReview hand={hand()} defaultExpanded/>);expect(html).toContain('加注到 300');expect(html).toContain('本次投入 100');});
 it('does not invent a missing legacy AI name or display an internal id',()=>{const h=hand();delete h.playerNames;const html=renderToStaticMarkup(<HandReview hand={h} defaultExpanded/>);expect(html).toContain('历史姓名未保存');expect(html).not.toContain('ai-1');});
 it('shows uncalled bet refunds separately',()=>{const h={...hand(),refunds:[{playerId:'ai-1',amount:80}]};const html=renderToStaticMarkup(<HandReview hand={h} defaultExpanded/>);expect(html).toContain('未跟注退还');expect(html).toContain('托尼');expect(html).toContain('80');});
 it('shows champion name and total tournament hands',()=>{const t=startTournament({tournamentId:'functional-result',humanName:'玩家'});const champion=t.players[1];const html=renderToStaticMarkup(<TournamentResultPage tournament={{...t,players:[champion],championId:champion.id,handNumber:16,rankings:[{playerId:'human',rank:3}]}} onDone={()=>{}}/>);expect(html).toContain(`冠军：${champion.name}`);expect(html).toContain('16 手');});
 it('makes the oldest retained history accessible through pagination',async()=>{const career=createCareer('玩家');career.handHistory=Array.from({length:25},(_,i)=>hand(`h-${i}`));await act(async()=>root.render(<HistoryPage career={career}/>));expect(host.querySelectorAll('.history-row')).toHaveLength(20);const next=[...host.querySelectorAll('button')].find(b=>b.textContent==='下一页');expect(next).toBeTruthy();await act(async()=>next!.click());expect(host.querySelectorAll('.history-row')).toHaveLength(5);await act(async()=>host.querySelector<HTMLButtonElement>('.history-row')!.click());expect(host.querySelector('.hand-review')?.textContent).toContain('h-20');});
 it('cannot submit a fractional chip amount',async()=>{const g=startHand(createTable({mode:'STANDARD',tableSize:2,smallBlind:25,bigBlind:50,players:[{id:'human',seat:0,stack:5000,isHuman:true},{id:'ai',seat:1,stack:5000}]}),createDeck('STANDARD'));await act(async()=>root.render(<ActionPanel game={g} playerId="human" onAction={()=>{}}/>));const input=host.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'150.5');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});expect([...host.querySelectorAll('button')].find(b=>b.textContent==='加注')!.disabled).toBe(true);});
});

it('does not include an uncalled refund in the settled pot display',async()=>{
 const {PotDisplay}=await import('../../src/components/PotDisplay/PotDisplay');
 const state=startHand(createTable({mode:'STANDARD',tableSize:2,smallBlind:25,bigBlind:50,players:[{id:'human',seat:0,stack:5000,isHuman:true},{id:'ai',seat:1,stack:5000}]}),createDeck('STANDARD'));
 const html=renderToStaticMarkup(<PotDisplay game={{...state,street:'SETTLEMENT',pots:[{amount:50,eligiblePlayerIds:['human','ai'],winnerPlayerIds:['human'],awards:[{playerId:'human',amount:50}]}],refunds:[{playerId:'ai',amount:25}]}}/>);
 expect(html).toContain('<strong>50</strong>');
});
