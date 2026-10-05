import { BLUE, RED, emptyGrid, placeArmies, population, stepGrid, type Grid, type Pt, type Team } from '../arena';
import { decodeRle } from '../../share/rle';
import { UNIT_IDS, army, normalize, orient, phase, stamp, type Orientation, type Prefabs, type Stamp } from './prefabs';
import { DEFAULT_RULES, arenaConfig, initialState, observe, simulate, simulateGrid, stepSiege, validateArmy,
  type Rect, type SiegeRules, type SiegeState } from './siegeSim';

export const UPPER_GUN: Stamp = { id: 'gosperglidergun', x: 51, y: 4, orientation: 7 };
export const LOWER_GUN: Stamp = { id: 'gosperglidergun', x: 51, y: 56, orientation: 3 };
export const UPPER_EATER: Stamp = { id: 'eater1', x: 69, y: 35, orientation: 0 };
export const BEST_ESCORT: Stamp[] = [
  { id: 'lwss', x: 12, y: 33, orientation: 2 }, { id: 'lwss', x: 26, y: 30, orientation: 2 },
  { id: 'lwss', x: 40, y: 33, orientation: 2 }, { id: 'lwss', x: 54, y: 30, orientation: 2 },
];
export const BREACH_ESCORT: Stamp[] = [
  { id: 'lwss', x: 8, y: 49, orientation: 2 }, { id: 'lwss', x: 18, y: 49, orientation: 2 },
  { id: 'rpentomino', x: 54, y: 57 }, { id: 'rpentomino', x: 48, y: 49 },
  { id: 'block', x: 44, y: 63 },
];
export interface Table { title: string; headers: string[]; rows: (string | number | null)[][] }
export interface ExperimentReport { tables: Table[]; gate: boolean; recipes: Record<string, Stamp[]> }
export const textRecipe = (units: Stamp[]): string => units.map(u => `${u.id}@${u.x},${u.y}/o${u.orientation ?? 0}`).join('; ');
export const percent = (n: number, d: number): string => `${n}/${d} (${d ? (100*n/d).toFixed(1) : '0.0'}%)`;
const metrics = (s: SiegeState): (number | string | null)[] => [s.blue.firstContact, s.blue.killGen, DEFAULT_RULES.hp - s.blue.hp, s.blue.units, s.red.hp];
function localCounts(grid: Grid, box: Rect, team: Team, width = 128): number {
  let n = 0;
  for(let y=box.y0;y<=box.y1;y++)for(let x=box.x0;x<=box.x1;x++)if(grid[y*width+x]===team)n++;
  return n;
}
function exactEater(p: Prefabs, grid: Grid, eater = UPPER_EATER): boolean {
  return stamp(p,eater).every(([x,y])=>grid[y*128+x]===BLUE) && population(grid).blue===7;
}
function coreEqual(a: Grid, b: Grid): boolean {
  for(let y=4;y<=39;y++)for(let x=51;x<=59;x++)if(a[y*128+x]!==b[y*128+x])return false;
  return true;
}
export function legal(r: SiegeRules,p:Prefabs,team:Team,units:Stamp[]): boolean {
  try { validateArmy(r,p,team,units); return true; } catch(e) { if(e instanceof RangeError)return false; throw e; }
}
export function mirrorArmy(p: Prefabs, units: Stamp[]): Stamp[] {
  return units.map(u=>{
    const pts=stamp(p,u), x1=Math.max(...pts.map(([x])=>x));
    const target=normalize(pts.map(([x,y])=>[-x,y]));
    const key=(cells:Pt[])=>cells.map(([x,y])=>`${x},${y}`).sort().join(';');
    const orientation=Array.from({length:8},(_,o)=>o as Orientation).find(o=>key(orient(p[u.id].cells,o))===key(target))!;
    return {...u,x:127-x1,y:u.y,orientation};
  });
}
export function traceFixture(p:Prefabs,red:Stamp[],blue:Stamp[],rules=DEFAULT_RULES) {
  let s=initialState(rules,placeArmies(arenaConfig(rules),army(p,red),army(p,blue)));
  let firstDisturbed:number|null=null,recovered:number|null=null,lastOriginalBlueGen=0;
  const e=blue.find(u=>u.id==='eater1');
  const original=e?stamp(p,e):[];
  for(let g=1;g<=rules.generations;g++){
    s=stepSiege(rules,s);
    const own=original.filter(([x,y])=>s.grid[y*rules.width+x]===BLUE).length;
    if(own)lastOriginalBlueGen=g;
    if(e&&!firstDisturbed&&!exactEater(p,s.grid,e))firstDisturbed=g;
    if(e&&firstDisturbed&&!recovered&&exactEater(p,s.grid,e))recovered=g;
  }
  return {s,firstDisturbed,recovered,lastOriginalBlueGen,originalBlue:original.filter(([x,y])=>s.grid[y*rules.width+x]===BLUE).length,
    originalRed:original.filter(([x,y])=>s.grid[y*rules.width+x]===RED).length};
}

/** Compare complete core and post-port windows, every generation 321…640. */
export function lateStreamComparison(p: Prefabs, escort: Stamp[]) {
  const r = DEFAULT_RULES;
  let solo = initialState(r, placeArmies(arenaConfig(r), stamp(p, UPPER_GUN), []));
  let combined = initialState(r, placeArmies(arenaConfig(r), army(p, [UPPER_GUN, ...escort]), stamp(p, UPPER_EATER)));
  let coreMatches = 0, streamMatches = 0;
  for (let g = 1; g <= 640; g++) {
    solo = stepSiege(r, solo);
    combined = stepSiege(r, combined);
    if (g <= 320) continue;
    if (coreEqual(solo.grid, combined.grid)) coreMatches++;
    let equal = true;
    for (let y = 40; y <= 45; y++) for (let x = 76; x <= 81; x++) {
      if (solo.grid[y * 128 + x] !== combined.grid[y * 128 + x]) equal = false;
    }
    if (equal) streamMatches++;
  }
  return { coreMatches, streamMatches, generations: 320, bluePopulation: population(combined.grid).blue };
}

export function* trains(count:number):Generator<Stamp[]> {
  for(const o of [2,4] as Orientation[])for(const spacing of [7,10,14])for(const shift of [0,2,4,6,8])for(const stagger of [-6,-3,0,3,6])for(let lane=22;lane<=62;lane++){
    yield Array.from({length:count},(_,i)=>({id:'lwss',x:4+shift+i*spacing,y:lane+(i%2)*stagger,orientation:o}));
  }
}

export function* mixed(kind:'glider'|'growth'|'blocks'):Generator<Stamp[]> {
  for(const o of [2,4] as Orientation[])for(const spacing of [10,14])for(const shift of [0,4,8])for(let lane=26;lane<=54;lane++)for(const delta of [-8,-4,0,4,8]){
    const ships:Stamp[]=Array.from({length:kind==='glider'?3:2},(_,i)=>({id:'lwss',x:4+shift+i*spacing,y:lane,orientation:o}));
    if(kind==='glider')ships.push({id:'glider',x:54,y:lane+delta,orientation:0},{id:'block',x:50,y:lane+delta-6});
    if(kind==='growth')ships.push({id:'rpentomino',x:54,y:lane+delta},{id:'rpentomino',x:48,y:lane+delta-8},{id:'block',x:44,y:lane+delta+6});
    if(kind==='blocks')for(let i=0;i<4;i++)ships.push({id:'block',x:50-i*6,y:lane+delta});
    yield ships;
  }
}

export function* gliders():Generator<Stamp[]> {
  for(const o of [0,3,6,7] as Orientation[])for(const gap of [4,6,8])for(let y=4;y<=78;y+=2)for(const x of [20,28,36]){
    yield Array.from({length:7},(_,i)=>({id:'glider',x:x+(i%2)*6,y:y+Math.floor(i/2)*gap,orientation:o}));
  }
}

export function* whole():Generator<Stamp[]> {
  for(const o of [2,4] as Orientation[])for(const spacing of [7,10,14])for(const shift of [0,4,8])for(const separation of [6,10,14])for(let y=20;y<=58;y+=2){
    yield Array.from({length:8},(_,i)=>({id:'lwss',x:4+shift+(i%4)*spacing,y:y+Math.floor(i/4)*separation,orientation:o}));
  }
}

/** Exhaustive finite Cartesian searches; success means exposure, kill means <=640. No random sampling. */
export function runExperiments(p: Prefabs, extraRle: {snark:string;buckaroo:string}, progress: (s:string)=>void = ()=>{}): ExperimentReport {
  const r=DEFAULT_RULES,tables:Table[]=[],recipes:Record<string,Stamp[]>={gun:[UPPER_GUN],eater:[UPPER_EATER],initialBest:BEST_ESCORT};
  const table=(title:string,headers:string[],rows:Table['rows'])=>tables.push({title,headers,rows});
  table('Canonical prefab catalogue',['Unit','Cost','Footprint','Phase populations 0/1/2/3'],UNIT_IDS.map(id=>[id,p[id].cost,`${p[id].width}×${p[id].height}`,
    id==='lwss'||id==='glider'? [0,1,2,3].map(g=>phase(p[id].cells,g).length).join('/'):'seed only']));
  progress('Gun geometry and eater recovery');
  const gunSolo=simulate(r,p,[UPPER_GUN],[],true), stopped=traceFixture(p,[UPPER_GUN],[UPPER_EATER]);
  table('Gun mounts',['Mount','Recipe','First contact','Kill','HP lost','Capped units at 640','Red HP'],[
    ['upper vertical',textRecipe([UPPER_GUN]),...metrics(gunSolo)],
    ['lower vertical',textRecipe([LOWER_GUN]),...metrics(simulate(r,p,[LOWER_GUN],[],true))],
    ['upper horizontal',textRecipe([{id:'gosperglidergun',x:24,y:4,orientation:0}]),...metrics(simulate(r,p,[{id:'gosperglidergun',x:24,y:4,orientation:0}],[],true))],
    ['lower horizontal',textRecipe([{id:'gosperglidergun',x:24,y:83,orientation:6}]),...metrics(simulate(r,p,[{id:'gosperglidergun',x:24,y:83,orientation:6}],[],true))],
    ['upper + eater',textRecipe([UPPER_EATER]),...metrics(stopped.s)],
  ]);
  const muzzleRows:Table['rows']=[];
  const mounts=[UPPER_GUN,LOWER_GUN,{id:'gosperglidergun' as const,x:24,y:4,orientation:0 as Orientation},{id:'gosperglidergun' as const,x:24,y:83,orientation:6 as Orientation}];
  for(const u of [...mounts,...mirrorArmy(p,mounts)]) {
    const seed=stamp(p,u),width=Math.max(...seed.map(([x])=>x))-u.x+1,height=Math.max(...seed.map(([,y])=>y))-u.y+1;
    let grid=emptyGrid(arenaConfig(r));for(const[x,y]of seed)grid[y*128+x]=RED;
    const initial=grid;let startup:number|null=null,muzzle='';
    for(let g=1;g<=30;g++){
      grid=stepGrid(grid,128,96,false,false);
      const beyond:Pt[]=[];grid.forEach((c,i)=>{const x=i%128,y=Math.floor(i/128);if(c&&(x<u.x||x>=u.x+width||y<u.y||y>=u.y+height))beyond.push([x,y]);});
      if(startup===null&&beyond.length===5)startup=g;
      if(g===30)muzzle=`x${Math.min(...beyond.map(([x])=>x))}…${Math.max(...beyond.map(([x])=>x))}, y${Math.min(...beyond.map(([,y])=>y))}…${Math.max(...beyond.map(([,y])=>y))}`;
    }
    let match=true;for(let y=u.y;y<u.y+height;y++)for(let x=u.x;x<u.x+width;x++)if(grid[y*128+x]!==initial[y*128+x])match=false;
    const directions=['SE','SW','NW','NE','SW','NW','NE','SE'];
    muzzleRows.push([textRecipe([u]),`${width}×${height}`,directions[u.orientation??0],startup,muzzle,match?'30':'core differs','red']);
  }
  table('Gun muzzle / core certification',['Mount','Footprint','Heading','First five cells outside footprint','Shot bbox at gen30','Core period','Shot colour'],muzzleRows);
  table('Eater recovery',['First disturbance','First exact recovery','Blue at original sites at 640','Red at original sites','Total blue','Leakage units'],[
    [stopped.firstDisturbed,stopped.recovered,stopped.originalBlue,stopped.originalRed,population(stopped.s.grid).blue,stopped.s.blue.units]]);
  const interceptions:Table['rows']=[];
  for(let o=0;o<8;o++){
    let n=0,stop=0,recover=0,recolour=0,leak=0,max=0;
    for(let dx=0;dx<=6;dx++)for(let dy=-4;dy<=4;dy++){
      const eater={...UPPER_EATER,x:69+dx,y:35+dy,orientation:o as Orientation};
      if(!legal(r,p,BLUE,[eater]))continue;
      const s=simulate(r,p,[UPPER_GUN],[eater],true);n++;
      if(!s.blue.units)stop++;else leak++;
      if(exactEater(p,s.grid,eater))recover++;
      if(stamp(p,eater).some(([x,y])=>s.grid[y*128+x]===RED))recolour++;
      max=Math.max(max,s.blue.units);
    }
    interceptions.push([o,n,stop,recover,recolour,leak,max]);
  }
  table('Eater ports: x69…75, y31…39',['Orientation','Legal cases','Zero leakage','Exact blue recovery at 640','Red original sites','Leaks','Max units'],interceptions);
  // Gun-only time advances are laboratory diagnostics, never a 36-cell deployment.
  const timings:Table['rows']=[];
  for(const shift of [0,1,2,3,4,5,10,15,20,25,29]) {
    let grid=emptyGrid(arenaConfig(r));for(const [x,y]of stamp(p,UPPER_GUN))grid[y*128+x]=RED;
    for(let g=0;g<shift;g++)grid=stepGrid(grid,128,96,false,false);
    for(const [x,y]of stamp(p,UPPER_EATER))grid[y*128+x]=BLUE;
    const s=simulateGrid(r,grid,true);timings.push([shift,s.blue.units,exactEater(p,s.grid)?'7 blue':'in reaction',population(s.grid).blue]);
  }
  table('Arrival timing diagnostics (pre-advanced gun)',['Gun advance','Leakage units','Eater state at horizon','Blue population'],timings);

  progress('36-cell escorts: exhaustive LWSS lane/offset/stagger search');
  const assaultRows:Table['rows']=[];
  let best:Stamp[]=[],bestState:SiegeState|null=null,preserved:Stamp[]=[],preservedState:SiegeState|null=null;
  const assess=(label:string,candidates:Iterable<Stamp[]>,withGun:boolean,defender:Stamp[])=>{
    let n=0,damage=0,kills=0,wins=0,removed=0,intactKills=0,localBest:Stamp[]=[],localState:SiegeState|null=null;
    let localIntact:Stamp[]=[],localIntactState:SiegeState|null=null;
    for(const escort of candidates){
      const red=withGun?[UPPER_GUN,...escort]:escort;
      if(!legal(r,p,RED,red)||!legal(r,p,BLUE,defender))continue;
      const s=simulate(r,p,red,defender,true);n++;if(s.blue.units)damage++;if(s.blue.killGen!==null)kills++;if(s.winner==='red')wins++;
      const e=defender.find(u=>u.id==='eater1');
      if(e&&stamp(p,e).every(([x,y])=>s.grid[y*128+x]!==BLUE))removed++;
      const intact=withGun&&coreEqual(s.grid,gunSolo.grid);
      if(intact&&s.blue.killGen!==null)intactKills++;
      const better=(prev:SiegeState|null)=>!prev||(s.blue.killGen??9999)<(prev.blue.killGen??9999)||
        (s.blue.killGen===prev.blue.killGen&&s.blue.units>prev.blue.units);
      if(better(localState)){localBest=escort;localState=s;}
      if(withGun&&better(bestState)){best=escort;bestState=s;}
      if(intact&&s.blue.killGen!==null&&better(localIntactState)){localIntact=escort;localIntactState=s;}
      if(intact&&s.blue.killGen!==null&&population(s.grid).blue===0&&better(preservedState)){preserved=escort;preservedState=s;}
    }
    if(localState)assaultRows.push([label,n,percent(damage,n),percent(kills,n),percent(wins,n),removed,intactKills,localState.blue.firstContact,localState.blue.killGen,r.hp-localState.blue.hp,textRecipe(localBest)]);
    recipes[label]=localBest;
    if(localIntactState)recipes[`${label} intact gun`]=localIntact;
  };
  assess('4 LWSS + gun',trains(4),true,[UPPER_EATER]);
  progress('Mixed escorts and whole-budget attacks');
  for(const kind of ['glider','growth','blocks'] as const)assess(`${kind} escort + gun`,mixed(kind),true,[UPPER_EATER]);
  assess('7 gliders + gun',gliders(),true,[UPPER_EATER]);
  // Two rails of four ships; longitudinal spacing also changes arrival time by 2*spacing generations.
  assess('8 LWSS vs upper gun+eater (interference)',whole(),false,[...mirrorArmy(p,[UPPER_GUN]),UPPER_EATER]);
  assess('8 LWSS vs lower gun+eater',whole(),false,[...mirrorArmy(p,[LOWER_GUN]),UPPER_EATER]);
  const block:Stamp={id:'block',x:69,y:35};
  assess('4 LWSS vs block',trains(4),false,[block]);
  table('Assault search (canonical seeds, 640 generations)',['Family','Legal cases','Damage','Kills by 640','Match wins','No original blue eater cells at 640','Kills with intact gun core (includes flanks)','Best contact','Best kill','Best HP lost','Best recipe'],assaultRows);
  recipes.best=best;recipes.preserved=preserved;
  const chosen=traceFixture(p,[UPPER_GUN,...best],[UPPER_EATER]);
  const preservedTrace=traceFixture(p,[UPPER_GUN,...preserved],[UPPER_EATER]);
  table('Selected breaches',['Recipe','Contact','Kill','Units','Last blue original-site generation','Blue original sites at 640','Gun core matches solo at 640','Total blue at 640'],[
    ['fastest equal-budget',chosen.s.blue.firstContact,chosen.s.blue.killGen,chosen.s.blue.units,chosen.lastOriginalBlueGen,chosen.originalBlue,coreEqual(chosen.s.grid,gunSolo.grid)?'yes':'no',population(chosen.s.grid).blue],
    ['fastest with intact gun',preservedTrace.s.blue.firstContact,preservedTrace.s.blue.killGen,preservedTrace.s.blue.units,preservedTrace.lastOriginalBlueGen,preservedTrace.originalBlue,coreEqual(preservedTrace.s.grid,gunSolo.grid)?'yes':'no',population(preservedTrace.s.grid).blue]]);
  const lwssFlank=recipes['4 LWSS + gun intact gun'];
  recipes.lwssFlank=lwssFlank;
  const flankLWSS=traceFixture(p,[UPPER_GUN,...lwssFlank],[UPPER_EATER]);
  table('LWSS flank: gun intact, eater still blocking',['Recipe','First contact','Kill','Units','Last original blue generation','Original blue at640'],[
    [textRecipe(lwssFlank),flankLWSS.s.blue.firstContact,flankLWSS.s.blue.killGen,flankLWSS.s.blue.units,flankLWSS.lastOriginalBlueGen,flankLWSS.originalBlue]]);
  const defenceRows:Table['rows']=[];
  for(const [name,def]of [['upper gun alone',mirrorArmy(p,[UPPER_GUN])],['upper gun + eater',[...mirrorArmy(p,[UPPER_GUN]),UPPER_EATER]],['lower gun + eater',[...mirrorArmy(p,[LOWER_GUN]),UPPER_EATER]]]as [string,Stamp[]][]){
    const s=simulate(r,p,[],def,true);defenceRows.push([name,s.red.firstContact,s.red.killGen,s.red.units]);
  }
  table('Defence composition baseline (no attacker)',['Blue recipe','Red contact','Red kill','Red exposure units'],defenceRows);
  table('Late gun / stream comparison: generations321…640',['Escort','Core matches out of320','Post-port window matches out of320','Total blue at640'],
    [['fastest',best],['gun-preserving breach',preserved],['LWSS flank',lwssFlank]].map(([name,escort])=>{
      const comparison=lateStreamComparison(p,escort as Stamp[]);
      return [name as string,comparison.coreMatches,comparison.streamMatches,comparison.bluePopulation];
    }));
  progress('Composition, crystal sweep, portrait reactions, and tournament');
  const composition:Table['rows']=[];
  for(const [name,escort] of [['fastest',best],['intact gun',preserved],['LWSS flank',lwssFlank]] as const)for(const gun of [false,true])for(const defence of [false,true]){
    const s=simulate(r,p,[...(gun?[UPPER_GUN]:[]),...escort],defence?[UPPER_EATER]:[],true);
    composition.push([name,gun?'yes':'no',defence?'yes':'no',...metrics(s),coreEqual(s.grid,gunSolo.grid)?'yes':'no']);
  }
  table('Composition interference',['Escort','Gun','Eater','Contact','Kill','HP lost','Units','Red HP','Gun core matches solo'],composition);
  const sweep:Table['rows']=[];
  // Stationary ash is a diagnostic observer fixture, deliberately seeded inside a crystal (illegal deployment).
  const ashGrid=emptyGrid(arenaConfig(r));for(const[x,y]of [[86,46],[87,46],[86,47],[87,47]] as Pt[])ashGrid[y*128+x]=RED;
  const centralRush:Stamp[]=[
    {id:'lwss',x:4,y:42,orientation:4},{id:'lwss',x:14,y:42,orientation:4},{id:'lwss',x:24,y:42,orientation:4},
    {id:'lwss',x:4,y:49,orientation:4},{id:'lwss',x:14,y:49,orientation:4},
  ];
  for(const hitbox of [10,12,14])for(const hp of [48,64,80])for(const cap of [4,8,12]){
    const rules={...r,hitbox,hp,cap};
    const a=simulate(rules,p,[UPPER_GUN],[],true),b=simulate(rules,p,centralRush,[],true),c=simulateGrid(rules,ashGrid,true);
    sweep.push([hitbox,hp,cap,a.blue.firstContact,a.blue.killGen,hp-b.blue.hp,b.blue.units,c.blue.killGen,hp-c.blue.hp]);
  }
  table('Crystal sweep',['Hitbox','HP','Cap','Gun contact','Gun kill','5-LWSS rush HP lost','Rush units','4-cell ash kill','Ash HP lost'],sweep);
  // Local laboratory reactions on this same landscape board, isolated from scoring and zone restrictions.
  const reaction=(red:Pt[],blue:Pt[],gens=150)=>{
    let grid=emptyGrid(arenaConfig(r));for(const[x,y]of red)grid[y*128+x]=RED;for(const[x,y]of blue)grid[y*128+x]=BLUE;
    for(let g=0;g<gens;g++)grid=stepGrid(grid,128,96,false,false);return grid;
  };
  const snark=decodeRle(extraRle.snark,40,30),snarkRed=snark.filter(([x,y])=>x<=44&&y>=49),snarkBlue=snark.filter(pt=>!snarkRed.includes(pt));
  const snarkResult=reaction(snarkRed,snarkBlue);
  const facts:Table['rows']=[['Snark supplied incoming glider',150,population(snarkResult).red,population(snarkResult).blue,'red outgoing glider5 + red block4; supplied RLE recovers 48 blue (historical45 not reproduced)']];
  const buck=decodeRle(extraRle.buckaroo,48,40);
  let buckFixture:Pt[]=[];
  searchBuck:for(const o of [0,3,6,7] as Orientation[])for(let x=36;x<=64;x++)for(let y=22;y<=35;y++){
    const glider=stamp(p,{id:'glider',x,y,orientation:o});
    const grid=reaction(glider,buck),pop=population(grid);
    if(pop.red===5&&pop.blue===23&&localCounts(grid,{x0:46,y0:38,x1:72,y1:50},RED)===0){buckFixture=glider;break searchBuck;}
  }
  if(buckFixture.length){const grid=reaction(buckFixture,buck);facts.push(['Buckaroo found reflection',150,population(grid).red,population(grid).blue,JSON.stringify(buckFixture)]);}
  else facts.push(['Buckaroo approach search',150,null,null,'no recovered reflected fixture in searched rectangle; do not certify']);
  const single=stamp(p,{id:'glider',x:60,y:27,orientation:7});
  const singleResult=reaction(single,stamp(p,UPPER_EATER),160);
  facts.push(['Single glider → certified eater',160,population(singleResult).red,population(singleResult).blue,'red approach x60,y27/o7']);
  const blocks:Table['rows']=[];
  for(let dy=-8;dy<=8;dy++){
    const grid=reaction(stamp(p,{id:'glider',x:50,y:20,orientation:0}),stamp(p,{id:'block',x:65,y:35+dy}),160);
    blocks.push([dy,population(grid).red,population(grid).blue]);
  }
  table('Landscape revalidation of local Life facts',['Fixture','Generation','Red population','Blue population','Setup / caveat'],facts);
  table('Glider / block lane offsets',['Block dy','Red at 160','Blue at 160'],blocks);
  // Phase diagnostics: phase1/2/3 can change LWSS live-cell price and are excluded from release-gate search.
  const phases:Table['rows']=[];
  for(let ph=0;ph<4;ph++)for(let lane=29;lane<=41;lane++){
    let grid=emptyGrid(arenaConfig(r));
    for(const[x,y]of orient(phase(p.lwss.cells,ph),2))grid[(y+lane)*128+x+48]=RED;
    for(const[x,y]of stamp(p,UPPER_EATER))grid[y*128+x]=BLUE;
    const s=simulateGrid(r,grid,true);phases.push([ph,lane,phase(p.lwss.cells,ph).length,s.blue.units,
      stamp(p,UPPER_EATER).filter(([x,y])=>s.grid[y*128+x]===BLUE).length]);
  }
  const phaseSummary:Table['rows']=[];
  for(let ph=0;ph<4;ph++){const rows=phases.filter(row=>row[0]===ph);phaseSummary.push([ph,rows[0][2],rows.length,rows.filter(row=>(row[3] as number)>0).length,rows.filter(row=>row[4]===0).length,Math.max(...rows.map(row=>row[3] as number))]);}
  table('Single-LWSS phase diagnostics vs eater (lanes29…41, x48)',['Phase','Seed live cells','Cases','Damage cases','Original blue sites absent','Max units'],phaseSummary);
  const archetypes:Record<string,Stamp[]>={
    gun:[UPPER_GUN],rush:centralRush,growth:[{id:'rpentomino',x:54,y:25},{id:'rpentomino',x:54,y:64}],
    defence:[{id:'eater1',x:52,y:35,orientation:4},{id:'eater1',x:52,y:57,orientation:6},{id:'block',x:51,y:46}],
    hybrid:[UPPER_GUN,...preserved],
  };
  for(const [name,units]of Object.entries(archetypes))recipes[`tournament ${name}`]=units;
  table('Tournament template costs',['Style','Live-cell cost','Recipe'],Object.entries(archetypes).map(([name,units])=>[name,army(p,units).length,textRecipe(units)]));
  const names=Object.keys(archetypes),tour:Table['rows']=[],summary:Record<string,{wins:number;draws:number;losses:number}>={};
  names.forEach(n=>summary[n]={wins:0,draws:0,losses:0});
  let damaged=0,destroyed=0,sideRed=0,sideBlue=0,draws=0,mirrorMismatch=0;
  for(let i=0;i<names.length;i++)for(let j=i;j<names.length;j++){
    const a=names[i],b=names[j],s=simulate(r,p,archetypes[a],mirrorArmy(p,archetypes[b]));
    const reverse=simulate(r,p,archetypes[b],mirrorArmy(p,archetypes[a]));
    if(s.red.hp!==reverse.blue.hp||s.blue.hp!==reverse.red.hp||s.generation!==reverse.generation)mirrorMismatch++;
    for(const[nameA,nameB,out]of [[a,b,s],[b,a,reverse]] as const){
      if(out.red.units||out.blue.units)damaged++;if(out.red.hp===0||out.blue.hp===0)destroyed++;
      if(out.winner==='draw'){draws++;summary[nameA].draws++;summary[nameB].draws++;}
      else {const redWins=out.winner==='red';if(redWins)sideRed++;else sideBlue++;summary[redWins?nameA:nameB].wins++;summary[redWins?nameB:nameA].losses++;}
    }
    tour.push([a,b,s.winner,s.red.hp,s.blue.hp,s.generation,reverse.winner,reverse.red.hp,reverse.blue.hp]);
  }
  table('Small tournament: 30 games including mirrored self matches',['Red style','Blue style','Winner','Red HP','Blue HP','End gen','Swapped winner','Swapped red HP','Swapped blue HP'],tour);
  table('Tournament rates',['Style','Wins','Draws','Losses','Win rate (draw=0.5)'],names.map(n=>[n,summary[n].wins,summary[n].draws,summary[n].losses,
    `${(100*(summary[n].wins+summary[n].draws/2)/(summary[n].wins+summary[n].draws+summary[n].losses)).toFixed(1)}%`]));
  table('Tournament gates / side bias',['Games','Crystal damaged','Destruction','Red wins','Blue wins','Draws','Mirror HP/end mismatches'],[[30,percent(damaged,30),percent(destroyed,30),sideRed,sideBlue,draws,mirrorMismatch]]);
  // Independent deterministic runs; visible parity belongs to Phase1 because no siege UI exists.
  const parity=simulate(r,p,[UPPER_GUN,...best],[UPPER_EATER],true);
  table('Headless determinism',['Identical grid','Identical HP/accumulators','Generation'],[[parity.grid.every((c,i)=>c===chosen.s.grid[i])?'yes':'no',
    JSON.stringify(parity.blue)===JSON.stringify(chosen.s.blue)&&JSON.stringify(parity.red)===JSON.stringify(chosen.s.red)?'yes':'no',parity.generation]]);
  // Tiny symmetric simultaneous-death observer sanity fixture also appears in tests.
  const tiny={...r,hp:1,unitsPerHP:1};const grid=emptyGrid(arenaConfig(tiny));grid[48*128+40]=BLUE;grid[48*128+88]=RED;
  const simultaneous=observe(tiny,{...initialState(tiny,grid),generation:1});
  table('Simultaneous lethal observation',['Red HP','Blue HP','Winner'],[[simultaneous.red.hp,simultaneous.blue.hp,simultaneous.winner]]);
  return {tables,recipes,gate:gunSolo.blue.killGen!==null&&stopped.s.blue.units===0&&chosen.s.blue.killGen!==null};
}

export function tablesMarkdown(report: ExperimentReport): string {
  const format=(x:string|number|null)=>x===null?'—':String(x).replaceAll('|','\\|').replaceAll('\n',' ');
  return report.tables.map(t=>`### ${t.title}\n\n| ${t.headers.join(' | ')} |\n| ${t.headers.map(()=> '---').join(' | ')} |\n`+
    t.rows.map(row=>`| ${row.map(format).join(' | ')} |`).join('\n')).join('\n\n');
}
export function recipesMarkdown(report:ExperimentReport):string {
  return Object.entries(report.recipes).map(([name,units])=>`- **${name}** (${units.reduce((n,u)=>n+({gosperglidergun:36,eater1:7,lwss:9,glider:5,block:4,rpentomino:5})[u.id],0)} cells): ${textRecipe(units)}`).join('\n');
}
