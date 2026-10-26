import { describe,it,expect,vi,afterEach } from 'vitest';
import { useGameStore } from '../../src/store/gameStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { createTable,startHand } from '../../src/game/gameEngine';
import { createDeck } from '../../src/game/cards';
let starts=0;
class FakeAudio {state='running'; currentTime=0;destination={};resume(){return Promise.resolve();}createOscillator(){return {type:'sine',frequency:{setValueAtTime(){}},connect(){},start(){starts++;},stop(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}}
function play(enabled:boolean){vi.stubGlobal('AudioContext',FakeAudio);useSettingsStore.setState({soundEnabled:enabled});useGameStore.setState({game:startHand(createTable({mode:'STANDARD',tableSize:2,smallBlind:25,bigBlind:50,players:[{id:'human',seat:0,stack:5000,isHuman:true},{id:'ai',seat:1,stack:5000}]}),createDeck('STANDARD')),paused:false});return useGameStore.getState().dispatchAction('human',{kind:'call'});}
afterEach(()=>{vi.unstubAllGlobals();useSettingsStore.setState({soundEnabled:true});});
describe('sound setting has a real audio effect',()=>{
 it('emits a local sound after a valid action when enabled',()=>{starts=0;expect(play(true)).toBe(true);expect(starts).toBeGreaterThan(0);});
 it('does not create tones when muted',()=>{starts=0;expect(play(false)).toBe(true);expect(starts).toBe(0);});
});

it('plays the first action after an initially suspended audio context resumes', async()=>{
 starts=0;class SuspendedAudio extends FakeAudio {state='suspended';resume(){this.state='running';return Promise.resolve();}}
 vi.stubGlobal('AudioContext',SuspendedAudio);vi.resetModules();const {playGameSound}=await import('../../src/audio/gameAudio');playGameSound('call',true);await Promise.resolve();expect(starts).toBeGreaterThan(0);
});
