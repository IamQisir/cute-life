import { describe, expect, it } from 'vitest';
import gun from '../src/life/catalog/gosperglidergun.rle?raw';
import eater from '../src/life/catalog/eater1.rle?raw';
import lwss from '../src/life/catalog/lwss.rle?raw';
import glider from '../src/life/catalog/glider.rle?raw';
import block from '../src/life/catalog/block.rle?raw';
import rpentomino from '../src/life/catalog/rpentomino.rle?raw';
import { CATALOG } from '../src/life/catalog';
import { BLUE, RED, emptyGrid, placeArmies, population, stepGrid } from '../src/battle/arena';
import { loadPrefabs, army, stamp, type Stamp } from '../src/battle/siege/prefabs';
import { DEFAULT_RULES as rules, arenaConfig, initialState, observe, simulate, simulateGrid, stepSiege, validateArmy } from '../src/battle/siege/siegeSim';
import { BEST_ESCORT, BREACH_ESCORT, lateStreamComparison, LOWER_GUN, UPPER_EATER, UPPER_GUN, mirrorArmy, traceFixture } from '../src/battle/siege/experiments';
const prefabs = loadPrefabs({gosperglidergun:gun,eater1:eater,lwss,glider,block,rpentomino});

// Full 640-generation fixtures: fast locally, but CI runners can exceed vitest's 5 s default.
describe('Crystal Siege Phase 0 fixtures', { timeout: 60_000 }, () => {
  it('uses the existing canonical catalogue seeds and charges actual live-cell counts', () => {
    expect(Object.values(prefabs).map(p=>p.cost)).toEqual([36,7,9,5,4,5]);
    for(const p of Object.values(prefabs)) {
      const entry = CATALOG.find(e=>e.id===p.id)!;
      expect(p.cost).toBe(entry.cells);
      expect([p.width,p.height]).toEqual([Math.max(...entry.rows.map(row=>row.length)),entry.rows.length]);
    }
  });
  it('certifies both landscape gun routes: first contact 108 and kill 388', () => {
    for(const gun of [UPPER_GUN, LOWER_GUN]) {
      const result = simulate(rules,prefabs,[gun],[]);
      expect(result.blue).toMatchObject({firstContact:108,killGen:388,hp:0});
      expect(result).toMatchObject({generation:388,winner:'red'});
      expect(result.red.hp).toBe(64);
    }
  });
  it('aligned eater blocks for 640 generations and returns as seven blue cells without recolouring', () => {
    const fixture = traceFixture(prefabs,[UPPER_GUN],[UPPER_EATER]);
    expect(fixture.s.blue).toEqual({hp:64,accumulator:0,units:0,firstContact:null,killGen:null});
    expect(fixture.s.generation).toBe(640);
    expect(fixture.s.winner).toBe('draw');
    expect(fixture.firstDisturbed).toBe(52);
    expect(fixture.recovered).toBe(54);
    expect(population(fixture.s.grid).blue).toBe(7);
    expect(fixture.originalBlue).toBe(7);
    expect(fixture.originalRed).toBe(0);
  });
  it('a legal 36-cell LWSS escort breaches the eater and kills with the gun', () => {
    expect(army(prefabs,BEST_ESCORT).length).toBe(36);
    const fixture=traceFixture(prefabs,[UPPER_GUN,...BEST_ESCORT],[UPPER_EATER]);
    expect(fixture.s.blue).toMatchObject({firstContact:128,killGen:268,hp:0,units:4001});
    expect(fixture.lastOriginalBlueGen).toBe(53);
    expect(population(fixture.s.grid).blue).toBe(0);
    // The same escort destroys the eater but fails to score in isolation: composition matters.
    expect(simulate(rules,prefabs,BEST_ESCORT,[UPPER_EATER],true).blue.units).toBe(0);
  });
  it('a 32-cell mixed escort removes the eater while preserving the p30 gun core', () => {
    expect(army(prefabs,BREACH_ESCORT)).toHaveLength(32);
    const fixture=traceFixture(prefabs,[UPPER_GUN,...BREACH_ESCORT],[UPPER_EATER]);
    expect(fixture.s.blue).toMatchObject({firstContact:294,killGen:429,units:2687});
    expect(fixture.lastOriginalBlueGen).toBe(295);
    expect(population(fixture.s.grid).blue).toBe(0);
    expect(lateStreamComparison(prefabs,BREACH_ESCORT)).toEqual({coreMatches:320,streamMatches:32,generations:320,bluePopulation:0});
  });
  it('is transparent to Life and deterministically reproduces grids, scores, and endings', () => {
    const red=[UPPER_GUN,...BEST_ESCORT],blue=[UPPER_EATER];
    let state=initialState(rules,placeArmies(arenaConfig(rules),army(prefabs,red),army(prefabs,blue)));
    let reference=state.grid;
    for(let g=0;g<160;g++) {
      reference=stepGrid(reference,128,96,false,false);
      state=stepSiege(rules,state);
      expect(state.grid).toEqual(reference);
    }
    expect(simulate(rules,prefabs,red,blue)).toEqual(simulate(rules,prefabs,red,blue));
  });
  it('has mirror parity for equal-budget breach fixtures', () => {
    const red=[UPPER_GUN,...BEST_ESCORT],blue=[UPPER_EATER];
    const a=simulate(rules,prefabs,red,blue);
    const b=simulate(rules,prefabs,mirrorArmy(prefabs,blue),mirrorArmy(prefabs,red));
    expect([a.red.hp,a.blue.hp,a.generation]).toEqual([b.blue.hp,b.red.hp,b.generation]);
    expect(b.winner).toBe('blue');
  });
  it('rejects illegal exclusion, overlap, budgets, and unit limits', () => {
    const illegal:Stamp[][]=[
      [{id:'block',x:40,y:48}], [{id:'block',x:4,y:4},{id:'block',x:4,y:4}],
      Array.from({length:9},(_,i)=>({id:'lwss',x:4,y:4+i*8})),
      Array.from({length:3},(_,i)=>({id:'eater1',x:4,y:4+i*8})),
      [{id:'glider',x:62,y:20}],
    ];
    illegal.forEach(units=>expect(()=>validateArmy(rules,prefabs,RED,units)).toThrow(RangeError));
  });
});

describe('Crystal accounting', () => {
  it('caps per generation and preserves the remainder while counting current enemy colour', () => {
    const grid=emptyGrid(arenaConfig(rules));
    for(let i=0;i<12;i++) grid[42*128+82+i]=RED;
    grid[43*128+82]=BLUE;
    const before={...initialState(rules,grid),generation:1};
    before.blue.accumulator=15;
    const after=observe(rules,before);
    expect(after.blue).toMatchObject({hp:63,accumulator:7,units:8,firstContact:1});
    expect(before.blue.hp).toBe(64);
    expect(after.grid).toBe(grid);
    // Current colour is authoritative; no deployment identity or paint exists in this observer.
    grid.fill(0);grid[48*128+88]=BLUE;
    expect(observe(rules,initialState(rules,grid)).blue.units).toBe(0);
    grid[48*128+88]=RED;
    expect(observe(rules,initialState(rules,grid)).blue.units).toBe(1);
  });
  it('damages both crystals in the same generation before deciding simultaneous death', () => {
    const r={...rules,hp:1,unitsPerHP:1};
    const grid=emptyGrid(arenaConfig(r));grid[48*128+40]=BLUE;grid[48*128+88]=RED;
    const result=observe(r,{...initialState(r,grid),generation:1});
    expect(result).toMatchObject({red:{hp:0,killGen:1},blue:{hp:0,killGen:1},winner:'draw'});
  });
  it('keeps scoring stationary enemy ash, with no extinction or period-2 exit', () => {
    const grid=emptyGrid(arenaConfig(rules));
    for(const[x,y]of stamp(prefabs,{id:'block',x:86,y:46}))grid[y*128+x]=RED;
    const result=simulateGrid(rules,grid);
    expect(result.blue.killGen).toBe(256);
    expect(result.blue.units).toBe(1024);
    expect(result.winner).toBe('red');
  });
  it('retains the first terminal result during diagnostic continuation', () => {
    const r={...rules,hp:1,unitsPerHP:1};
    const grid=emptyGrid(arenaConfig(r));grid[48*128+88]=RED;
    const first=observe(r,{...initialState(r,grid),generation:1});
    expect(first.winner).toBe('red');
    grid.fill(0);grid[48*128+40]=BLUE;
    const continued=observe(r,{...first,generation:2});
    expect(continued.red.hp).toBe(0);
    expect(continued.winner).toBe('red');
  });
  it('uses integer HP at timeout, with fractional remainders retained but not used as a tiebreak', () => {
    const r={...rules,generations:1};
    const grid=emptyGrid(arenaConfig(r));grid[48*128+88]=RED;
    const result=observe(r,{...initialState(r,grid),generation:1});
    expect(result.blue.accumulator).toBe(1);
    expect(result.winner).toBe('draw');
    expect(()=>initialState({...rules,cap:0})).toThrow(RangeError);
  });
});
