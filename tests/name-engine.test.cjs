const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../js/name-engine.js');
const ctx={window:{}};
for(const file of ['names','name-grammar','characters'])vm.runInNewContext(fs.readFileSync(require.resolve('../data/'+file+'.js'),'utf8'),ctx);
const data=ctx.window.GR_NAME_DATA,grammar=ctx.window.GR_NAME_GRAMMAR;
const base={race:'Undead',cls:'Warrior',style:'serious',classTheme:true,raunchy:false};
function seeded(seed=1){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function memory(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}}
function engine(extra={}){return E.create({data,grammar,random:seeded(),...extra})}
function record(result,seen,count){assert.equal(result.names.length,count);for(const n of result.names){assert.ok(E.validFull(n.full),n.full);assert.ok(!seen.has(n.full.toLowerCase()),'Repeat: '+n.full);seen.add(n.full.toLowerCase());assert.ok(!/\d/.test(n.full))}}

test('5,000 generated names per Serious/Silly style without repeats or numeric padding',()=>{
 for(const style of ['serious','silly']){
  const e=engine(),seen=new Set();
  for(let batch=0;batch<50;batch++)record(e.generate({...base,style},100),seen,100);
 }
});
test('every supported race/class, style and toggle yields valid unique names',()=>{
 const pools=ctx.window.GR_CHARACTER_DATA;
 for(const faction of ['HORDE','ALLIANCE'])for(const [race,classes] of Object.entries(pools[faction]))for(const cls of classes)
  for(const style of ['serious','clever','silly'])for(const classTheme of [false,true])for(const raunchy of [false,true]){
   const e=engine(),seen=new Set();
   for(let i=0;i<5;i++)record(e.generate({race,cls,style,classTheme,raunchy},3),seen,3);
  }
});
test('history survives reload, identical RNG, config changes and sequential tabs',()=>{
 const storage=memory(),seen=new Set();let a=engine({storage}),b=engine({storage});
 for(let i=0;i<50;i++){
  record(a.generate(base,3),seen,3);
  record(b.generate({...base,classTheme:i%2===0},3),seen,3);
  a=engine({storage});
 }
 assert.equal(JSON.parse(storage.getItem(E.HISTORY_KEY)).length,seen.size);
});
test('old session history and saved favorites are excluded',()=>{
 const control=engine().generate(base,3).names.map(n=>n.full),storage=memory(),legacyStorage=memory();
 storage.setItem('great-reroll-name-forge-favorites-v1',JSON.stringify([{full:control[0]}]));
 legacyStorage.setItem('great-reroll-name-forge-recent-v5',JSON.stringify(control.slice(1)));
 const seen=new Set(control.map(n=>n.toLowerCase()));
 record(engine({storage,legacyStorage}).generate(base,100),seen,100);
});
test('unavailable, malformed and full storage preserve in-page uniqueness',()=>{
 for(const storage of [null,{getItem:()=>'{bad',setItem:()=>{throw Error('quota')}},{getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}}]){
  const e=engine({storage}),seen=new Set();
  for(let i=0;i<30;i++){const r=e.generate(base,3);record(r,seen,3);assert.equal(r.persistent,false)}
 }
});
test('pool exhaustion returns fewer names rather than recycling',()=>{
 const small=JSON.parse(JSON.stringify(grammar));
 small.races.Undead={...small.races.Undead,starts:['Vor'],ends:['an'],roots:['Ash'],tails:['wake']};
 const smallData=JSON.parse(JSON.stringify(data));smallData.RACE_FIRST.Undead=[];smallData.RACE_LAST.Undead=[];
 const e=E.create({data:smallData,grammar:small,random:()=>0});
 const result=e.generate({...base,classTheme:false},3);
 assert.deepEqual(result.names.map(n=>n.full),['Voran Ashwake']);assert.equal(result.exhausted,true);
 assert.equal(e.generate({...base,classTheme:false},3).names.length,0);
});
test('race influences every style; class toggle affects every style; serious ignores adult toggle',()=>{
 for(const style of ['serious','clever','silly']){
  const names=cfg=>engine().generate({...base,style,...cfg},12).names.map(n=>n.full);
  assert.notDeepEqual(names({}),names({race:'Tauren',cls:'Druid'}));
  assert.notDeepEqual(names({}),names({classTheme:false}));
 }
 assert.deepEqual(engine().generate(base,12).names,engine().generate({...base,raunchy:true},12).names.map(n=>({...n,cfg:{...n.cfg,raunchy:false}})));
});
test('within a normal three-name batch, both halves differ',()=>{
 const e=engine();for(const style of ['serious','silly'])for(let i=0;i<200;i++){
  const r=e.generate({...base,style},3).names;
  assert.equal(new Set(r.map(n=>n.first)).size,3);assert.equal(new Set(r.map(n=>n.last)).size,3);
 }
});
test('actual Name Forge UI and draft wrapper share persisted history',()=>{
 const elements=new Map(),storage=memory(),seen=new Set();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:({forgeFaction:'Horde',faction:'Horde',forgeRace:'Undead',forgeClass:'Warrior'})[id]||'',checked:false,disabled:false,textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},setAttribute(){},querySelectorAll:()=>[],scrollIntoView(){}});
  return elements.get(id);
 };
 const window={GRNameEngine:E,GR_NAME_DATA:data,GR_NAME_GRAMMAR:grammar,localStorage:storage,sessionStorage:memory(),scrollTo(){}};
 const sandbox={window,document:{getElementById:element,querySelectorAll:()=>[],body:{classList:{add(){},remove(){}}}},
  HORDE:ctx.window.GR_CHARACTER_DATA.HORDE,ALLIANCE:ctx.window.GR_CHARACTER_DATA.ALLIANCE,escapeHtml:s=>s,console};
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8').split('/* ===== gr-name-forge-js ===== */')[1].split('/* ===== gr-analytics-events ===== */')[0];
 vm.runInNewContext(source,sandbox);
 for(let i=0;i<20;i++){
  element('forgeGenerateAgain').onclick();
  const html=element('forgeResults').innerHTML;
  const names=[...html.matchAll(/class="forge-card-name">([^<]+)</g)].map(m=>m[1]);assert.equal(names.length,3);
  for(const n of names){assert.ok(!seen.has(n));seen.add(n)}
  const draft=window.generateName({race:'Undead',cls:'Warrior'});assert.ok(!seen.has(draft));seen.add(draft);
 }
 assert.match(element('forgeGenerationStatus').textContent,/Three fresh names/);
 assert.equal(JSON.parse(storage.getItem(E.HISTORY_KEY)).length,80);
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 assert.ok(index.indexOf('js/name-engine.js')<index.indexOf('js/app.js'));
 assert.match(index,/id="forgeGenerationStatus"/);
});

 test('Clever only returns approved intact wordplay, including after exhaustion or adult toggles',()=>{
  const all=grammar.clever.names;
  for(const n of all){assert.ok(E.validFull(n.full),n.full);assert.ok(n.meaning.length>3,n.full)}
  for(const race of Object.keys(grammar.races))for(const cls of Object.keys(grammar.classes))for(const classTheme of [false,true])for(const raunchy of [false,true]){
   const e=engine(),cfg={race,cls,style:'clever',classTheme,raunchy},seen=new Set();
   const allowed=new Set(all.filter(n=>(!n.adult||raunchy)&&(!n.races||n.races.includes(race))&&(!n.classes||n.classes.includes(cls))&&(!classTheme||n.classes?.includes(cls))).map(n=>n.full));
   let result;
   do{
    result=e.generate(cfg,3);
    for(const n of result.names){assert.ok(allowed.has(n.full),n.full);assert.ok(!seen.has(n.full),n.full);seen.add(n.full)}
   }while(!result.exhausted);
   assert.deepEqual([...seen].sort(),[...allowed].sort());
   assert.equal(e.generate(cfg,3).names.length,0);
   assert.ok(!seen.has('Whisper Notary'));assert.ok(!seen.has('Saul Carrionwhisper'));
  }
 });
 test('Clever repeat protection holds across settings changes and reloads',()=>{
  const storage=memory(),seen=new Set();
  for(const classTheme of [true,false,true]){
   const e=engine({storage});for(let i=0;i<30;i++){
    const r=e.generate({...base,cls:'Rogue',style:'clever',classTheme},3);
    for(const n of r.names){assert.ok(!seen.has(n.full));seen.add(n.full)}
   }
  }
 });
