
/* ===== core-app ===== */
const {ORIGINAL_LORE,HORDE,ALLIANCE,CLASS_SPECS,ROLES,GREAT_REROLL_CLASS_ICONS,GREAT_REROLL_RACE_ICONS,GREAT_REROLL_CLASS_COLORS}=window.GR_CHARACTER_DATA;
// Skyborne class availability follows the user-provided faction character-creation screenshots.
// Complete 28-per-faction roster approved by the user; Skyborne follows their in-game screenshots.


 const $=id=>document.getElementById(id);let players=['Player 1','Player 2','Player 3','Player 4'],selected={},req={},draft=null,pending=null,offers=[];
function pool(){return $('faction').value==='Horde'?HORDE:ALLIANCE}function key(r,c){return r+'|'+c}function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function save(){try{localStorage.setItem('guild-draft-offline-v2',JSON.stringify({players,selected,req,config:readConfig()}))}catch(e){}}
function readConfig(){return Object.fromEntries(['guild','faction','format','options','duplicates','enforce','pickTimer','nameGenerator','draftOrder'].map(id=>[id,$(id).value]))}
function renderPlayers(){ $('players').innerHTML=players.map((p,i)=>`<label class="rowx">${i+1}. <input class="field playerinput" data-i="${i}" value="${escapeHtml(p)}" maxlength="32"></label>`).join('');$('playerCount').textContent=players.length+' players';document.querySelectorAll('.playerinput').forEach(el=>el.oninput=()=>{players[+el.dataset.i]=el.value;save()})}
function allKeys(){return Object.entries(pool()).flatMap(([r,cs])=>cs.map(c=>key(r,c)))}
function renderCombos(){let p=pool();$('combos').innerHTML=Object.entries(p).map(([r,cs])=>`<details ${r==='Orc'||r==='Human'?'open':''}><summary>${escapeHtml(r)} · <span id="cnt-${r.replaceAll(' ','_')}"></span></summary><div class="rowx"><button class="btnx alt raceAll" data-r="${r}">All ${r}</button><button class="btnx alt raceNone" data-r="${r}">None</button></div><div class="checks">${cs.map(c=>`<label><input type="checkbox" class="combo" data-key="${key(r,c)}" ${selected[key(r,c)]?'checked':''}> ${c}</label>`).join('')}</div></details>`).join('');document.querySelectorAll('.combo').forEach(el=>el.onchange=()=>{selected[el.dataset.key]=el.checked;updateCounts();save()});document.querySelectorAll('.raceAll,.raceNone').forEach(el=>el.onclick=()=>{pool()[el.dataset.r].forEach(c=>selected[key(el.dataset.r,c)]=el.classList.contains('raceAll'));renderCombos();save()});$('skyNote').textContent=$('faction').value==='Alliance'?'Skyborne class eligibility and Forever-specific specializations have not been verified. Skyborne combinations here are an editable placeholder; confirm the official game rules before using them for a guild event.':'Horde combinations preserve the pool from your original uploaded game. Forever-specific role/spec labels are configurable planning assumptions.';updateCounts()}
function updateCounts(){let count=allKeys().filter(k=>selected[k]).length;$('poolCount').textContent=count+' enabled combinations';Object.keys(pool()).forEach(r=>{let el=$('cnt-'+r.replaceAll(' ','_'));if(el)el.textContent=pool()[r].filter(c=>selected[key(r,c)]).length+'/'+pool()[r].length})}
function targets(){return [...Object.keys(CLASS_SPECS).map(c=>({id:'class:'+c,label:c})),...ROLES.map(r=>({id:'role:'+r,label:r}))]}
function renderReq(){for(let type of ['class','role'])$(type+'Req').innerHTML=targets().filter(t=>t.id.startsWith(type+':')).map(t=>`<div class="reqrow"><span>${t.label}</span><input class="field req" aria-label="${t.label} minimum" data-id="${t.id}" data-bound="min" type="number" min="0" max="99" value="${req[t.id]?.min||0}"><input class="field req" aria-label="${t.label} maximum (zero means no cap)" data-id="${t.id}" data-bound="max" type="number" min="0" max="99" value="${req[t.id]?.max||0}"></div>`).join('');for(let type of ['class','role'])$(type+'Req').insertAdjacentHTML('afterbegin','<div class="reqrow muted small"><span>Requirement</span><span>Min</span><span>Max (0=∞)</span></div>');document.querySelectorAll('.req').forEach(el=>el.onchange=()=>{req[el.dataset.id]??={min:0,max:0};req[el.dataset.id][el.dataset.bound]=Math.max(0,Math.floor(Number(el.value)||0));el.value=req[el.dataset.id][el.dataset.bound];save()})}
function combinations(){return Object.entries(pool()).flatMap(([race,cs])=>cs.filter(cls=>selected[key(race,cls)]).map(cls=>({race,cls,key:key(race,cls)})))}
function variants(){let fmt=$('format').value;return combinations().flatMap(b=>fmt==='class'?[{...b,spec:'',role:''}]:fmt==='role'?[...new Set(CLASS_SPECS[b.cls].map(x=>x[1]))].map(role=>({...b,role,spec:''})):CLASS_SPECS[b.cls].map(([spec,role])=>({...b,spec,role})))}
function limits(){return targets().filter(t=>(req[t.id]?.min||0)>0||(req[t.id]?.max||0)>0).map(t=>({...t,min:req[t.id]?.min||0,max:req[t.id]?.max||0}))}
function counts(picks){let c={};for(let p of picks){c['class:'+p.cls]=(c['class:'+p.cls]||0)+1;if(p.role)c['role:'+p.role]=(c['role:'+p.role]||0)+1}return c}
function feasible(picks,remaining,used,checkMin=true){let ls=limits(),cs=counts(picks);for(let t of ls){if(t.max&&cs[t.id]>t.max)return false;if(checkMin&&cs[t.id]+remaining<t.min)return false}if(!checkMin||!ls.length)return true;
let base=variants().filter(v=>$('duplicates').value==='repeat'||!used.has(v.key));if(!base.length&&remaining)return false;
// Exact feasibility search with memoization, respecting unique race/class keys and overlapping class/role targets.
let relevant=ls.filter(t=>t.min>cs[t.id]);if(!relevant.length)return base.length>0||remaining===0;
let memo=new Set(),steps=0;function walk(depth,curr,keys){if(++steps>200000)return null;if(relevant.every(t=>(curr[t.id]||0)>=t.min))return true;if(depth===remaining)return false;let state=depth+'|'+relevant.map(t=>Math.min(t.min,curr[t.id]||0)).join(',')+'|'+(draft?.duplicates==='unique'?[...keys].sort().join(','):'');if(memo.has(state))return false;let arr=base.filter(v=>draft.duplicates!=='unique'||!keys.has(v.key)).filter(v=>ls.every(t=>!t.max||(curr[t.id]||0)+(t.id==='class:'+v.cls||t.id==='role:'+v.role?1:0)<=t.max));for(let v of arr){let n={...curr};n['class:'+v.cls]=(n['class:'+v.cls]||0)+1;if(v.role)n['role:'+v.role]=(n['role:'+v.role]||0)+1;let nextKeys=new Set(keys);if(draft.duplicates==='unique')nextKeys.add(v.key);let ok=walk(depth+1,n,nextKeys);if(ok===true)return true;if(ok===null)return null}memo.add(state);return false}return walk(0,cs,new Set(used))}
function randomize(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function pickOffers(){let used=new Set(draft.picks.map(p=>p.key)),remaining=players.length-draft.picks.length-1;let candidates=randomize(variants().filter(v=>draft.duplicates==='repeat'||!used.has(v.key)));let eligible=[];for(let v of candidates){let picks=[...draft.picks,v],u=new Set(used);if(draft.duplicates==='unique')u.add(v.key);let ok=draft.enforce==='hard'?feasible(picks,remaining,u):feasible(picks,remaining,u,false);if(ok===true)eligible.push(v)}let unique=[];for(let v of eligible)if(!unique.some(x=>x.key===v.key))unique.push(v);return unique.slice(0,draft.options)}
function validate(){let p=players.map(s=>s.trim()),n=+ $('options').value,base=combinations(),ls=limits(),fmt=$('format').value,unique=$('duplicates').value==='unique';if(p.length<1||p.some(x=>!x))return 'Every player needs a name.';if(!base.length)return 'Enable at least one eligible race/class combination.';if(unique&&base.length<p.length+n-1)return `To guarantee ${n} choices on the final turn for ${p.length} players, enable at least ${p.length+n-1} unique combinations (currently ${base.length}), reduce the option count, or allow duplicates.`;if(!unique&&base.length<n)return `Enable at least ${n} combinations to show ${n} different options on each turn.`;for(let t of ls){if(t.max&&t.min>t.max)return t.label+': minimum exceeds maximum.';if(t.min>p.length)return t.label+': minimum exceeds the player count.';if(t.id.startsWith('role:')&&fmt==='class')return 'Role requirements require the Race + class + intended role or specialization draft format.';if(!variants().some(v=>t.id==='class:'+v.cls||t.id==='role:'+v.role)&&t.min)return t.label+' is required but unavailable in the eligible pool.'}if($('enforce').value==='hard'){draft={duplicates:$('duplicates').value};let ok=feasible([],p.length,new Set());draft=null;if(ok===false)return 'The chosen pool cannot satisfy all hard roster requirements simultaneously. Adjust your targets, eligible combinations, or duplicate setting.';if(ok===null)return 'The hard-requirement validation is too complex to prove safely in this demo. Reduce the pool or use soft requirements.'}return ''}
function start(){let err=validate();$('setupError').classList.toggle('hidden',!err);$('setupError').textContent=err;if(err)return;draft={guild:$('guild').value.trim()||'Guild Draft',faction:$('faction').value,format:$('format').value,options:+$('options').value,duplicates:$('duplicates').value,enforce:$('enforce').value,nameGenerator:$('nameGenerator').value,picks:[],names:[...players]};$('setup').classList.add('hidden');$('draft').classList.remove('hidden');$('draftTitle').textContent=draft.guild+' · '+draft.faction;nextTurn()}
function nextTurn(){pending=null;let finished=draft.picks.length===draft.names.length;$('confirmArea').classList.add('hidden');$('turnLabel').textContent=finished?'DRAFT COMPLETE':`Turn ${draft.picks.length+1} of ${draft.names.length} · ${draft.names[draft.picks.length]}`;$('offerTitle').textContent=finished?'Your guild roster is complete':draft.options===1?'The random main lottery':'Choose your destiny';$('draftMessage').classList.add('hidden');offers=finished?[]:pickOffers();if(!finished&&offers.length<draft.options){$('draftMessage').classList.remove('hidden');$('draftMessage').classList.add('bad');$('draftMessage').textContent=`Unable to produce all ${draft.options} valid choices for this turn under the configured requirements. No pick was made. Return to settings and adjust the rules.`;offers=[]}renderOffers();renderRoster();renderTracker()}
function atlasIndex(v){let i=Object.entries(HORDE).flatMap(([r,cs])=>cs.map(c=>r+'|'+c)).indexOf(v.key);return i}

const ALLIANCE_ART_KEYS=Object.entries({...ALLIANCE,Human:['Warrior','Paladin','Rogue','Priest','Mage','Warlock'],Dwarf:['Warrior','Paladin','Hunter','Rogue','Priest'],Gnome:['Warrior','Rogue','Mage','Warlock'],Skyborne:['Warrior','Paladin','Hunter','Rogue','Priest','Shaman','Mage','Warlock','Druid']}).flatMap(([race,classes])=>classes.map(cls=>race+'|'+cls));
function allianceArtIndex(v){const direct=ALLIANCE_ART_KEYS.indexOf(v.race+'|'+v.cls);if(direct>=0)return direct;const fallback={'Human|Hunter':'Human|Rogue','Dwarf|Shaman':'Dwarf|Priest','Gnome|Priest':'Gnome|Mage'}[v.race+'|'+v.cls];return fallback?ALLIANCE_ART_KEYS.indexOf(fallback):-1}
function art(v){let i=v.race==='Skyborne'?-1:atlasIndex(v);if(i>=0)return `background-size:400% 600%;background-position:${i%4/3*100}% ${Math.floor(i/4)/5*100}%;`;let a=allianceArtIndex(v);return a>=0?`background-size:500% 600%;background-position:${a%5/4*100}% ${Math.floor(a/5)/5*100}%;`:``;}
function optionLabel(v){return `${v.race} ${v.spec?v.spec+' ':v.role?v.role+' ':''}${v.cls}`}
function description(v){return ORIGINAL_LORE[v.race+' '+v.cls]||`A ${v.race} ${v.cls} setting out to forge a legend. ${v.spec?`Their path is ${v.spec}, serving as ${v.role}.`:v.role?`Their intended role is ${v.role}.`:''}`}
function portrait(v){return `<div class="portraitx ${v.race!=='Skyborne'&&atlasIndex(v)>=0?'atlas-portrait':allianceArtIndex(v)>=0?'alliance-atlas-portrait':''}" style="${art(v)}"></div>`}
function renderPreview(v){let box=$('characterPreview');box.classList.toggle('hidden',!v);box.innerHTML=v?`${portrait(v)}<h3>${escapeHtml(optionLabel(v))}</h3><span class="pill">${escapeHtml(v.role||'Race / Class')}</span><p>${escapeHtml(description(v))}</p>`:''}
function renderFullPool(){let used=new Set(draft.picks.map(p=>p.key));$('fullPool').innerHTML=combinations().map(v=>`<div class="option ${used.has(v.key)&&draft.duplicates==='unique'?'taken':''}">${portrait(v)}<strong>${escapeHtml(v.race+' '+v.cls)}</strong><span class="pill">${used.has(v.key)?'Drafted':'Available'}</span></div>`).join('')}
function renderOffers(){let done=draft.picks.length===draft.names.length;$('offers').style.setProperty('--offer-cols',Math.min(offers.length,5));$('offers').innerHTML=done?'<div class="notice good">The draft is finished. Export your roster above.</div>':offers.map((v,i)=>`<button class="option" data-i="${i}">${portrait(v)}<strong>${escapeHtml(optionLabel(v))}</strong><span class="pill">${v.role||'Class draft'}</span><div class="muted small">Option ${i+1} · CHOOSE</div></button>`).join('');document.querySelectorAll('#offers .option').forEach(b=>b.onclick=()=>selectOffer(+b.dataset.i));renderPreview(null);renderFullPool();if(!done&&draft.options===1&&offers.length===1){$('draftMessage').classList.remove('hidden');$('draftMessage').classList.remove('bad');$('draftMessage').textContent='Your character has been randomly drawn. Reveal your fate, then lock in the assignment.';let b=document.querySelector('#offers .option');b.innerHTML='<div class="portraitx" style="background-image:linear-gradient(135deg,#78542d,#182b3b)"></div><strong>??? · YOUR FATE AWAITS</strong><span class="pill">REVEAL CHARACTER</span>';b.onclick=()=>selectOffer(0)}}
function generateName(v){let first={Orc:['Gore','Rumble','Goro','Orcrush'],Tauren:['Sable','Highland','Dahmoo','Timber'],Troll:['Malice','Jungle','Zul','Bo'],Undead:['Grim','Dread','Ash','Crow'],Human:['Aldric','Rowan','Cedric'],Dwarf:['Borin','Thrain','Bran'],Gnome:['Fizz','Tinker','Nim'], 'Night Elf':['Sable','Sylvan','Thorn'],Skyborne:['Aether','Skyr','Zephyr']}[v.race]||['Storm'];let last={Warrior:['Hammerhoof','War Tusk','Ironwall'],Druid:['Fang','Kane','Hollow'],Rogue:['Ripper','Shade','Silence'],Mage:['Montana','Starfire','Rune'],Shaman:['Thundercrack','Thunderrock','Storm'],Paladin:['Lightbringer','Dawnshield','Valor'],Priest:['Figure','Dawn','Whisper'],Warlock:['Crow','Hex','Grim'],Hunter:['Buckshot','Grim','Hollow']}[v.cls]||['Thunderrock'];return first[Math.floor(Math.random()*first.length)]+' '+last[Math.floor(Math.random()*last.length)]}
function selectOffer(i){pending=offers[i];if(!pending)return;$('confirmArea').classList.remove('hidden');renderPreview(pending);document.querySelectorAll('#offers .option').forEach((b,j)=>b.classList.toggle('active',j===i));$('charName').value=draft.nameGenerator==='on'?generateName(pending):'';$('confirm').textContent=draft.options===1?'Lock in assigned character':'Lock in selection';$('confirmArea').scrollIntoView({behavior:'smooth',block:'nearest'})}
function lock(){if(!pending)return;let remaining=draft.names.length-draft.picks.length-1,used=new Set(draft.picks.map(p=>p.key));if(draft.duplicates==='unique')used.add(pending.key);let result=draft.enforce==='hard'?feasible([...draft.picks,pending],remaining,used):true;if(result!==true){$('draftMessage').classList.remove('hidden');$('draftMessage').textContent='This selection no longer satisfies the hard requirements.';return}draft.picks.push({...pending,name:$('charName').value.trim(),player:draft.names[draft.picks.length]});nextTurn()}
function renderRoster(){$('roster').innerHTML=draft.names.map((name,i)=>{let p=draft.picks[i];return `<div class="pick ${i===draft.picks.length?'active':''}"><span>${i+1}. ${escapeHtml(name)}</span><span>${p?`<b>${escapeHtml(optionLabel(p))}</b><br><span class="muted small">${escapeHtml(p.name||'Unnamed')}</span>`:i===draft.picks.length?'← On the clock':'Waiting'}</span></div>`}).join('')}
function renderTracker(){let cs=counts(draft.picks),ls=limits();$('tracker').innerHTML=`<p>${draft.picks.length}/${draft.names.length} drafted · ${draft.names.length-draft.picks.length} remaining</p>`+(ls.length?ls.map(t=>{let n=cs[t.id]||0;return `<div><div class="rowx" style="justify-content:space-between"><span>${t.label}</span><span>${n}${t.min?' / min '+t.min:''}${t.max?' / max '+t.max:''}</span></div><div class="progress"><div style="width:${t.min?Math.min(100,n/t.min*100):t.max?Math.min(100,n/t.max*100):0}%"></div></div></div>`}).join(''):'<p class="muted">No roster requirements enabled.</p>')+`<p class="help">${draft.enforce==='hard'?'Hard requirements: only feasible picks are offered.':draft.enforce==='soft'?'Soft requirements: goals are tracked, but not guaranteed.':'Unrestricted draft.'}</p>`}
function exportCsv(){let lines=[['Player','Faction','Race','Class','Specialization','Role','Character Name'],...draft.picks.map(p=>[p.player,draft.faction,p.race,p.cls,p.spec,p.role,p.name])];let csv=lines.map(r=>r.map(v=>'"'+String(v||'').replaceAll('"','""')+'"').join(',')).join('\r\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='guild-draft-roster.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
$('faction').onchange=()=>{selected=Object.fromEntries(allKeys().map(k=>[k,true]));renderCombos();save()};$('addPlayer').onclick=()=>{if(players.length>=40)return;players.push('Player '+(players.length+1));renderPlayers();save()};$('removePlayer').onclick=()=>{if(players.length<=1)return;players.pop();renderPlayers();save()};$('allCombos').onclick=()=>{allKeys().forEach(k=>selected[k]=true);renderCombos();save()};$('noCombos').onclick=()=>{allKeys().forEach(k=>selected[k]=false);renderCombos();save()};$('start').onclick=start;$('confirm').onclick=lock;$('cancel').onclick=()=>{$('confirmArea').classList.add('hidden');pending=null;renderPreview(null)};$('rerollName').onclick=()=>{if(pending)$('charName').value=generateName(pending)};$('backSetup').onclick=()=>{if(!confirm('Start a new draft? Your current selections will be cleared. Export the roster first if needed.'))return;draft=null;$('draft').classList.add('hidden');$('setup').classList.remove('hidden')};$('export').onclick=exportCsv;$('resetSetup').onclick=()=>{if(confirm('Reset all configuration settings?')){localStorage.removeItem('guild-draft-offline-v2');location.reload()}};
try{let s=JSON.parse(localStorage.getItem('guild-draft-offline-v2')||'null');if(s){players=s.players||players;selected=s.selected||{};req=s.req||{};for(let [k,v] of Object.entries(s.config||{}))if($(k))$(k).value=v}}catch(e){}if(!Object.keys(selected).length)allKeys().forEach(k=>selected[k]=true);for(const k of allKeys())if(!(k in selected))selected[k]=true;renderPlayers();renderCombos();renderReq();for(let id of ['guild','format','options','duplicates','enforce'])$(id).addEventListener('change',save);


/* Two-stage guild roster draft: preserves the original character lottery paths. */
const originalValidate=validate, originalStart=start, originalNextTurn=nextTurn, originalRenderOffers=renderOffers, originalSelectOffer=selectOffer, originalLock=lock, originalRenderRoster=renderRoster, originalRenderTracker=renderTracker, originalRenderFullPool=renderFullPool, originalExportCsv=exportCsv;
let stageOnePicks=[], stageTwoPicks=[],stagePhase=1;
function twoStageMode(){return !!draft&&draft.format==='twostage'}
function stageOneVariants(){let map=new Map();for(let b of combinations()){for(let [,role] of CLASS_SPECS[b.cls]){let k=b.race+'|'+role;if(!map.has(k))map.set(k,{race:b.race,role,cls:'',spec:'',key:k})}}return [...map.values()]}
function stageTwoVariants(player){let b=stageOnePicks[player];return combinations().filter(x=>x.race===b.race).flatMap(x=>CLASS_SPECS[x.cls].filter(y=>y[1]===b.role).map(([spec,role])=>({...x,spec,role}))).filter(x=>draft.duplicates==='repeat'||!stageTwoPicks.some(p=>p&&p.key===x.key))}
function stageOneCounts(picks){let out={};for(let p of picks)out['role:'+p.role]=(out['role:'+p.role]||0)+1;return out}
function stageOneAllowed(picks,remaining){let c=stageOneCounts(picks);for(let r of ROLES){let t=req['role:'+r]||{},n=c['role:'+r]||0;if(t.max&&n>t.max)return false;if(t.min&&n+remaining<t.min)return false}return true}
function stageOneFeasible(picks,remaining){if(!stageOneAllowed(picks,remaining))return false;let available=new Set(stageOneVariants().map(v=>v.role));let c=stageOneCounts(picks),need=0;for(let r of ROLES){let t=req['role:'+r]||{};let deficit=Math.max(0,(t.min||0)-(c['role:'+r]||0));if(deficit&&!available.has(r))return false;need+=deficit}return need<=remaining}
function stageTwoRemainingFeasible(candidate,index){if(draft.duplicates==='repeat')return true;let used=new Set(stageTwoPicks.filter(Boolean).map(p=>p.key));used.add(candidate.key);for(let i=index+1;i<draft.names.length;i++){let v=stageTwoVariants(i).filter(x=>!used.has(x.key));if(!v.length)return false}return true}
function twoStageValidation(){let names=players.map(x=>x.trim()),n=+$('options').value;if(!names.length||names.some(x=>!x))return 'Every player needs a name.';let pool=stageOneVariants();if(!pool.length)return 'Enable eligible race/class combinations first.';if(pool.length<n)return `Only ${pool.length} distinct race/role choices exist. Reduce Stage 1 options to ${pool.length} or expand the pool.`;if($('enforce').value==='hard'){let min=ROLES.reduce((sum,r)=>sum+(req['role:'+r]?.min||0),0);if(min>players.length)return 'Role minimums exceed the player count.';for(let r of ROLES){let t=req['role:'+r]||{};if(t.max&&t.min>t.max)return r+': minimum exceeds maximum.';if(t.min&&!pool.some(v=>v.role===r))return r+' is required but unavailable.'}let classGoals=Object.keys(CLASS_SPECS).some(c=>(req['class:'+c]?.min||0)>0||(req['class:'+c]?.max||0)>0);if(classGoals)return 'In two-stage mode, class targets are tracked as soft goals only. Choose Soft requirements or remove class targets to use Hard role enforcement.'}return ''}
validate=function(){return $('format').value==='twostage'?twoStageValidation():originalValidate()};
start=function(){if($('format').value!=='twostage')return originalStart();let error=twoStageValidation();$('setupError').classList.toggle('hidden',!error);$('setupError').textContent=error;if(error)return;draft={guild:$('guild').value.trim()||'Guild Draft',faction:$('faction').value,format:'twostage',options:+$('options').value,stageTwoOptions:+$('stageTwoOptions').value,duplicates:$('duplicates').value,enforce:$('enforce').value,picks:[],names:[...players]};stagePhase=1;stageOnePicks=[];stageTwoPicks=[];$('setup').classList.add('hidden');$('draft').classList.remove('hidden');$('draftTitle').textContent=draft.guild+' · '+draft.faction;nextTurn()};
function twoStageOffers(){let idx=stagePhase===1?stageOnePicks.length:stageTwoPicks.length;if(stagePhase===1){let remaining=draft.names.length-idx-1;return randomize(stageOneVariants().filter(v=>draft.enforce!=='hard'||stageOneFeasible([...stageOnePicks,v],remaining))).slice(0,draft.options)}let options=stageTwoVariants(idx);if(draft.enforce==='hard')options=options.filter(v=>stageTwoRemainingFeasible(v,idx));return randomize(options).slice(0,draft.stageTwoOptions)}
nextTurn=function(){if(!twoStageMode())return originalNextTurn();pending=null;$('confirmArea').classList.add('hidden');$('characterPreview').classList.add('hidden');$('draftMessage').classList.add('hidden');$('draftMessage').classList.remove('bad');let done=stagePhase===1?stageOnePicks.length===draft.names.length:stageTwoPicks.length===draft.names.length;let idx=stagePhase===1?stageOnePicks.length:stageTwoPicks.length;$('phaseControls').classList.toggle('hidden',!(stagePhase===1&&done));$('turnLabel').textContent=done?(stagePhase===1?'STAGE 1 COMPLETE · Roles assigned':'DRAFT COMPLETE'):`STAGE ${stagePhase} · Turn ${idx+1} of ${draft.names.length} · ${draft.names[idx]}`;$('offerTitle').textContent=stagePhase===1?'Stage 1 · Draft your race + intended role':'Stage 2 · Draft your class + specialization';offers=done?[]:twoStageOffers();if(!done&&!offers.length){$('draftMessage').classList.remove('hidden');$('draftMessage').classList.add('bad');$('draftMessage').textContent='No eligible options remain for this player. Return to settings and adjust the pool, duplicate rules, or requirements.'}renderOffers();renderRoster();renderTracker()};
optionLabel=function(v){return twoStageMode()&&stagePhase===1?v.race+' '+v.role:v.race+' '+(v.spec?v.spec+' ':'')+(v.cls||v.role)};
portrait=function(v){if(twoStageMode()&&stagePhase===1){let first=combinations().find(x=>x.race===v.race&&CLASS_SPECS[x.cls].some(y=>y[1]===v.role));if(first)return `<div class="portraitx ${atlasIndex(first)>=0?'atlas-portrait':allianceArtIndex(first)>=0?'alliance-atlas-portrait':''}" style="${art(first)}"></div>`}return `<div class="portraitx ${atlasIndex(v)>=0?'atlas-portrait':allianceArtIndex(v)>=0?'alliance-atlas-portrait':''}" style="${art(v)}"></div>`};
description=function(v){if(twoStageMode()&&stagePhase===1)return `You have drawn the path of a ${v.race} ${v.role}. Your race and combat role will be locked in. In Stage 2 you will choose an eligible class and specialization for this path.`;return ORIGINAL_LORE[v.race+' '+v.cls]||`A ${v.race} ${v.cls} following the ${v.spec||v.role} path.`};
renderOffers=function(){if(!twoStageMode())return originalRenderOffers();let done=stagePhase===1?stageOnePicks.length===draft.names.length:stageTwoPicks.length===draft.names.length;$('offers').style.setProperty('--offer-cols',Math.max(1,Math.min(offers.length,5)));$('offers').innerHTML=done?`<div class="notice good">${stagePhase===1?'Every player has a race and role. Begin Stage 2 above.':'Your guild roster is complete. Export your CSV above.'}</div>`:offers.map((v,i)=>`<button class="option" data-i="${i}">${portrait(v)}<strong>${escapeHtml(optionLabel(v))}</strong><span class="pill">${escapeHtml(v.role)}</span><div class="muted small">Option ${i+1} · CHOOSE</div></button>`).join('');document.querySelectorAll('#offers .option').forEach(b=>b.onclick=()=>selectOffer(+b.dataset.i));renderPreview(null);renderFullPool()};
renderFullPool=function(){if(!twoStageMode())return originalRenderFullPool();let used=new Set(stageTwoPicks.filter(Boolean).map(p=>p.key));$('fullPool').innerHTML=(stagePhase===1?stageOneVariants():combinations()).map(v=>`<div class="option ${used.has(v.key)&&draft.duplicates==='unique'?'taken':''}">${portrait(v)}<strong>${escapeHtml(stagePhase===1?v.race+' '+v.role:v.race+' '+v.cls)}</strong><span class="pill">${stagePhase===1?'Race + role':used.has(v.key)?'Drafted':'Available'}</span></div>`).join('')};
selectOffer=function(i){if(!twoStageMode())return originalSelectOffer(i);pending=offers[i];if(!pending)return;$('confirmArea').classList.remove('hidden');renderPreview(pending);document.querySelectorAll('#offers .option').forEach((b,j)=>b.classList.toggle('active',j===i));$('characterNameWrap').classList.toggle('hidden',stagePhase===1||draft.nameGenerator!=='on');$('rerollName').classList.toggle('hidden',stagePhase===1||draft.nameGenerator!=='on');if(stagePhase===2)$('charName').value=draft.nameGenerator==='on'?generateName(pending):'';$('confirm').textContent=stagePhase===1?'Lock in race + role':'Lock in class + spec';$('confirmArea').scrollIntoView({behavior:'smooth',block:'nearest'})};
lock=function(){if(!twoStageMode())return originalLock();if(!pending)return;if(stagePhase===1){let remaining=draft.names.length-stageOnePicks.length-1;if(draft.enforce==='hard'&&!stageOneFeasible([...stageOnePicks,pending],remaining))return;stageOnePicks.push({...pending,player:draft.names[stageOnePicks.length]})}else{let i=stageTwoPicks.length;if(!stageTwoVariants(i).some(v=>v.key===pending.key&&v.spec===pending.spec))return;if(draft.enforce==='hard'&&!stageTwoRemainingFeasible(pending,i))return;stageTwoPicks.push({...pending,player:draft.names[i],name:$('charName').value.trim()})}nextTurn()};
renderRoster=function(){if(!twoStageMode())return originalRenderRoster();$('roster').innerHTML=draft.names.map((name,i)=>{let first=stageOnePicks[i],second=stageTwoPicks[i],active=stagePhase===1?i===stageOnePicks.length:i===stageTwoPicks.length;return `<div class="pick ${active?'active':''}"><span>${i+1}. ${escapeHtml(name)}</span><span>${first?`<b>${escapeHtml(first.race+' '+first.role)}</b>`:'Waiting for role'}<br><span class="muted small">${second?escapeHtml(second.spec+' '+second.cls+' · '+(second.name||'Unnamed')):stagePhase===2&&first?'Awaiting class + spec':active?'← On the clock':''}</span></span></div>`}).join('')};
renderTracker=function(){if(!twoStageMode())return originalRenderTracker();let p=stagePhase===1?stageOnePicks:stageTwoPicks;let cs=stageOneCounts(stageOnePicks),ls=limits();let cls={};stageTwoPicks.forEach(x=>cls['class:'+x.cls]=(cls['class:'+x.cls]||0)+1);$('tracker').innerHTML=`<p><b>Stage ${stagePhase}</b> · ${p.length}/${draft.names.length} drafted</p>`+ls.map(t=>{let n=t.id.startsWith('role:')?(cs[t.id]||0):(cls[t.id]||0);return `<div class="rowx" style="justify-content:space-between"><span>${escapeHtml(t.label)}</span><span>${n}${t.min?' / min '+t.min:''}${t.max?' / max '+t.max:''}</span></div>`}).join('')+`<p class="help">${stagePhase===1?'Race and role are locked after Stage 1.':'Class targets are tracked, not guaranteed. Race and role remain locked.'}</p>`};
exportCsv=function(){if(!twoStageMode())return originalExportCsv();let rows=[['Player','Faction','Race','Role','Class','Specialization','Character Name'],...draft.names.map((name,i)=>[name,draft.faction,stageOnePicks[i]?.race,stageOnePicks[i]?.role,stageTwoPicks[i]?.cls,stageTwoPicks[i]?.spec,stageTwoPicks[i]?.name])];let csv=rows.map(r=>r.map(v=>'"'+String(v||'').replaceAll('"','""')+'"').join(',')).join('\r\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='guild-two-stage-roster.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
$('beginStageTwo').onclick=()=>{if(!twoStageMode()||stagePhase!==1||stageOnePicks.length!==draft.names.length)return;stagePhase=2;nextTurn()};
const originalBackSetup=$('backSetup').onclick;$('backSetup').onclick=()=>{originalBackSetup();if($('draft').classList.contains('hidden'))$('phaseControls').classList.add('hidden')};
$('format').addEventListener('change',()=>{$('stageTwoOptionsWrap').classList.toggle('hidden',$('format').value!=='twostage')});$('stageTwoOptionsWrap').classList.toggle('hidden',$('format').value!=='twostage');$('stageTwoOptions').addEventListener('change',save);

/* Simple two-mode selector; retain the tested underlying draft engines. */
const modeLottery=document.getElementById('modeLottery'),modeRoster=document.getElementById('modeRoster'),lotterySpec=document.getElementById('lotterySpec');
function setDraftMode(mode){
 const roster=mode==='roster';
 $('format').value=roster?'twostage':lotterySpec.value;
 modeLottery.classList.toggle('chosen',!roster);modeRoster.classList.toggle('chosen',roster);
 modeLottery.setAttribute('aria-pressed',String(!roster));modeRoster.setAttribute('aria-pressed',String(roster));
 modeLottery.querySelector('em').textContent=roster?'CHOOSE MODE':'SELECTED';modeRoster.querySelector('em').textContent=roster?'SELECTED':'CHOOSE MODE';
 $('lotterySpecWrap').classList.toggle('hidden',roster);
 $('stageTwoOptionsWrap').classList.toggle('hidden',!roster);
 $('modeDescription').textContent=roster?'Guild Roster Draft: Stage 1 assigns race + role; Stage 2 assigns an eligible class + specialization.':'Character Lottery: each player drafts an illustrated race + class'+(lotterySpec.value==='spec'?' + specialization':'')+' character.';
 document.querySelector('#setup .panelx:nth-child(5) h2').textContent=roster?'4 · Guild roster requirements (optional)':'4 · Advanced requirements (optional)';
 save();
}
modeLottery.onclick=()=>setDraftMode('lottery');modeRoster.onclick=()=>setDraftMode('roster');
lotterySpec.onchange=()=>setDraftMode('lottery');
if($('format').value==='spec')lotterySpec.value='spec';
setDraftMode($('format').value==='twostage'?'roster':'lottery');

/* Configurable per-pick countdown, shared by both offline draft modes. */
let pickClockInterval=null, pickClockDeadline=0, pickClockTurn='', pickClockBusy=false;
function stopPickClock(){if(pickClockInterval!==null)clearInterval(pickClockInterval);pickClockInterval=null;pickClockDeadline=0;pickClockTurn='';$('pickTimerDisplay').style.display='none'}
function activePickKey(){if(!draft||$('draft').classList.contains('hidden'))return '';if(twoStageMode()){let count=stagePhase===1?stageOnePicks.length:stageTwoPicks.length;return count<draft.names.length&&offers.length?`stage${stagePhase}:${count}`:''}return draft.picks.length<draft.names.length&&offers.length?`lottery:${draft.picks.length}`:''}
function refreshPickClock(){if(!pickClockDeadline)return;let remaining=Math.max(0,Math.ceil((pickClockDeadline-Date.now())/1000));let display=$('pickTimerDisplay');display.style.display='block';display.textContent=`⏳ ${remaining}s remaining · ${draft.names[twoStageMode()?(stagePhase===1?stageOnePicks.length:stageTwoPicks.length):draft.picks.length]} is on the clock${remaining<=10?' · HURRY!':''}`;display.style.color=remaining<=10?'#ff796b':'';if(remaining===0&&!pickClockBusy){pickClockBusy=true;stopPickClock();if(!pending)selectOffer(Math.floor(Math.random()*offers.length));if(pending){if(draft.nameGenerator==='on'&&twoStageMode()&&stagePhase===2&&!$('charName').value.trim())$('charName').value=generateName(pending);lock()}pickClockBusy=false}}
function syncPickClock(){let k=activePickKey(),seconds=Number(draft?.pickTimer||0);if(!k||!seconds){stopPickClock();return}if(k===pickClockTurn)return;stopPickClock();pickClockTurn=k;pickClockDeadline=Date.now()+seconds*1000;refreshPickClock();pickClockInterval=setInterval(refreshPickClock,200)}
function syncNameGeneratorUI(){if(!draft)return;const enabled=draft.nameGenerator==='on',stageOne=twoStageMode()&&stagePhase===1;$('characterNameWrap').classList.toggle('hidden',!enabled||stageOne);$('rerollName').classList.toggle('hidden',!enabled||stageOne);if(!enabled)$('charName').value=''}
const nextTurnBeforeTimer=nextTurn;
nextTurn=function(){nextTurnBeforeTimer();syncNameGeneratorUI();syncPickClock()};
const startBeforeTimer=start;
start=function(){stopPickClock();startBeforeTimer();if(draft){draft.nameGenerator=$('nameGenerator').value;syncNameGeneratorUI();draft.pickTimer=Number($('pickTimer').value);syncPickClock()}};
const beginStageTwoBeforeTimer=$('beginStageTwo').onclick;
$('beginStageTwo').onclick=function(){stopPickClock();beginStageTwoBeforeTimer();syncPickClock()};
const backSetupBeforeTimer=$('backSetup').onclick;
$('backSetup').onclick=function(){stopPickClock();backSetupBeforeTimer()};
$('pickTimer').addEventListener('change',save);$('nameGenerator').addEventListener('change',save);

/* Friendly roster requirements controls. Lottery is always unrestricted. */
const enforceRosterBox=$('enforceRoster');
const enforceRosterWrap=$('rosterEnforceWrap');
const rosterRequirementsPanel=$('rosterRequirementsPanel');
function hasRosterTargets(){return Object.values(req).some(v=>Number(v?.min||0)>0||Number(v?.max||0)>0)}
function updateRosterRequirementUI(){
 const roster=$('format').value==='twostage';
 rosterRequirementsPanel.classList.toggle('hidden',!roster);
 enforceRosterWrap.classList.toggle('hidden',!roster||!hasRosterTargets());
 if(!roster){$('enforce').value='none';enforceRosterBox.checked=false;}
 else if(!hasRosterTargets()){$('enforce').value='soft';enforceRosterBox.checked=false;}
 else $('enforce').value=enforceRosterBox.checked?'hard':'soft';
 $('enforceExplanation').textContent=enforceRosterBox.checked
  ?'On: the game restricts role selections when necessary to meet your role targets. Class targets remain tracked goals in this two-stage build.'
  :'Off: guild goals are tracked, but players may choose freely.';
}
const setDraftModeBeforeRequirements=setDraftMode;
setDraftMode=function(mode){setDraftModeBeforeRequirements(mode);updateRosterRequirementUI();};
modeLottery.onclick=()=>setDraftMode('lottery');
modeRoster.onclick=()=>setDraftMode('roster');
lotterySpec.onchange=()=>setDraftMode('lottery');
enforceRosterBox.onchange=()=>{updateRosterRequirementUI();save()};
const renderReqBeforeRequirements=renderReq;
renderReq=function(){renderReqBeforeRequirements();updateRosterRequirementUI()};
// Existing saved configurations may contain an old enforcement value; show the new default as off.
enforceRosterBox.checked=false;
updateRosterRequirementUI();

/* Pre-draft D100 order phase. All rolls are made locally, one player at a time. */
let rollState=null;
const rollColor=n=>n===100?'#e5cc80':n===99?'#e268ff':n>=95?'#ff8000':n>=75?'#a335ee':n>=50?'#3d9eff':n>=25?'#1eff00':'#999999';
function d100(){if(window.crypto&&window.crypto.getRandomValues){let a=new Uint32Array(1),limit=4294967296-(4294967296%100);do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%100+1}return Math.floor(Math.random()*100)+1}
function rollOrderSort(a,b){for(let i=0;i<Math.max(a.history.length,b.history.length);i++){let d=(b.history[i]??-1)-(a.history[i]??-1);if(d)return d}return a.index-b.index}
function sameRoll(a,b){return a.history.length===b.history.length&&a.history.every((v,i)=>v===b.history[i])}
function rollTieGroups(){let ordered=[...rollState.people].sort(rollOrderSort),groups=[];for(let p of ordered){let group=groups[groups.length-1];if(group&&sameRoll(group[0],p))group.push(p);else groups.push([p])}return groups}
function showRoll(){let st=rollState,person=st.queue[st.position];$('rollStage').classList.remove('roll-hidden');$('rollAction').textContent='🎲 ROLL D100';$('rollAction').classList.remove('is-rolling');$('rollStage').classList.remove('roll-critical','roll-fumble');$('rollEntries').innerHTML=st.people.map(p=>`<div class="roll-entry"><span>${escapeHtml(p.name)}</span><span class="roll-score" style="color:${p.history.length?rollColor(p.history[p.history.length-1]):'#a99c89'}">${p.history.length?p.history.join(' → '):'—'}</span></div>`).join('');$('rollFace').textContent=st.last??'?';$('rollFace').style.color=st.last?rollColor(st.last):'#e9ce91';$('rollHeading').textContent=!st.started?'READY TO ROLL · '+st.people.length+' PLAYERS':person?`${st.round?'TIEBREAKER · ':''}${person.name} — your turn to roll`:'All rolls complete!';$('rollStart').classList.toggle('roll-hidden',st.started);$('rollAction').classList.toggle('roll-hidden',!person||!st.started||st.animating);$('rollAction').disabled=!!st.animating;$('rollNotice').textContent=!st.started?'Press START ROLLING to begin the pre-draft ceremony.':st.round?'Only tied players reroll. Original rolls still determine positions outside the tie.':'Highest roll drafts first. Each player rolls once.';if(!person){let ordered=[...st.people].sort(rollOrderSort);$('rollResults').classList.remove('roll-hidden');$('rollResults').innerHTML='<h3>FINAL DRAFT ORDER</h3>'+ordered.map((p,i)=>`<div class="roll-entry"><span>${i+1}. ${escapeHtml(p.name)}</span><span class="roll-score" style="color:${rollColor(p.history[0])}">${p.history.join(' → ')}</span></div>`).join('');$('rollBegin').classList.remove('roll-hidden')}else{$('rollResults').classList.add('roll-hidden');$('rollBegin').classList.add('roll-hidden')}}
function nextRoll(){let st=rollState;if(st.position<st.queue.length)return;let ties=rollTieGroups().filter(g=>g.length>1);if(ties.length){st.round++;st.queue=ties.flat();st.position=0;st.last=null;$('rollNotice').textContent='Tiebreaker round!';}showRoll()}
$('rollStart').onclick=()=>{if(!rollState||rollState.started)return;rollState.started=true;showRoll()};
/* Faceted D100 renderer --------------------------------------------------
   Lightweight canvas 3D: no external library required.
   The die travels across the roll table, tumbles in 3D, bounces, and only
   reveals the already-generated result after it settles.
------------------------------------------------------------------------ */
const D100_VERTS_RAW=[
  [-1,1.618,0],[1,1.618,0],[-1,-1.618,0],[1,-1.618,0],
  [0,-1,1.618],[0,1,1.618],[0,-1,-1.618],[0,1,-1.618],
  [1.618,0,-1],[1.618,0,1],[-1.618,0,-1],[-1.618,0,1]
];
const D100_FACES_RAW=[
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
];

function d100Norm(v){
  const l=Math.hypot(v[0],v[1],v[2])||1;
  return [v[0]/l,v[1]/l,v[2]/l];
}
const D100_MESH={
  verts:D100_VERTS_RAW.map(d100Norm),
  faces:D100_FACES_RAW
};

function currentRollFaction(){
  try{
    if(typeof draft!=='undefined' && draft && (draft.faction==='Horde'||draft.faction==='Alliance')){
      return draft.faction;
    }
  }catch(e){}
  try{
    const f=document.getElementById('faction')?.value;
    if(f==='Horde'||f==='Alliance')return f;
  }catch(e){}
  return 'Horde';
}

function factionDicePalette(){
  const f=currentRollFaction();
  if(f==='Alliance'){
    return {
      faction:'Alliance',
      faceDark:[17,28,48],
      faceMid:[31,63,104],
      faceBright:[52,101,158],
      edge:'rgba(194,164,83,.78)',
      rim:'rgba(230,206,132,.34)',
      glow:'rgba(58,116,190,.34)',
      shadow:'rgba(0,0,0,.58)'
    };
  }
  return {
    faction:'Horde',
    faceDark:[48,16,15],
    faceMid:[91,30,25],
    faceBright:[143,48,36],
    edge:'rgba(198,139,68,.80)',
    rim:'rgba(236,178,92,.34)',
    glow:'rgba(173,53,39,.34)',
    shadow:'rgba(0,0,0,.60)'
  };
}

function ensureD100Canvas(){
  let c=$('rollStage').querySelector('.d100-roll-canvas');
  if(c)return c;
  c=document.createElement('canvas');
  c.className='d100-roll-canvas';
  c.setAttribute('aria-hidden','true');
  $('rollStage').appendChild(c);
  return c;
}

function rotateD100(v,ax,ay,az){
  let [x,y,z]=v;
  let c=Math.cos(ax),s=Math.sin(ax);
  [y,z]=[y*c-z*s,y*s+z*c];
  c=Math.cos(ay);s=Math.sin(ay);
  [x,z]=[x*c+z*s,-x*s+z*c];
  c=Math.cos(az);s=Math.sin(az);
  [x,y]=[x*c-y*s,x*s+y*c];
  return [x,y,z];
}

function renderD100Canvas(canvas,state){
  const rect=canvas.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(rect.width*dpr));
  const h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  const ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);

  const pal=factionDicePalette();
  const {x,y,r,ax,ay,az,alpha=1}=state;
  ctx.globalAlpha=alpha;

  // Strong moving shadow to make the die feel physically grounded.
  const lift=Math.max(0,state.ground-y);
  const shadowScale=Math.max(.42,1-lift/180);
  ctx.save();
  ctx.translate(x,state.ground+r*.76);
  ctx.scale(shadowScale,1);
  const sg=ctx.createRadialGradient(0,0,3,0,0,r*1.02);
  sg.addColorStop(0,pal.shadow);
  sg.addColorStop(.65,'rgba(0,0,0,.28)');
  sg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sg;
  ctx.beginPath();
  ctx.ellipse(0,0,r*1.02,r*.24,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  const projected=D100_MESH.verts.map(v=>{
    const q=rotateD100(v,ax,ay,az);
    const perspective=3.55/(3.55-q[2]);
    return {x:x+q[0]*r*perspective,y:y+q[1]*r*perspective,z:q[2],q};
  });

  const light=d100Norm([-0.58,-0.72,1]);
  const faces=D100_MESH.faces.map(face=>{
    const a=projected[face[0]],b=projected[face[1]],c=projected[face[2]];
    const va=a.q,vb=b.q,vc=c.q;
    const ux=vb[0]-va[0],uy=vb[1]-va[1],uz=vb[2]-va[2];
    const vx=vc[0]-va[0],vy=vc[1]-va[1],vz=vc[2]-va[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const nl=Math.hypot(nx,ny,nz)||1; nx/=nl;ny/=nl;nz/=nl;
    const shade=Math.max(0,Math.min(1,nx*light[0]+ny*light[1]+nz*light[2]));
    return {face,z:(a.z+b.z+c.z)/3,shade,nz};
  }).filter(f=>f.nz>-.08).sort((a,b)=>a.z-b.z);

  ctx.save();
  ctx.shadowColor=pal.glow;
  ctx.shadowBlur=13;

  faces.forEach(({face,shade})=>{
    const a=projected[face[0]],b=projected[face[1]],c=projected[face[2]];
    const mix=(from,to,t)=>Math.round(from+(to-from)*t);
    const t=Math.pow(shade,.72);
    const base=t<.55
      ? [
          mix(pal.faceDark[0],pal.faceMid[0],t/.55),
          mix(pal.faceDark[1],pal.faceMid[1],t/.55),
          mix(pal.faceDark[2],pal.faceMid[2],t/.55)
        ]
      : [
          mix(pal.faceMid[0],pal.faceBright[0],(t-.55)/.45),
          mix(pal.faceMid[1],pal.faceBright[1],(t-.55)/.45),
          mix(pal.faceMid[2],pal.faceBright[2],(t-.55)/.45)
        ];

    ctx.beginPath();
    ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();
    ctx.fillStyle=`rgb(${base[0]},${base[1]},${base[2]})`;
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle=pal.edge;
    ctx.lineWidth=1.8;
    ctx.stroke();
    ctx.shadowBlur=13;
  });
  ctx.restore();

  // Crisp outer silhouette.
  ctx.beginPath();
  projected.forEach((p,i)=>{
    if(i===0)ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
  });
  ctx.strokeStyle=pal.rim;
  ctx.lineWidth=1;
  ctx.globalAlpha=alpha*.35;
  ctx.stroke();
  ctx.globalAlpha=1;
}

function animateD100Across(finalRoll,onComplete){
  const stage=$('rollStage');
  const die=stage.querySelector('.roll-die');
  const canvas=ensureD100Canvas();
  canvas.classList.add('active');
  die.classList.add('roll-die-hidden');

  const rect=stage.getBoundingClientRect();
  const mobile=rect.width<700;
  const duration=mobile?1900:2250;
  const start=performance.now();
  const radius=mobile?62:82;
  const startX=-radius*1.35;
  const endX=rect.width*.50;
  const ground=mobile?180:218;

  function frame(now){
    if(!rollState||!rollState.animating){
      canvas.classList.remove('active');
      die.classList.remove('roll-die-hidden');
      return;
    }

    const t=Math.min(1,(now-start)/duration);
    const ease=1-Math.pow(1-t,3);
    const x=startX+(endX-startX)*ease;

    // Several shrinking hops as the die loses energy.
    const hops=5.25;
    const bounce=Math.abs(Math.sin(t*Math.PI*hops));
    const bounceEnvelope=Math.pow(1-t,1.55);
    const y=ground-(bounce*(mobile?78:118)*bounceEnvelope);

    // Roll rate eases down with travel. Different axes avoid a flat "spinning coin" look.
    const revolutions=7.4;
    const spin=(t*revolutions*Math.PI*2);
    const ax=spin*.78 + Math.sin(t*12)*.28;
    const ay=spin*1.08 + Math.cos(t*10)*.22;
    const az=spin*.44 + Math.sin(t*7)*.18;

    renderD100Canvas(canvas,{x,y,r:radius,ax,ay,az,ground});

    if(t<1){
      requestAnimationFrame(frame);
      return;
    }

    // Short physical settle at center before result reveal.
    const settleStart=performance.now();
    function settle(snow){
      const st=Math.min(1,(snow-settleStart)/420);
      const damp=Math.exp(-4.5*st);
      const sy=ground-Math.sin(st*Math.PI*3.2)*12*damp;
      const sa=spin + Math.sin(st*Math.PI*2.4)*.16*damp;
      renderD100Canvas(canvas,{x:endX,y:sy,r:radius,ax:sa*.78,ay:sa*1.08,az:sa*.44,ground});
      if(st<1){requestAnimationFrame(settle);return}

      // Fade the canvas die into the normal result die in the exact center.
      const fadeStart=performance.now();
      die.classList.remove('roll-die-hidden');
      die.classList.add('die-result-reveal');
      $('rollFace').textContent=String(finalRoll);
      $('rollFace').style.color=rollColor(finalRoll);

      function fade(fnow){
        const ft=Math.min(1,(fnow-fadeStart)/260);
        renderD100Canvas(canvas,{x:endX,y:ground,r:radius,ax:sa*.78,ay:sa*1.08,az:sa*.44,ground,alpha:1-ft});
        if(ft<1){requestAnimationFrame(fade);return}
        canvas.classList.remove('active');
        const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
        setTimeout(()=>die.classList.remove('die-result-reveal'),450);
        onComplete();
      }
      requestAnimationFrame(fade);
    }
    requestAnimationFrame(settle);
  }
  requestAnimationFrame(frame);
}

$('rollAction').onclick=()=>{
  let st=rollState;
  if(!st||!st.started||st.animating||st.position>=st.queue.length)return;

  const p=st.queue[st.position];
  const finalRoll=d100(); // generated once; animation never changes the real result
  const action=$('rollAction');

  st.animating=true;
  st.last=null;
  action.disabled=true;
  action.textContent='ROLLING…';
  action.classList.add('is-rolling');
  $('rollHeading').textContent=p.name+' IS ROLLING…';
  $('rollNotice').textContent=(currentRollFaction()==='Alliance'?'Alliance':'Horde')+' D100 rolling across the table…';

  animateD100Across(finalRoll,()=>{
    if(rollState!==st)return;

    $('rollHeading').textContent=p.name+' ROLLED '+finalRoll+'!';
    $('rollNotice').textContent=finalRoll===100?'Perfect roll — 100!':finalRoll===1?'Brutal. Natural 1.':'The die settles. Result locked.';
    p.history.push(finalRoll);
    st.last=finalRoll;

    setTimeout(()=>{
      if(rollState!==st)return;
      action.classList.remove('is-rolling');
      action.textContent='🎲 ROLL D100';
      st.position++;
      st.animating=false;
      if(st.position>=st.queue.length)nextRoll();
      else showRoll();
    },1250);
  });
};
$('rollBegin').onclick=()=>{if(!rollState||!rollState.started||rollState.animating||rollState.position<rollState.queue.length||rollTieGroups().some(g=>g.length>1))return;draft.names=[...rollState.people].sort(rollOrderSort).map(p=>p.name);rollState=null;$('rollStage').classList.add('roll-hidden');$('draft').classList.remove('hidden');nextTurn();window.scrollTo({top:0,behavior:'smooth'})};
const startBeforeRoll=start;
start=function(){startBeforeRoll();if(!draft||$('setup').classList.contains('hidden')===false||$('draft').classList.contains('hidden'))return;draft.guild=$('guild').value.trim()||'The Great Reroll';let method=$('draftOrder').value;if(method==='manual')return;if(method==='random'){draft.names=randomize(draft.names);nextTurn();return}stopPickClock();$('draft').classList.add('hidden');rollState={people:draft.names.map((name,index)=>({name,index,history:[]})),queue:[],position:0,round:0,last:null,started:false,animating:false};rollState.queue=[...rollState.people];showRoll();window.scrollTo({top:0,behavior:'smooth'})};
const backBeforeRoll=$('backSetup').onclick;
$('backSetup').onclick=function(){rollState=null;$('rollStage').classList.add('roll-hidden');backBeforeRoll()};
$('draftOrder').addEventListener('change',save);
$('start').onclick=()=>start(); // invoke rolling-aware handler

/* Unified lobby: the board stays visible through rolls, waiting, and picks. */
let draftStarted=false,draftPaused=false,clockRemaining=0,lobbyRolls=[];
const board=$('draft'), content=$('liveDraftContent'), lobby=$('preDraftLobby');
const columns=content.querySelector('.cols');
columns.style.gridTemplateColumns='minmax(260px, .8fr) minmax(0, 2.6fr)';
const left=document.createElement('div');left.id='unifiedLeft';columns.insertBefore(left,columns.firstElementChild);
/* Lobby belongs in the wide central column, not the narrow sidebar. */
const orderPanel=document.createElement('div');orderPanel.className='panelx';orderPanel.innerHTML='<h2>🎲 Draft order</h2><div id="unifiedOrder"></div>';left.appendChild(orderPanel);
// Keep the existing roster element mounted for its original rendering logic,
// but present the draft order and completed picks in ONE visible board.
const legacyRosterPanel=columns.children[2];
orderPanel.querySelector('h2').textContent='🎲 Draft board';
const picksHeading=document.createElement('h3');
picksHeading.textContent='⚔ Completed picks';
picksHeading.className='board-picks-heading';
orderPanel.appendChild(picksHeading);
orderPanel.appendChild(legacyRosterPanel.querySelector('.live-picks'));
legacyRosterPanel.style.display='none';
const center=columns.children[1];
center.insertBefore(lobby,center.firstElementChild);
center.insertBefore($('rollStage'),center.firstElementChild);
// Keep the complete illustrated pool in the center, beneath the rolling stage.
const poolElement=$('fullPool');const poolPanel=poolElement.parentElement;poolPanel.id='characterPoolPanel';
center.insertBefore(poolPanel,center.children[3]||null);
const startRollBtn=document.createElement('button');startRollBtn.className='btnx';startRollBtn.id='unifiedRollStart';startRollBtn.textContent='🎲 START ROLLING';lobby.insertBefore(startRollBtn,$('launchDraft'));startRollBtn.style.display='none';
const heading=lobby.querySelector('h2');heading.textContent='The draft lobby';
lobby.querySelector('p').textContent='Review the character pool, roll for order, then start the draft when everyone is ready.';
const originalShowRoll=showRoll;
showRoll=function(){originalShowRoll();renderUnifiedOrder()};
function renderUnifiedOrder(){if(!draft)return;let people=rollState?.people||lobbyRolls;let rows=people?.length?people.map(p=>({name:p.name,history:p.history})):draft.names.map(name=>({name,history:[]}));let finalized=!rollState&&lobbyRolls.length>0;let names=finalized?draft.names:rows.map(p=>p.name);$('unifiedOrder').innerHTML=names.map((name,i)=>{let p=rows.find(x=>x.name===name),h=p?.history||[],n=h[0];return `<div class="unified-order-row"><span>${finalized?'#'+(i+1)+' · ':''}${escapeHtml(name)}</span><strong style="color:${n?rollColor(n):'#a99c89'}">${h.length?h.join(' → '):'Waiting'}</strong></div>`}).join('')}
function displayLobby(){if(!draft)return;renderFullPool();board.classList.remove('revealing');draftStarted=false;draftPaused=false;stopPickClock();board.classList.remove('hidden','paused','started');content.classList.remove('hidden');lobby.classList.remove('hidden');$('launchDraft').classList.toggle('hidden',!!rollState);startRollBtn.classList.toggle('hidden',!rollState);$('rollStage').classList.toggle('roll-hidden',!rollState);$('lobbyOrder').classList.add('hidden');$('lobbySettings').textContent=`${draft.faction} · ${draft.names.length} players · ${draft.options} options per pick · ${draft.pickTimer?draft.pickTimer+'s clock':'Untimed'}`;renderUnifiedOrder();renderLivePicks();$('draftStatus').textContent='Waiting for the host to start';$('pauseDraft').classList.add('hidden');$('pickTimerDisplay').style.display='none';window.scrollTo({top:0,behavior:'smooth'})}
startRollBtn.onclick=()=>{if(!rollState)return;$('rollStart').click();startRollBtn.classList.add('hidden');$('rollStage').classList.remove('roll-hidden')};
$('launchDraft').onclick=()=>{if(!draft||draftStarted||rollState)return;draftStarted=true;draftPaused=false;board.classList.add('started');lobby.classList.add('hidden');$('rollStage').classList.add('roll-hidden');$('pauseDraft').classList.remove('hidden');board.classList.remove('paused');$('pauseDraft').textContent='⏸ PAUSE DRAFT';$('draftStatus').textContent='Draft in progress';syncPickClock();renderLivePicks();window.scrollTo({top:0,behavior:'smooth'})};
function renderLivePicks(){if(!draft)return;let picks=twoStageMode()?(stagePhase===1?stageOnePicks:stageTwoPicks):draft.picks;let el=$('livePicks');el.innerHTML=picks.length?picks.map((p,i)=>`<div class="live-pick" title="${escapeHtml(description(p))}">${portrait(p)}<div><small>Pick #${i+1} · ${escapeHtml(draft.names[i])}</small><strong>${escapeHtml(optionLabel(p))}</strong>${p.name?`<small>${escapeHtml(p.name)}</small>`:''}</div></div>`).join(''):'<p class="muted">No picks yet. Selections will appear here.</p>'}
const baseClockSync=syncPickClock;syncPickClock=function(){if(!draftStarted||draftPaused){if(!draftStarted)stopPickClock();return}baseClockSync()};
const baseClockRefresh=refreshPickClock;refreshPickClock=function(){if(!draftStarted||draftPaused)return;baseClockRefresh()};
$('pauseDraft').onclick=()=>{if(!draftStarted||!draft)return;if(!draftPaused){draftPaused=true;clockRemaining=pickClockDeadline?Math.max(0,pickClockDeadline-Date.now()):0;if(pickClockInterval!==null)clearInterval(pickClockInterval);pickClockInterval=null;pickClockDeadline=0;board.classList.add('paused');$('pauseDraft').textContent='▶ RESUME DRAFT';$('draftStatus').textContent='Draft paused · selections disabled';if(draft.pickTimer)$('pickTimerDisplay').textContent=`⏸ PAUSED · ${Math.ceil(clockRemaining/1000)}s remaining`;}else{draftPaused=false;board.classList.remove('paused');$('pauseDraft').textContent='⏸ PAUSE DRAFT';$('draftStatus').textContent='Draft in progress';if(draft.pickTimer&&clockRemaining>0&&activePickKey()){pickClockDeadline=Date.now()+clockRemaining;pickClockInterval=setInterval(refreshPickClock,200);refreshPickClock()}else syncPickClock()}};
const baseNextTurn=nextTurn;nextTurn=function(){board.classList.remove('revealing');baseNextTurn();renderLivePicks();if(draftStarted&&activePickKey()===''){$('draftStatus').textContent=twoStageMode()&&stagePhase===1?'Stage 1 complete · begin Stage 2 when ready':'Draft complete';$('pauseDraft').disabled=true}else $('pauseDraft').disabled=false};
const baseLock=lock;lock=function(){if(!draftStarted||draftPaused)return;baseLock()};
const baseSelect=selectOffer;selectOffer=function(i){if(!draftStarted||draftPaused)return;baseSelect(i);if(pending){board.classList.add('revealing');$('characterPreview').dataset.player=draft.names[twoStageMode()?(stagePhase===1?stageOnePicks.length:stageTwoPicks.length):draft.picks.length]||'PLAYER';$('confirm').textContent='🔒 LOCK IT IN';$('characterPreview').scrollIntoView({behavior:'smooth',block:'center'});}};
const baseCancel=$('cancel').onclick;$('cancel').onclick=(...args)=>{board.classList.remove('revealing');if(typeof baseCancel==='function')baseCancel(...args);};
const baseStart=start;start=function(){draftStarted=false;draftPaused=false;lobbyRolls=[];baseStart();if(!draft)return;displayLobby()};
$('rollBegin').textContent='✓ FINALIZE DRAFT ORDER';
$('rollBegin').onclick=()=>{if(!rollState||!rollState.started||rollState.animating||rollState.position<rollState.queue.length||rollTieGroups().some(g=>g.length>1))return;lobbyRolls=rollState.people.map(p=>({...p,history:[...p.history]}));draft.names=[...rollState.people].sort(rollOrderSort).map(p=>p.name);rollState=null;$('rollStage').classList.add('roll-hidden');$('launchDraft').classList.remove('hidden');startRollBtn.classList.add('hidden');renderUnifiedOrder();$('draftStatus').textContent='Rolls complete · waiting for host';};
const baseStageTwo=$('beginStageTwo').onclick;$('beginStageTwo').onclick=()=>{if(draftPaused)return;baseStageTwo();renderLivePicks();$('pauseDraft').disabled=false};
const baseBack=$('backSetup').onclick;$('backSetup').onclick=()=>{draftStarted=false;draftPaused=false;clockRemaining=0;rollState=null;$('rollStage').classList.add('roll-hidden');board.classList.remove('paused');baseBack()};
$('start').onclick=()=>start();

/* Keep all three cards visible while a choice awaits confirmation. */
(function(){
 const originalSelectOffer=selectOffer;
 const originalRenderOffers=renderOffers;
 const originalNextTurn=nextTurn;
 function paintSelection(){
   const area=document.getElementById('confirmArea');
   const buttons=[...document.querySelectorAll('#offers .option')];
   buttons.forEach((b,i)=>{const selected=!!pending && offers[i]===pending;b.classList.toggle('pending-choice',selected);b.setAttribute('aria-pressed',selected?'true':'false');});
   let banner=document.getElementById('selectionBanner');
   if(!banner){banner=document.createElement('div');banner.id='selectionBanner';area.insertBefore(banner,area.firstChild);}
   if(pending){
     const name=draft.names[twoStageMode()?(stagePhase===1?stageOnePicks.length:stageTwoPicks.length):draft.picks.length]||'Current player';
     banner.textContent=name+' has selected '+optionLabel(pending)+' — confirm your pick or choose another card';
     document.getElementById('confirm').textContent='🔒 LOCK IT IN';
   }else banner.textContent='';
   board.classList.remove('revealing');
   document.getElementById('characterPreview').classList.add('hidden');
 }
 selectOffer=function(i){if(!draftStarted||draftPaused)return;originalSelectOffer(i);paintSelection();};
 renderOffers=function(){originalRenderOffers();paintSelection();};
 nextTurn=function(){originalNextTurn();paintSelection();};
 const cancel=document.getElementById('cancel');
 const oldCancel=cancel.onclick;
 cancel.onclick=function(...args){if(typeof oldCancel==='function')oldCancel.apply(this,args);paintSelection();};
})();

/* FIX: The original click handler captured the initial lock function before the
   two-stage and draft-control wrappers replaced it. Resolve the current handler
   at click time so Stage 1/2 picks use the correct draft engine. */
document.getElementById('confirm').onclick=function(){
  if(!draft || !pending || !draftStarted || draftPaused)return;
  lock();
};

/* Great Reroll update: default Skyborne + one optional re-spin per player, drawn from the same eligible pool. */
(function(){
  const skyKeys=()=>Object.entries(pool()).filter(([race])=>race==='Skyborne').flatMap(([race,classes])=>classes.map(cls=>key(race,cls)));
  // Enable Skyborne for new drafts and for saved configurations made before this feature.
  // An explicit choice made in this version remains respected on future visits.
  const skyPrefKey='great-reroll-skyborne-default-v1';
  let skyPreferences={};
  try{skyPreferences=JSON.parse(localStorage.getItem(skyPrefKey)||'{}')||{}}catch(e){}
  function enableDefaultSkyborne(){
    const faction=$('faction').value;
    if(!Object.prototype.hasOwnProperty.call(skyPreferences,faction)){
      skyKeys().forEach(k=>selected[k]=true);
      renderCombos();save();
    }
  }
  enableDefaultSkyborne();
  $('faction').addEventListener('change',()=>setTimeout(enableDefaultSkyborne,0));
  $('combos').addEventListener('change',e=>{
    if(e.target.matches('.combo')&&e.target.dataset.key.startsWith('Skyborne|')){
      skyPreferences[$('faction').value]=true;
      try{localStorage.setItem(skyPrefKey,JSON.stringify(skyPreferences))}catch(err){}
    }
  });
  $('combos').addEventListener('click',e=>{
    if(e.target.matches('.raceAll,.raceNone')&&e.target.dataset.r==='Skyborne'){
      skyPreferences[$('faction').value]=true;
      try{localStorage.setItem(skyPrefKey,JSON.stringify(skyPreferences))}catch(err){}
    }
  });
  const spinStyle=document.createElement('style');
  spinStyle.textContent=`#extraSpinPanel{margin:14px 0;padding:15px;border:1px solid #a37b37;border-radius:9px;background:linear-gradient(115deg,#332716,#191a1b);text-align:center}#extraSpinPanel button{margin:5px}#extraSpinPanel .spin-note{color:#d4c29d;font-size:13px;margin:5px 0}#extraSpinPanel .spin-warning{color:#ffce8b;font-weight:700}#extraSpinPanel button:disabled{opacity:.45;cursor:not-allowed}`;
  document.head.appendChild(spinStyle);
  const spinPanel=document.createElement('div');spinPanel.id='extraSpinPanel';spinPanel.className='hidden';
  spinPanel.innerHTML='<strong>🎲 ONE-TIME EXTRA SPIN</strong><div id="extraSpinStatus" class="spin-note"></div><button type="button" id="extraSpinButton" class="btnx">🎲 USE EXTRA SPIN</button><div id="extraSpinConfirm" class="hidden"><p class="spin-warning">Re-spin your current options? You MUST pick from the newly generated set. This cannot be undone.</p><button type="button" id="extraSpinYes" class="btnx">CONFIRM EXTRA SPIN</button><button type="button" id="extraSpinNo" class="btnx alt">KEEP CURRENT OPTIONS</button></div>';
  $('offers').insertAdjacentElement('afterend',spinPanel);
  const spent=new Set();let spinTurn='',spinLocked=false,spinConfirming=false;
  function turnId(){if(!draft)return '';let i=twoStageMode()?(stagePhase===1?stageOnePicks.length:stageTwoPicks.length):draft.picks.length;return i<draft.names.length?String(i):''}
  function eligibleReplacement(){
    if(twoStageMode()){
      const i=Number(turnId());
      if(stagePhase===1){let remaining=draft.names.length-i-1;return stageOneVariants().filter(v=>draft.enforce!=='hard'||stageOneFeasible([...stageOnePicks,v],remaining))}
      let choices=stageTwoVariants(i);
      return draft.enforce==='hard'?choices.filter(v=>stageTwoRemainingFeasible(v,i)):choices;
    }
    let used=new Set(draft.picks.map(p=>p.key)),remaining=draft.names.length-draft.picks.length-1;
    return variants().filter(v=>draft.duplicates==='repeat'||!used.has(v.key)).filter(v=>{
      let u=new Set(used);if(draft.duplicates==='unique')u.add(v.key);
      return (draft.enforce==='hard'?feasible([...draft.picks,v],remaining,u):feasible([...draft.picks,v],remaining,u,false))===true;
    }).filter((v,i,a)=>a.findIndex(x=>x.key===v.key)===i);
  }
  function spinChoices(){
    const all=eligibleReplacement();
    const wanted=twoStageMode()&&stagePhase===2?Number(draft.stageTwoOptions):Number(draft.options);
    // Re-spin from the SAME eligible pool as the original hand.
    // Do not exclude the current offers: repeats are intentionally possible,
    // including the very small chance of receiving the exact same set again.
    return all.length>=wanted?randomize(all).slice(0,wanted):[];
  }
  function paintSpin(){
    const id=turnId();
    if(id!==spinTurn){spinTurn=id;spinLocked=spent.has(id);spinConfirming=false;}
    const active=!!draft&&draftStarted&&!draftPaused&&id!==''&&offers.length>0;
    spinPanel.classList.toggle('hidden',!active);
    if(!active)return;
    const ready=!spinLocked&&spinChoices().length>0;
    $('extraSpinStatus').textContent=spinLocked?'Extra Spin used — choose one of your new options.':spent.has(id)?'Extra Spin already used.':ready?'One Extra Spin for this player. The newly generated set is final.':'Extra Spin unavailable: not enough eligible choices remain.';
    $('extraSpinButton').disabled=!ready||spinConfirming;
    $('extraSpinButton').classList.toggle('hidden',spinLocked||spinConfirming);
    $('extraSpinConfirm').classList.toggle('hidden',!spinConfirming||spinLocked);
  }
  $('extraSpinButton').onclick=()=>{if(!draftStarted||draftPaused||spinLocked||!spinChoices().length)return;spinConfirming=true;paintSpin()};
  $('extraSpinNo').onclick=()=>{spinConfirming=false;paintSpin()};
  $('extraSpinYes').onclick=()=>{
    if(!draftStarted||draftPaused||spinLocked||!spinConfirming)return;
    const replacement=spinChoices();if(!replacement.length){spinConfirming=false;paintSpin();return}
    const id=turnId();spent.add(id);spinLocked=true;spinConfirming=false;
    pending=null;offers=replacement;
    $('confirmArea').classList.add('hidden');$('characterPreview').classList.add('hidden');
    board.classList.remove('revealing');renderOffers();
    // Reset only this player's clock, retaining the configured turn duration.
    if(Number(draft.pickTimer)>0){stopPickClock();syncPickClock()}
    paintSpin();
  };
  const previousStart=start;
  start=function(){spent.clear();spinTurn='';spinLocked=false;spinConfirming=false;previousStart();paintSpin()};
  const previousNextTurn=nextTurn;
  nextTurn=function(){previousNextTurn();paintSpin()};
  const previousRenderOffers=renderOffers;
  renderOffers=function(){previousRenderOffers();paintSpin()};
  const previousLaunch=$('launchDraft').onclick;
  $('launchDraft').onclick=function(...args){previousLaunch.apply(this,args);paintSpin()};
  const previousPause=$('pauseDraft').onclick;
  $('pauseDraft').onclick=function(...args){previousPause.apply(this,args);paintSpin()};
  const previousBack=$('backSetup').onclick;
  $('backSetup').onclick=function(...args){previousBack.apply(this,args);spinPanel.classList.add('hidden')};
})();


/* ===== skyborne-portrait-upgrade ===== */
const SKYBORNE_PORTRAITS={"Warrior":"assets/hero-cards/legacy/skyborne-warrior.webp","Hunter":"assets/hero-cards/legacy/skyborne-hunter.webp","Rogue":"assets/hero-cards/legacy/skyborne-rogue.webp","Druid":"assets/hero-cards/legacy/skyborne-druid.webp","Mage":"assets/hero-cards/legacy/skyborne-mage.webp"};
const portraitBeforeSkyborneUpgrade=portrait;
portrait=function(v){if(v.race==='Skyborne'){const source=SKYBORNE_PORTRAITS[v.cls]||SKYBORNE_PORTRAITS.Mage;return `<div class="portraitx skyborne-upgraded" style="background-image:url('${source}');background-size:cover;background-position:center;"></div>`;}return portraitBeforeSkyborneUpgrade(v);};


/* ===== core-app ===== */
(function(){
const modal=document.getElementById('artGallery'),content=document.getElementById('galleryContent');
let side='Both';
function render(){let factions=side==='Both'?['Horde','Alliance']:[side];content.innerHTML=factions.map(f=>{const races=f==='Horde'?HORDE:ALLIANCE;const cards=Object.entries(races).flatMap(([race,classes])=>classes.map(cls=>{const v={race,cls,faction:f};const specs=CLASS_SPECS[cls].map(x=>x[0]).join(' · ');return `<article class="galleryCard">${portrait(v)}<strong>${escapeHtml(race+' '+cls)}</strong><small>${escapeHtml(specs)}</small></article>`})).join('');return `<h2 class="galleryGroup">${f.toUpperCase()} · ${Object.values(races).reduce((n,c)=>n+c.length,0)} RACE/CLASS COMBINATIONS</h2><div class="galleryGrid">${cards}</div>`}).join('')}
document.getElementById('artGalleryOpen').addEventListener('click',()=>{modal.classList.add('active');render()});document.getElementById('artGalleryClose').addEventListener('click',()=>modal.classList.remove('active'));modal.querySelectorAll('[data-side]').forEach(btn=>btn.addEventListener('click',()=>{side=btn.dataset.side;modal.querySelectorAll('[data-side]').forEach(b=>b.classList.toggle('active',b===btn));render()}));
})();


/* ===== creation-icon-redesign ===== */
function grFaction() {
  return (draft && draft.faction) || ($('faction') && $('faction').value) || 'Horde';
}
function grRaceIcon(race,faction=grFaction()) {
  return GREAT_REROLL_RACE_ICONS[faction+'|'+race] || '';
}
function grClassIcon(cls) { return GREAT_REROLL_CLASS_ICONS[cls] || ''; }
function grIconPair(v, compact=false) {
  const r=grRaceIcon(v.race,v.faction||grFaction()), c=grClassIcon(v.cls);
  if(compact) return `<span class="pick-combo-icons"><img src="${r}" alt=""><img src="${c}" alt=""></span>`;
  return `<div class="portraitx creation-icons">
    <span class="creation-race-wrap"><img class="creation-race-icon" src="${r}" alt="${escapeHtml(v.race)} race icon"><span class="creation-mini-label">${escapeHtml(v.race)}</span></span>
    <span class="creation-plus">+</span>
    <span class="creation-class-wrap"><img class="creation-class-icon" src="${c}" alt="${escapeHtml(v.cls)} class icon"><span class="creation-mini-label">${escapeHtml(v.cls)}</span></span>
  </div>`;
}

// Replace all generated/atlas portraits with deterministic character-creation icons.
portrait = function(v) { return grIconPair(v,false); };

// Settings: use the same race and class icons next to every include/exclude control.
renderCombos = function() {
  let p=pool(), faction=$('faction').value;
  $('combos').innerHTML=Object.entries(p).map(([r,cs])=>`<details ${r==='Orc'||r==='Human'?'open':''}>
    <summary><img class="settings-race-icon" src="${grRaceIcon(r,faction)}" alt="">${escapeHtml(r)} · <span id="cnt-${r.replaceAll(' ','_')}"></span></summary>
    <div class="rowx"><button class="btnx alt raceAll" data-r="${r}">All ${escapeHtml(r)}</button><button class="btnx alt raceNone" data-r="${r}">None</button></div>
    <div class="checks">${cs.map(c=>`<label><input type="checkbox" class="combo" data-key="${key(r,c)}" ${selected[key(r,c)]?'checked':''}><img class="settings-class-icon" src="${grClassIcon(c)}" alt=""> ${escapeHtml(c)}</label>`).join('')}</div>
  </details>`).join('');
  document.querySelectorAll('.combo').forEach(el=>el.onchange=()=>{selected[el.dataset.key]=el.checked;updateCounts();save()});
  document.querySelectorAll('.raceAll,.raceNone').forEach(el=>el.onclick=()=>{pool()[el.dataset.r].forEach(c=>selected[key(el.dataset.r,c)]=el.classList.contains('raceAll'));renderCombos();save()});
  $('skyNote').textContent='Race/class eligibility and icons follow the WoW Forever character-creation matrix supplied for this draft.';
  updateCounts();
};

// Add the icon pair to the live draft board, too.
renderRoster = function() {
  $('roster').innerHTML=draft.names.map((name,i)=>{
    let p=draft.picks[i];
    return `<div class="pick ${i===draft.picks.length?'active':''}"><span>${i+1}. ${escapeHtml(name)}</span><span>${p?`${grIconPair(p,true)}<b>${escapeHtml(optionLabel(p))}</b><br><span class="muted small">${escapeHtml(p.name||'Unnamed')}</span>`:i===draft.picks.length?'← On the clock':'Waiting'}</span></div>`;
  }).join('');
};

// Re-render immediately so restored settings also receive icons.
setTimeout(()=>{ if($('combos')) renderCombos(); },0);


/* ===== gr-class-colors-v2 ===== */
function grClassColor(cls) {
  return GREAT_REROLL_CLASS_COLORS[cls] || '#d7b56d';
}

/* Rebuild icon pair: race is the hero, class becomes a corner badge. */
grIconPair = function(v, compact=false) {
  const r=grRaceIcon(v.race,v.faction||grFaction()), c=grClassIcon(v.cls), col=grClassColor(v.cls);
  if(compact) return `<span class="pick-combo-icons" style="--class-color:${col}"><img src="${r}" alt=""><img src="${c}" alt=""></span>`;
  return `<div class="portraitx creation-icons" style="--class-color:${col}">
    <span class="creation-race-wrap"><img class="creation-race-icon" src="${r}" alt="${escapeHtml(v.race)}"></span>
    <span class="creation-class-wrap"><img class="creation-class-icon" src="${c}" alt="${escapeHtml(v.cls)}"></span>
  </div>`;
};
portrait = function(v) { return grIconPair(v,false); };

/* Apply class colors to any rendered combination/card by reading its displayed class. */
function grPaintClassColors(root=document) {
  const classes=Object.keys(GREAT_REROLL_CLASS_COLORS);
  root.querySelectorAll('.poolCard,.option,.card,.char-card').forEach(el=>{
    const t=(el.textContent||'').toUpperCase();
    const cls=classes.find(c=>t.includes(c.toUpperCase()));
    if(cls) {
      el.classList.add('gr-class-card');
      el.style.setProperty('--class-color',grClassColor(cls));
    }
  });
  root.querySelectorAll('#combos .checks label').forEach(el=>{
    const cls=classes.find(c=>(el.textContent||'').toUpperCase().includes(c.toUpperCase()));
    if(cls) el.style.setProperty('--class-color',grClassColor(cls));
  });
}
const grObserver=new MutationObserver(()=>grPaintClassColors());
grObserver.observe(document.body,{childList:true,subtree:true});
setTimeout(()=>grPaintClassColors(),0);


/* ===== gr-settings-clarity-v4 ===== */
function grUpgradeSettingTiles(){
  document.querySelectorAll('#combos .checks label').forEach(label=>{
    const cb=label.querySelector('input.combo');
    if(!cb) return;
    const key=cb.dataset.key||'';
    let cls='';
    const known=Object.keys(GREAT_REROLL_CLASS_ICONS||{});
    cls=known.find(c=>key.toLowerCase().endsWith('|'+c.toLowerCase()) ||
                      (label.textContent||'').trim().toLowerCase()===c.toLowerCase()) || '';
    if(!cls) {
      cls=known.find(c=>(label.textContent||'').toUpperCase().includes(c.toUpperCase()))||'';
    }
    if(!cls) return;
    label.style.setProperty('--class-color',grClassColor(cls));
    let icon=label.querySelector('.settings-class-icon');
    if(!icon){
      icon=document.createElement('img');
      icon.className='settings-class-icon';
      icon.src=grClassIcon(cls);
      icon.alt=cls+' icon';
      cb.before(icon);
    }
    let name=label.querySelector('.gr-setting-class-name');
    if(!name){
      name=document.createElement('span');
      name.className='gr-setting-class-name';
      name.textContent=cls;
      icon.after(name);
    }
  });
}
const grSettingsObserver=new MutationObserver(grUpgradeSettingTiles);
grSettingsObserver.observe(document.body,{childList:true,subtree:true});
setTimeout(grUpgradeSettingTiles,0);


/* ===== gr-settings-dedupe-v5 ===== */
function grRemoveDuplicateClassText(){
  document.querySelectorAll('#combos .checks label').forEach(label=>{
    if(!label.querySelector('.gr-setting-class-name')) return;
    [...label.childNodes].forEach(node=>{
      if(node.nodeType===Node.TEXT_NODE && node.textContent.trim()){
        node.textContent='';
      }
    });
  });
}
const grDedupeObserver=new MutationObserver(grRemoveDuplicateClassText);
grDedupeObserver.observe(document.body,{childList:true,subtree:true});
setTimeout(grRemoveDuplicateClassText,0);


/* ===== gr-how-to-play-js ===== */
(()=>{
  const btn=document.getElementById('grHowToBtn');
  const overlay=document.getElementById('grHowToOverlay');
  const close=document.getElementById('grHowToClose');
  function openGuide(){overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');}
  function closeGuide(){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');}
  btn.addEventListener('click',openGuide);
  close.addEventListener('click',closeGuide);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeGuide();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeGuide();});
})();


/* ===== gr-current-drafter-v7-js ===== */
(()=>{
  function currentDraftIndex(){
    if(!draft) return -1;
    if(typeof twoStageMode==='function' && twoStageMode()){
      return stagePhase===1 ? stageOnePicks.length : stageTwoPicks.length;
    }
    return draft.picks.length;
  }
  function currentDrafter(){
    const i=currentDraftIndex();
    return i>=0 && draft && i<draft.names.length ? draft.names[i] : '';
  }
  function enhanceCurrentDrafterUI(){
    if(!draft) return;
    const i=currentDraftIndex();
    const name=currentDrafter();
    const finished=!name;

    const turn=document.getElementById('turnLabel');
    if(turn){
      turn.innerHTML=finished
        ? '<span class="turn-player">DRAFT COMPLETE</span>'
        : `<span class="turn-kicker">Current drafter</span><span class="turn-player">${escapeHtml(name)}</span><span class="turn-count">Pick ${i+1} of ${draft.names.length}</span>`;
    }

    const title=document.getElementById('offerTitle');
    if(title && !finished){
      const action=(Number(draft.options)===1?'ROLL YOUR CHARACTER':'CHOOSE YOUR DESTINY');
      title.innerHTML=`<span class="offer-player">${escapeHtml(name)}</span><span class="offer-sep">—</span>${action}`;
    }
  }

  const priorNextTurn=window.nextTurn;
  window.nextTurn=function(){
    const r=priorNextTurn.apply(this,arguments);
    enhanceCurrentDrafterUI();
    return r;
  };

  const priorRenderRoster=window.renderRoster;
  window.renderRoster=function(){
    const r=priorRenderRoster.apply(this,arguments);
    enhanceCurrentDrafterUI();
    return r;
  };

  const priorRefreshPickClock=window.refreshPickClock;
  window.refreshPickClock=function(){
    if(!pickClockDeadline) return;
    const remaining=Math.max(0,Math.ceil((pickClockDeadline-Date.now())/1000));
    const name=currentDrafter();
    const display=document.getElementById('pickTimerDisplay');
    display.style.display='flex';
    display.classList.add('gr-active-clock');
    display.innerHTML=
      `<span class="clock-player-wrap"><span class="clock-kicker">On the clock</span><span class="clock-player">${escapeHtml(name)}</span></span>`+
      `<span class="clock-time ${remaining<=10?'urgent':''}">⏳ ${remaining}s remaining</span>`;
    display.setAttribute('aria-label',`${name} is on the clock. ${remaining} seconds remaining.`);
    if(remaining===0&&!pickClockBusy){
      pickClockBusy=true;
      stopPickClock();
      if(!pending)selectOffer(Math.floor(Math.random()*offers.length));
      if(pending){
        if(draft.nameGenerator==='on'&&twoStageMode()&&stagePhase===2&&!document.getElementById('charName').value.trim())
          document.getElementById('charName').value=generateName(pending);
        lock();
      }
      pickClockBusy=false;
    }
  };

  /* Catch an already-rendered draft when opening/restoring a file. */
  setTimeout(enhanceCurrentDrafterUI,0);
})();


/* ===== gr-draft-board-status-v8-js ===== */
(()=>{
  const originalRenderUnifiedOrder = window.renderUnifiedOrder;
  window.renderUnifiedOrder = function(){
    if(!draft) return;
    let people = rollState?.people || lobbyRolls;
    let rows = people?.length ? people.map(p=>({name:p.name,history:p.history})) : draft.names.map(name=>({name,history:[]}));
    let finalized = !rollState && lobbyRolls.length > 0;
    let names = finalized ? draft.names : rows.map(p=>p.name);
    const started = !!window.draftStarted;
    const picks = (typeof twoStageMode==='function' && twoStageMode()) ? (stagePhase===1?stageOnePicks:stageTwoPicks) : draft.picks;

    $('unifiedOrder').innerHTML = names.map((name,i)=>{
      if(started){
        let state='waiting', label='Waiting';
        if(i < picks.length){ state='drafted'; label='✔ Drafted'; }
        else if(i === picks.length){ state='active'; label='⏳ On the clock'; }
        return `<div class="unified-order-row draft-state ${state}"><span><span class="draft-order-rank">P${i+1}</span><span class="draft-order-name">${escapeHtml(name)}</span></span><strong><span class="board-status ${state}">${label}</span></strong></div>`;
      }
      let p = rows.find(x=>x.name===name), h = p?.history || [], n = h[0];
      return `<div class="unified-order-row"><span>${finalized?'#'+(i+1)+' · ':''}${escapeHtml(name)}</span><strong style="color:${n?rollColor(n):'#a99c89'}">${h.length?h.join(' → '):'Waiting'}</strong></div>`;
    }).join('');
  };

  /* Re-render once on load in case the file opens mid-draft */
  setTimeout(()=>{ if(typeof window.renderUnifiedOrder==='function') window.renderUnifiedOrder(); }, 0);
})();


/* ===== gr-draft-board-status-v9-js ===== */
(()=>{
  function grActivePicks(){
    if(typeof twoStageMode==='function' && twoStageMode()){
      return stagePhase===1 ? stageOnePicks : stageTwoPicks;
    }
    return draft?.picks || [];
  }

  function grRenderDraftBoardStates(){
    if(!draft || !$('unifiedOrder')) return;

    /* draftStarted is a lexical let in the existing app, so reference it directly. */
    const started = (typeof draftStarted !== 'undefined') ? draftStarted : false;

    if(!started){
      /* Keep the normal roll-order display before the draft begins. */
      let people=rollState?.people||lobbyRolls;
      let rows=people?.length?people.map(p=>({name:p.name,history:p.history})):draft.names.map(name=>({name,history:[]}));
      let finalized=!rollState&&lobbyRolls.length>0;
      let names=finalized?draft.names:rows.map(p=>p.name);
      $('unifiedOrder').innerHTML=names.map((name,i)=>{
        let p=rows.find(x=>x.name===name),h=p?.history||[],n=h[0];
        return `<div class="unified-order-row"><span>${finalized?'#'+(i+1)+' · ':''}${escapeHtml(name)}</span><strong style="color:${n?rollColor(n):'#a99c89'}">${h.length?h.join(' → '):'Waiting'}</strong></div>`;
      }).join('');
      return;
    }

    const picks=grActivePicks();
    $('unifiedOrder').innerHTML=draft.names.map((name,i)=>{
      let state='waiting', label='Waiting';
      if(i < picks.length){
        state='drafted';
        label='✓ Drafted';
      }else if(i === picks.length && picks.length < draft.names.length){
        state='onclock';
        label='⏳ On the clock';
      }
      return `<div class="unified-order-row gr-player-state ${state}">
        <span class="gr-player-name">${escapeHtml(name)}</span>
        <span class="gr-player-status">${label}</span>
      </div>`;
    }).join('');
  }

  /* Replace the visible board renderer so every call uses the correct states. */
  window.renderUnifiedOrder = grRenderDraftBoardStates;

  /* Refresh immediately when the draft starts. */
  const launch=document.getElementById('launchDraft');
  if(launch){
    launch.addEventListener('click',()=>setTimeout(grRenderDraftBoardStates,0));
  }

  /* Refresh after every completed pick. */
  const previousNextTurn=window.nextTurn;
  window.nextTurn=function(){
    const result=previousNextTurn.apply(this,arguments);
    grRenderDraftBoardStates();
    return result;
  };

  /* Refresh after roster renders too, covering restored/re-rendered draft state. */
  const previousRenderRoster=window.renderRoster;
  window.renderRoster=function(){
    const result=previousRenderRoster.apply(this,arguments);
    grRenderDraftBoardStates();
    return result;
  };

  setTimeout(grRenderDraftBoardStates,0);
})();


/* ===== gr-hero-art-integration-js ===== */
(()=>{
  const GR_HERO_ART=window.GR_CHARACTER_DATA.HERO_ART;
  
  function grHeroKey(v){
    const faction=(window.draft && draft.faction) || v.faction || 'Horde';
    return faction+'|'+(v.race||'')+'|'+(v.cls||'');
  }
  function grChoiceSpecsReal(v){
    if(v.spec) return `${v.spec}${v.role?' · '+v.role:''}`;
    if(v.cls && CLASS_SPECS[v.cls]) return CLASS_SPECS[v.cls].map(x=>x[0]).join(' · ');
    if(v.role) return `${v.role} path`;
    return 'Race / class draft';
  }
  function grFallbackChoiceCard(v,i){
    const cls=v.cls||'';
    const race=v.race||'';
    const col=cls?grClassColor(cls):'#c99743';
    const raceIcon=grRaceIcon(race,v.faction||grFaction());
    const classIcon=cls?grClassIcon(cls):'';
    const label=(typeof twoStageMode==='function' && twoStageMode() && stagePhase===1) ? `${race} · ${v.role||'Role'}` : `${race} ${cls}`;
    const role=(v.role||'Class draft');
    const classTag=cls||v.role||'Draft option';
    return `<button class="option gr-hero-option" data-i="${i}" style="--class-color:${col}"><div class="gr-choice-topline"><span class="gr-choice-number">Option ${i+1}</span><span class="gr-choice-class-tag">${classIcon?`<img src="${classIcon}" alt="">`:''}${escapeHtml(classTag)}</span></div><div class="gr-choice-art" style="background:radial-gradient(circle at 50% 44%,rgba(255,255,255,.035),transparent 46%),linear-gradient(180deg,#171719,#0c0d0f)"><span class="gr-choice-race-frame"><img src="${raceIcon}" alt="${escapeHtml(race)}"></span>${classIcon?`<span class="gr-choice-class-medallion"><img src="${classIcon}" alt="${escapeHtml(cls)}"></span>`:''}<span class="gr-choice-race-name">${escapeHtml(race)}</span></div><div class="gr-choice-copy"><strong class="gr-choice-name">${escapeHtml(label)}</strong><div class="gr-choice-specs">${escapeHtml(grChoiceSpecsReal(v))}</div><span class="gr-choice-role">${escapeHtml(role)}</span><div class="gr-choice-cta">Click to choose</div></div></button>`;
  }
  function grRealArtCard(v,i){
    const cls=v.cls||'';
    const race=v.race||'';
    const col=cls?grClassColor(cls):'#c99743';
    const classIcon=cls?grClassIcon(cls):'';
    const art=GR_HERO_ART[grHeroKey(v)];
    if(!art) return grFallbackChoiceCard(v,i);
    const label=(typeof twoStageMode==='function' && twoStageMode() && stagePhase===1) ? `${race} · ${v.role||'Role'}` : `${race} ${cls}`;
    const role=(v.role||'Class draft');
    const classTag=cls||v.role||'Draft option';
    return `<button class="option gr-hero-option gr-real-art-card" data-i="${i}" style="--class-color:${col}"><div class="gr-choice-topline"><span class="gr-choice-number">Option ${i+1}</span><span class="gr-choice-class-tag">${classIcon?`<img src="${classIcon}" alt="">`:''}${escapeHtml(classTag)}</span></div><div class="gr-choice-art"><img class="gr-real-hero-image" src="${art}" alt="${escapeHtml(race+' '+cls)} fantasy hero art"><span class="gr-real-hero-vignette"></span><span class="gr-art-source-badge">${escapeHtml((window.draft&&draft.faction)||v.faction||'Faction')}</span>${classIcon?`<span class="gr-choice-class-medallion"><img src="${classIcon}" alt="${escapeHtml(cls)}"></span>`:''}<span class="gr-choice-race-name">${escapeHtml(race)}</span></div><div class="gr-choice-copy"><strong class="gr-choice-name">${escapeHtml(label)}</strong><div class="gr-choice-specs">${escapeHtml(grChoiceSpecsReal(v))}</div><span class="gr-choice-role">${escapeHtml(role)}</span><div class="gr-choice-cta">Click to choose</div></div></button>`;
  }
  const heroRenderVersion='single-file-55-v1';
  window.renderOffers=function(){
    const isTwo=(typeof twoStageMode==='function' && twoStageMode());
    const done=isTwo ? (stagePhase===1 ? stageOnePicks.length===draft.names.length : stageTwoPicks.length===draft.names.length) : draft.picks.length===draft.names.length;
    $('offers').dataset.heroRenderVersion=heroRenderVersion;
    $('offers').style.setProperty('--offer-cols',Math.max(1,Math.min(offers.length,5)));
    if(done){
      $('offers').innerHTML=`<div class="notice good">${isTwo && stagePhase===1 ? 'Every player has a race and role. Begin Stage 2 above.' : 'The draft is finished. Export your roster above.'}</div>`;
      renderPreview(null);
      renderFullPool();
      return;
    }
    $('offers').innerHTML=offers.map((v,i)=>grRealArtCard(v,i)).join('');
    document.querySelectorAll('#offers .option').forEach(b=>b.onclick=()=>selectOffer(+b.dataset.i));
    renderPreview(null);
    renderFullPool();
    if(typeof grPaintClassColors==='function') grPaintClassColors($('offers'));
  };
  setTimeout(()=>{
    try{ if(window.draft && window.offers && offers.length && !$('draft').classList.contains('hidden')) window.renderOffers(); }catch(e){ console.error('Hero art refresh failed', e); }
  },0);
})();


/* ===== gr-name-forge-js ===== */
(()=>{
  const F=id=>document.getElementById(id);
  const state={style:'serious',results:[]};
  let historyStorage=null,legacyStorage=null;
  try{historyStorage=window.localStorage}catch(e){}
  try{legacyStorage=window.sessionStorage}catch(e){}
  const nameEngine=window.GRNameEngine.create({data:window.GR_NAME_DATA,
    grammar:window.GR_NAME_GRAMMAR,storage:historyStorage,legacyStorage});

  function currentConfig(){return {
    faction:F('forgeFaction').value,
    race:F('forgeRace').value,
    cls:F('forgeClass').value,
    style:state.style,
    classTheme:!!F('forgeClassTheme').checked,
    raunchy:state.style!=='serious' && !!F('forgeRaunchy').checked
  }}
  function styleLabel(s){return s==='clever'?'Clever':s==='silly'?'Silly':'Serious'}
  function classThemeLabel(v){return v?'Class themed':'Any theme'}
  function syncModeUI(){
    document.querySelectorAll('[data-forge-style]').forEach(btn=>{
      const on=btn.dataset.forgeStyle===state.style;
      btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');
    });
    const r=F('forgeRaunchy');
    const serious=state.style==='serious';
    if(serious) r.checked=false;
    r.disabled=serious;
    const rr=F('forgeRaunchyRow');
    if(rr) rr.classList.toggle('mode-disabled',serious);
    const help=F('forgeRaunchyHelp');
    if(help) help.textContent=serious
      ? 'Not used for Serious names. Switch to Clever or Silly to enable adult/raunchy humor.'
      : 'Allows innuendo, cruder jokes, and stronger language in this humor mode.';
    const note=F('forgeBlizzardNote');
    if(note) note.classList.toggle('hidden',serious);
    const cfg=currentConfig();
    F('forgeModeSummary').innerHTML=`Current direction: <b>${escapeHtml(styleLabel(cfg.style))}</b> · <b>${escapeHtml(classThemeLabel(cfg.classTheme))}</b>${cfg.style!=='serious'?` · <b>${cfg.raunchy?'Raunchy humor ON':'Clean humor'}</b>`:''}`;
  }
  function generateSet(){
    const status=F('forgeGenerationStatus');
    try{
      const result=nameEngine.generate(currentConfig(),3);
      state.results=result.names;
      renderResults();
      status.textContent=result.exhausted
        ? 'You have explored all remaining names for these settings. Change your race, class theme, or style to keep forging.'
        : result.persistent
          ? 'Three fresh names. Previously shown names stay excluded in this browser, even after a refresh.'
          : 'Three fresh names. History cannot be saved right now; repeat protection lasts until you close or refresh this page.';
    }catch(error){
      status.textContent='Could not forge names. Please reload the page and try again.';
      console.error('Name Forge:',error);
    }
  }

  function poolForFaction(){return F('forgeFaction').value==='Horde'?HORDE:ALLIANCE}
  function populateRace(keep){const p=poolForFaction(),wanted=keep&&p[keep]?keep:Object.keys(p)[0];F('forgeRace').innerHTML=Object.keys(p).map(r=>`<option ${r===wanted?'selected':''}>${escapeHtml(r)}</option>`).join('');populateClass()}
  function populateClass(keep){const p=poolForFaction(),race=F('forgeRace').value,classes=p[race]||[],wanted=keep&&classes.includes(keep)?keep:classes[0];F('forgeClass').innerHTML=classes.map(c=>`<option ${c===wanted?'selected':''}>${escapeHtml(c)}</option>`).join('');paintCharacter()}
  function paintCharacter(){
    const faction=F('forgeFaction').value,race=F('forgeRace').value,cls=F('forgeClass').value;if(!race||!cls)return;
    let ri='',ci='';try{ri=grRaceIcon(race,faction);ci=grClassIcon(cls)}catch(e){}
    F('forgeCharacterPreview').innerHTML=`<div class="forge-character-icons">${ri?`<img src="${ri}" alt="${escapeHtml(race)}">`:''}${ci?`<img src="${ci}" alt="${escapeHtml(cls)}">`:''}</div><div class="forge-character-copy"><strong>${escapeHtml(race)} ${escapeHtml(cls)}</strong><small>${escapeHtml(faction)} · Race shapes every style; Class Theme adds your class identity.</small></div>`;
  }
  function renderResults(){
    F('forgeResults').innerHTML=state.results.map((r,i)=>{
      const cfg=r.cfg||currentConfig();
      const meta=`${styleLabel(cfg.style)} · ${classThemeLabel(cfg.classTheme)}${cfg.style!=='serious'?(cfg.raunchy?' · Raunchy':' · Clean'):''}`;
      return `<article class="forge-name-card"><div class="forge-card-head">Option ${i+1} · ${escapeHtml(cfg.race)} ${escapeHtml(cfg.cls)}</div><div class="forge-card-name">${escapeHtml(r.full)}</div><div class="forge-card-meta">${escapeHtml(meta)}</div><div class="forge-card-actions"><button type="button" data-action="copy" data-i="${i}">COPY NAME</button></div></article>`;
    }).join('');
    F('forgeResults').querySelectorAll('button[data-action]').forEach(b=>b.onclick=()=>cardAction(b.dataset.action,+b.dataset.i));
  }
  function cardAction(action,i){
    const r=state.results[i];if(!r)return;
    if(action==='copy')copyName(r.full)
  }
  function copyName(name){
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(name).catch(()=>{});
    const t=document.createElement('div');t.className='forge-copy-toast';t.textContent='Copied: '+name;document.body.appendChild(t);setTimeout(()=>t.remove(),1300)
  }
  function openForge(){F('setup').classList.add('hidden');F('draft').classList.add('hidden');F('rollStage').classList.add('roll-hidden');F('nameForge').classList.remove('hidden');document.body.classList.add('name-forge-active');F('modeBadge').textContent='NAME FORGE';window.scrollTo({top:0,behavior:'smooth'});if(!state.results.length)generateSet()}
  function closeForge(){F('nameForge').classList.add('hidden');F('setup').classList.remove('hidden');document.body.classList.remove('name-forge-active');F('modeBadge').textContent='OFFLINE MODE';window.scrollTo({top:0,behavior:'smooth'})}

  F('forgeFaction').value=F('faction').value||'Horde';populateRace();syncModeUI();paintCharacter();
  F('openNameForge').onclick=()=>{F('forgeFaction').value=F('faction').value||'Horde';populateRace();openForge()};
  F('closeNameForge').onclick=closeForge;
  function forgeAndShowResults(){
    generateSet();
    const stage=F('forgeResultsStage');
    if(stage)stage.scrollIntoView({behavior:'smooth',block:'start'});
  }
  F('forgeFaction').onchange=()=>{populateRace();syncModeUI()};
  F('forgeRace').onchange=()=>{populateClass();syncModeUI()};
  F('forgeClass').onchange=()=>{paintCharacter();syncModeUI()};
  document.querySelectorAll('[data-forge-style]').forEach(btn=>btn.onclick=()=>{state.style=btn.dataset.forgeStyle;syncModeUI()});
  F('forgeClassTheme').onchange=()=>{syncModeUI()};
  F('forgeRaunchy').onchange=()=>{syncModeUI()};
  F('forgeGenerate').onclick=forgeAndShowResults;
  F('forgeGenerateAgain').onclick=()=>{generateSet();const stage=F('forgeResultsStage');if(stage)stage.scrollIntoView({behavior:'smooth',block:'start'})};

  // Draft name suggestions use the same engine in Serious + Class Themed mode.
  window.generateName=function(v){
    const race=v.race,cls=v.cls,faction=(window.draft&&draft.faction)||((HORDE[race]&&HORDE[race].includes(cls))?'Horde':'Alliance');
    const cfg={faction,race,cls,style:'serious',classTheme:true,raunchy:false};
    return nameEngine.generate(cfg,1).names[0]?.full||'';
  };
})();


/* ===== gr-analytics-events ===== */
(()=>{
  const track=(name,data)=>{ if(typeof window.grTrack==='function') window.grTrack(name,data||{}); };
  const val=id=>document.getElementById(id)?.value||'';

  // Name Forge: count deliberate generation actions. We intentionally do not send generated names.
  ['forgeGenerate','forgeGenerateAgain'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('click',()=>track('name_forge_generate',{
      faction:val('forgeFaction'),
      race:val('forgeRace'),
      class:val('forgeClass'),
      style:document.querySelector('[data-forge-style].active')?.dataset.forgeStyle||'serious',
      class_theme:!!document.getElementById('forgeClassTheme')?.checked,
      raunchy:(document.querySelector('[data-forge-style].active')?.dataset.forgeStyle||'serious')!=='serious' && !!document.getElementById('forgeRaunchy')?.checked
    }));
  });

  // Draft start: record configuration, never player/guild names.
  const launch=document.getElementById('launchDraft');
  if(launch){
    launch.addEventListener('click',()=>setTimeout(()=>{
      try{
        if(typeof draftStarted!=='undefined' && draftStarted && window.draft){
          track('draft_started',{
            faction:draft.faction||'',
            players:Array.isArray(draft.names)?draft.names.length:0,
            options:Number(draft.options||0)
          });
        }
      }catch(e){}
    },0));
  }

  // Draft selections + completion. Wrap the app's final lock() function so timed/autopicks count too.
  try{
    if(typeof lock==='function'){
      const analyticsBaseLock=lock;
      lock=function(){
        let snap=null, before=0, two=false, phase=0;
        try{
          two=typeof twoStageMode==='function' && twoStageMode();
          phase=two && typeof stagePhase!=='undefined' ? stagePhase : 0;
          if(typeof pending!=='undefined' && pending){
            snap={faction:(window.draft&&draft.faction)||'',race:pending.race||'',class:pending.cls||''};
          }
          if(two){
            before=phase===1?(Array.isArray(stageOnePicks)?stageOnePicks.length:0):(Array.isArray(stageTwoPicks)?stageTwoPicks.length:0);
          }else{
            before=window.draft&&Array.isArray(draft.picks)?draft.picks.length:0;
          }
        }catch(e){}

        const result=analyticsBaseLock.apply(this,arguments);

        try{
          let after=before;
          if(two){
            after=phase===1?(Array.isArray(stageOnePicks)?stageOnePicks.length:0):(Array.isArray(stageTwoPicks)?stageTwoPicks.length:0);
          }else{
            after=window.draft&&Array.isArray(draft.picks)?draft.picks.length:0;
          }
          const successful=after>before;
          const finalComboPick=successful && (!two || phase===2);
          if(finalComboPick && snap && snap.race && snap.class){
            track('draft_pick',{faction:snap.faction,race:snap.race,class:snap.class});
          }
          if(successful && window.draft && Array.isArray(draft.names)){
            const completed=two
              ? (phase===2 && Array.isArray(stageTwoPicks) && stageTwoPicks.length>=draft.names.length)
              : (Array.isArray(draft.picks) && draft.picks.length>=draft.names.length);
            if(completed){
              track('draft_completed',{faction:draft.faction||'',players:draft.names.length});
            }
          }
        }catch(e){}
        return result;
      };
    }
  }catch(e){}
})();


/* ===== gr-clean-home-v4-js ===== */
(()=>{
  const byId=id=>document.getElementById(id);
  const body=document.body;
  const home=byId('grHomeHub'), toolNav=byId('grToolNav');
  const title=byId('grToolTitle'), subtitle=byId('grToolSubtitle');
  const setup=byId('setup'), draftEl=byId('draft'), forge=byId('nameForge'), roll=byId('rollStage');
  const startBtn=byId('start');
  let homeSnapshot=null;

  const toolCopy={
    lottery:{title:'CHARACTER LOTTERY',sub:'Configure the players and character pool, then let fate deal the choices.'},
    roster:{title:'GUILD ROSTER DRAFT',sub:'Build the guild together with role targets, class goals, and a shared draft board.'},
    forge:{title:'NAME FORGE',sub:'Choose a race and class, then forge three names in the style you want.'}
  };

  function selectedDraftMode(){
    return byId('format') && byId('format').value==='twostage' ? 'roster' : 'lottery';
  }
  function draftMatches(mode){
    try{
      if(typeof draft==='undefined' || !draft) return false;
      return mode==='roster' ? draft.format==='twostage' : draft.format!=='twostage';
    }catch(e){return false}
  }
  function setChrome(mode){
    const c=toolCopy[mode]||toolCopy.lottery;
    title.textContent=c.title; subtitle.textContent=c.sub;
    toolNav.classList.remove('hidden');
    body.classList.remove('gr-home-view');
    body.classList.add('gr-tool-view');
    home.classList.add('hidden');
    if(byId('modeBadge')) byId('modeBadge').textContent=c.title;
    if(startBtn) startBtn.textContent=mode==='roster'?'START GUILD ROSTER DRAFT →':'START CHARACTER LOTTERY →';
  }
  function rememberView(){
    if(!forge.classList.contains('hidden')) return {tool:'forge',view:'forge'};
    if(!draftEl.classList.contains('hidden')) return {tool:selectedDraftMode(),view:'draft',rollVisible:roll&&!roll.classList.contains('roll-hidden')};
    if(!setup.classList.contains('hidden')) return {tool:selectedDraftMode(),view:'setup'};
    return null;
  }
  function hideAllTools(){
    setup.classList.add('hidden');
    draftEl.classList.add('hidden');
    forge.classList.add('hidden');
    if(roll) roll.classList.add('roll-hidden');
    body.classList.remove('name-forge-active');
  }
  function goHome(){
    homeSnapshot=rememberView()||homeSnapshot;
    hideAllTools();
    toolNav.classList.add('hidden');
    home.classList.remove('hidden');
    body.classList.remove('gr-tool-view');
    body.classList.add('gr-home-view');
    if(byId('modeBadge')) byId('modeBadge').textContent='OFFLINE MODE';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function showSetup(mode){
    hideAllTools();
    try{ if(typeof setDraftMode==='function') setDraftMode(mode); }catch(e){}
    setup.classList.remove('hidden');
    setChrome(mode);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function showExistingDraft(mode){
    hideAllTools();
    draftEl.classList.remove('hidden');
    setChrome(mode);
    if(homeSnapshot && homeSnapshot.view==='draft' && homeSnapshot.rollVisible && roll) roll.classList.remove('roll-hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function enterDraftTool(mode){
    if(homeSnapshot && homeSnapshot.tool===mode && homeSnapshot.view==='draft' && draftMatches(mode)) showExistingDraft(mode);
    else showSetup(mode);
  }
  function enterForge(){
    hideAllTools();
    const opener=byId('openNameForge');
    if(opener) opener.click();
    forge.classList.remove('hidden');
    body.classList.add('name-forge-active');
    setChrome('forge');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  byId('grHomeLottery').onclick=()=>enterDraftTool('lottery');
  byId('grHomeRoster').onclick=()=>enterDraftTool('roster');
  byId('grHomeForge').onclick=enterForge;
  byId('grHomeButton').onclick=goHome;

  /* Name Forge's old return-to-setup action is replaced by the universal Home action. */
  if(byId('closeNameForge')) byId('closeNameForge').onclick=goHome;

  /* Keep tool chrome accurate when internal mode/setup controls change state. */
  if(byId('backSetup')){
    const prior=byId('backSetup').onclick;
    byId('backSetup').onclick=function(...args){
      if(typeof prior==='function') prior.apply(this,args);
      if(!setup.classList.contains('hidden')) setChrome(selectedDraftMode());
    };
  }

  /* Initial state: a true landing page, not a draft setup screen. */
  hideAllTools();
  home.classList.remove('hidden');
  toolNav.classList.add('hidden');
  body.classList.remove('gr-tool-view','name-forge-active');
  body.classList.add('gr-home-view');
  if(byId('modeBadge')) byId('modeBadge').textContent='OFFLINE MODE';
})();


/* ===== gr-cinematic-home-v5-js ===== */
(()=>{
  const hub=document.getElementById('grHomeHub');
  if(!hub) return;
  let secondary=document.getElementById('grHomeSecondary');
  if(!secondary){
    secondary=document.createElement('div');
    secondary.id='grHomeSecondary';
    secondary.className='gr-home-secondary';
    hub.appendChild(secondary);
  }
  const guide=document.getElementById('grHowToBtn');
  const gallery=document.getElementById('artGalleryOpen');
  if(guide){ guide.textContent='? HOW DRAFTS WORK'; secondary.appendChild(guide); }
  if(gallery){ gallery.textContent='✦ CHARACTER GALLERY'; secondary.appendChild(gallery); }
  const galleryClose=document.getElementById('artGalleryClose');
  if(galleryClose) galleryClose.textContent='CLOSE GALLERY ✕';
})();


/* ===== gr-gallery-modal-v6-js ===== */
(()=>{
  const modal=document.getElementById('artGallery');
  const inner=modal && modal.querySelector('.galleryInner');
  const close=document.getElementById('artGalleryClose');
  const open=document.getElementById('artGalleryOpen');
  if(!modal || !inner || !close || !open) return;

  if(!modal.querySelector('.gallery-modal-panel')){
    const panel=document.createElement('div');
    panel.className='gallery-modal-panel';
    modal.insertBefore(panel,inner);
    panel.appendChild(inner);
    panel.appendChild(close);
  }
  close.textContent='×';
  close.setAttribute('aria-label','Close character gallery');
  close.title='Close gallery';

  const sync=()=>document.body.classList.toggle('gr-gallery-open',modal.classList.contains('active'));
  open.addEventListener('click',()=>requestAnimationFrame(sync));
  close.addEventListener('click',()=>requestAnimationFrame(sync));
  modal.addEventListener('click',e=>{
    if(e.target===modal){modal.classList.remove('active');sync();}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && modal.classList.contains('active')){
      modal.classList.remove('active');
      sync();
    }
  });
})();


/* ===== gr-themed-ui-v9-js ===== */
(()=>{
  const body=document.body;
  const faction=document.getElementById('faction');
  const forgeFaction=document.getElementById('forgeFaction');

  function currentTheme(){
    if(body.classList.contains('gr-home-view')) return 'home';
    if(body.classList.contains('name-forge-active') || (!document.getElementById('nameForge')?.classList.contains('hidden') && body.classList.contains('gr-tool-view'))) return 'forge';
    if(body.classList.contains('gr-tool-view')) return ((faction?.value||'Horde').toLowerCase()==='alliance')?'alliance':'horde';
    return 'home';
  }
  function applyTheme(){
    const theme=currentTheme();
    body.dataset.grTheme=theme;
    if(forgeFaction) body.dataset.grForgeFaction=(forgeFaction.value||'Horde').toLowerCase();
  }

  faction?.addEventListener('change',()=>requestAnimationFrame(applyTheme));
  forgeFaction?.addEventListener('change',()=>requestAnimationFrame(applyTheme));
  document.getElementById('grHomeLottery')?.addEventListener('click',()=>requestAnimationFrame(applyTheme));
  document.getElementById('grHomeRoster')?.addEventListener('click',()=>requestAnimationFrame(applyTheme));
  document.getElementById('grHomeForge')?.addEventListener('click',()=>requestAnimationFrame(applyTheme));
  document.getElementById('grHomeButton')?.addEventListener('click',()=>requestAnimationFrame(applyTheme));

  const observer=new MutationObserver(()=>requestAnimationFrame(applyTheme));
  observer.observe(body,{attributes:true,attributeFilter:['class']});
  applyTheme();
})();

/* ======================================================================
   WAR TABLE — INTERACTIVE PLAYER DICE THROW
   Each player gets a faction-themed die. The active player drags/flicks
   the center die; release velocity affects only the animation, never RNG.
   ====================================================================== */
(function(){

  // Stylized 20-face tabletop model; the independent roll remains uniformly 1–100.
  const faces=[{"n":[-0.5773503,-0.5773503,-0.5773503],"v":[[0.0,-0.6615845,-1.0704663],[-0.6615845,-1.0704663,0.0],[-1.0704663,0.0,-0.6615845]]},{"n":[-0.5773503,0.5773503,-0.5773503],"v":[[-1.0704663,0.0,-0.6615845],[-0.6615845,1.0704663,0.0],[0.0,0.6615845,-1.0704663]]},{"n":[0.3568221,0.0,-0.9341724],"v":[[1.0704663,0.0,-0.6615845],[0.0,-0.6615845,-1.0704663],[0.0,0.6615845,-1.0704663]]},{"n":[-0.3568221,0.0,-0.9341724],"v":[[0.0,0.6615845,-1.0704663],[0.0,-0.6615845,-1.0704663],[-1.0704663,0.0,-0.6615845]]},{"n":[0.0,-0.9341724,0.3568221],"v":[[0.6615845,-1.0704663,0.0],[0.0,-0.6615845,1.0704663],[-0.6615845,-1.0704663,0.0]]},{"n":[0.5773503,-0.5773503,-0.5773503],"v":[[0.6615845,-1.0704663,0.0],[0.0,-0.6615845,-1.0704663],[1.0704663,0.0,-0.6615845]]},{"n":[0.0,-0.9341724,-0.3568221],"v":[[-0.6615845,-1.0704663,0.0],[0.0,-0.6615845,-1.0704663],[0.6615845,-1.0704663,0.0]]},{"n":[-0.9341724,0.3568221,0.0],"v":[[-1.0704663,0.0,0.6615845],[-0.6615845,1.0704663,0.0],[-1.0704663,0.0,-0.6615845]]},{"n":[-0.9341724,-0.3568221,0.0],"v":[[-1.0704663,0.0,-0.6615845],[-0.6615845,-1.0704663,0.0],[-1.0704663,0.0,0.6615845]]},{"n":[-0.5773503,-0.5773503,0.5773503],"v":[[-0.6615845,-1.0704663,0.0],[0.0,-0.6615845,1.0704663],[-1.0704663,0.0,0.6615845]]},{"n":[-0.3568221,0.0,0.9341724],"v":[[0.0,-0.6615845,1.0704663],[0.0,0.6615845,1.0704663],[-1.0704663,0.0,0.6615845]]},{"n":[-0.5773503,0.5773503,0.5773503],"v":[[-1.0704663,0.0,0.6615845],[0.0,0.6615845,1.0704663],[-0.6615845,1.0704663,0.0]]},{"n":[0.0,0.9341724,0.3568221],"v":[[-0.6615845,1.0704663,0.0],[0.0,0.6615845,1.0704663],[0.6615845,1.0704663,0.0]]},{"n":[0.0,0.9341724,-0.3568221],"v":[[0.6615845,1.0704663,0.0],[0.0,0.6615845,-1.0704663],[-0.6615845,1.0704663,0.0]]},{"n":[0.5773503,0.5773503,-0.5773503],"v":[[1.0704663,0.0,-0.6615845],[0.0,0.6615845,-1.0704663],[0.6615845,1.0704663,0.0]]},{"n":[0.9341724,-0.3568221,0.0],"v":[[1.0704663,0.0,0.6615845],[0.6615845,-1.0704663,0.0],[1.0704663,0.0,-0.6615845]]},{"n":[0.3568221,0.0,0.9341724],"v":[[1.0704663,0.0,0.6615845],[0.0,0.6615845,1.0704663],[0.0,-0.6615845,1.0704663]]},{"n":[0.5773503,-0.5773503,0.5773503],"v":[[0.0,-0.6615845,1.0704663],[0.6615845,-1.0704663,0.0],[1.0704663,0.0,0.6615845]]},{"n":[0.5773503,0.5773503,0.5773503],"v":[[1.0704663,0.0,0.6615845],[0.6615845,1.0704663,0.0],[0.0,0.6615845,1.0704663]]},{"n":[0.9341724,0.3568221,0.0],"v":[[1.0704663,0.0,-0.6615845],[0.6615845,1.0704663,0.0],[1.0704663,0.0,0.6615845]]}];
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const n=Math.hypot(...a);return a.map(x=>x/n)};
  const mul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-dot(a.slice(0,3),b.slice(0,3))];
  const rotate=(v,q)=>{const t=cross(q.slice(0,3),v).map(x=>2*x),u=cross(q.slice(0,3),t);return v.map((x,i)=>x+q[3]*t[i]+u[i])};
  const axisQ=(axis,angle)=>[...unit(axis).map(x=>x*Math.sin(angle/2)),Math.cos(angle/2)];
  const faceQ=index=>{const n=faces[index%faces.length].n,q=unit([...cross(n,[0,0,1]),1+n[2]]),r=rotate(unit(cross([0,1,0],n)),q);return mul(axisQ([0,0,1],-Math.atan2(r[1],r[0])),q)};
  const mixQ=(a,b,t)=>{if(dot(a,b)<0)b=b.map(x=>-x);return unit(a.map((x,i)=>x*(1-t)+b[i]*t))};
  let orientation=faceQ(99);

  let resultFace=null;
  const faceValues=[10,85,40,65,20,95,50,75,30,100,55,5,90,35,70,15,80,45,60,25];
  const resinTextures={};
  function resinTexture(blue){
    const key=blue?'blue':'red';if(resinTextures[key])return resinTextures[key];
    const c=document.createElement('canvas');c.width=c.height=384;
    const ctx=c.getContext('2d'),im=ctx.createImageData(384,384);
    const hash=(x,y)=>{const t=Math.sin(x*127.1+y*311.7)*43758.5453;return t-Math.floor(t)};
    const noise=(x,y)=>{let ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v};
    const fbm=(x,y)=>noise(x,y)*.53+noise(x*2.1,y*2.1)*.27+noise(x*4.3,y*4.3)*.13+noise(x*8.5,y*8.5)*.07;
    for(let y=0;y<384;y++)for(let x=0;x<384;x++){
      const u=x/70,v=y/70,w=fbm(u,v),flow=Math.sin((u*.6+v*.8+w*3.8)*5),wisps=Math.pow(Math.max(0,flow),5);
      const d=.18+.67*w+.52*wisps,grain=hash(x+29,y+17),gold=(wisps>.3&&grain>.965)||(grain>.997);
      const rgb=gold?[194+grain*44,149+grain*48,70+grain*40]:blue?[5+9*d,17+59*d,52+161*d]:[48+191*d,4+15*d,7+21*d];
      const i=(y*384+x)*4;im.data[i]=rgb[0];im.data[i+1]=rgb[1];im.data[i+2]=rgb[2];im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0);resinTextures[key]=c;return c;
  }
  function paintDie(canvas,q,highlight=0){
    const ctx=canvas.getContext('2d'),S=480,R=171,C=S/2;
    if(canvas.width!==S){canvas.width=S;canvas.height=S}
    ctx.clearRect(0,0,S,S);
    const blue=faction()==='Alliance',lightDir=unit([-.5,.7,1]),texture=resinTexture(blue);
    const rgb=a=>`rgb(${a.map(x=>Math.round(Math.max(0,Math.min(255,x)))).join(',')})`;
    const path=vertices=>{ctx.beginPath();vertices.forEach((p,j)=>ctx[j?'lineTo':'moveTo'](C+p[0]*R,C-p[1]*R));ctx.closePath()};
    faces.map((f,i)=>({f,i,n:rotate(f.n,q),v:f.v.map(v=>rotate(v,q))}))
      .filter(f=>f.n[2]>.005).sort((a,b)=>a.n[2]-b.n[2]).forEach(({f,i,n,v})=>{
      const light=Math.max(0,dot(n,lightDir)),center=rotate(f.n,q),inset=k=>v.map(p=>p.map((x,j)=>center[j]+(x-center[j])*k));
      path(v);ctx.fillStyle='#211a13';ctx.fill();
      const outer=inset(.985),inner=inset(.905);
      for(let j=0;j<v.length;j++){
        const k=(j+1)%v.length,edge=unit(v[k].map((x,d)=>x-v[j][d]));
        let side=unit(cross(edge,n));if(dot(side,v[j].map((x,d)=>(x+v[k][d])/2-center[d]))<0)side=side.map(x=>-x);
        const bevel=unit(n.map((x,d)=>x+side[d]*1.1)),bLight=Math.max(0,dot(bevel,lightDir));
        path([outer[j],outer[k],inner[k],inner[j]]);ctx.fillStyle=rgb([233,178,82].map(x=>x*(.3+.82*bLight)));ctx.fill();
      }
      path(inner);ctx.lineWidth=1.7;ctx.strokeStyle='#ffdc8b';ctx.stroke();
      const right=unit(cross([0,1,0],f.n)),up=cross(f.n,right),rr=rotate(right,q),uu=rotate(up,q);
      ctx.save();path(inner);ctx.clip();
      ctx.save();ctx.transform(rr[0],-rr[1],-uu[0],uu[1],C+center[0]*R,C-center[1]*R);
      ctx.rotate(i*1.7);ctx.drawImage(texture,-220,-220,440,440);ctx.restore();
      ctx.fillStyle=`rgba(0,0,0,${.09+(1-light)*.48})`;ctx.fillRect(0,0,S,S);
      const shine=Math.pow(Math.max(0,dot(n,unit([-.3,.4,1]))),16);
      const glass=ctx.createLinearGradient(C+center[0]*R-90,C-center[1]*R-100,C+center[0]*R+75,C-center[1]*R+100);
      glass.addColorStop(0,`rgba(235,245,255,${.1+shine*.55})`);glass.addColorStop(.3,'rgba(255,255,255,0)');glass.addColorStop(.8,`rgba(255,226,177,${shine*.18})`);glass.addColorStop(1,'rgba(0,0,0,.18)');ctx.fillStyle=glass;ctx.fillRect(0,0,S,S);ctx.restore();
      if(n[2]<.15)return;
      ctx.save();ctx.transform(rr[0],-rr[1],-uu[0],uu[1],C+center[0]*R,C-center[1]*R);
      const value=resultFace?.index===i?resultFace.value:faceValues[i],winner=!!highlight&&resultFace?.index===i;
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${value===100?56:68}px Georgia,serif`;
      ctx.lineJoin='round';ctx.lineWidth=7;ctx.strokeStyle='#1b1008';ctx.strokeText(String(value),0,0);
      ctx.fillStyle='#6f451b';ctx.fillText(String(value),1.5,2.5);
      const gold=ctx.createLinearGradient(0,-36,0,35);gold.addColorStop(0,'#fff2bb');gold.addColorStop(.3,'#eccc77');gold.addColorStop(.6,'#bc8030');gold.addColorStop(1,'#f5dd92');
      ctx.fillStyle=winner?rollColor(highlight):gold;ctx.shadowColor=winner?rollColor(highlight):'#000';ctx.shadowBlur=winner?4:2;ctx.fillText(String(value),0,-1);
      ctx.restore();
    });
  }
  const miniCache={};
  function miniImage(){const f=faction();if(!miniCache[f]){const c=document.createElement('canvas');paintDie(c,faceQ(99));miniCache[f]=c.toDataURL()}return miniCache[f]}

  function faction(){
    try{if(draft&&(draft.faction==='Horde'||draft.faction==='Alliance'))return draft.faction}catch(e){}
    return 'Horde';
  }
  function activePerson(){
    if(!rollState||!rollState.started||rollState.position>=rollState.queue.length)return null;
    return rollState.queue[rollState.position]||null;
  }

  function ensureZone(){
    let zone=document.getElementById('wtDiceThrowZone');
    if(zone)return zone;
    const stage=document.getElementById('rollStage');
    if(!stage)return null;
    zone=document.createElement('div');
    const subtitle=stage.querySelector('.roll-sub');
    if(subtitle)subtitle.textContent='Roll 1–100. Highest roll picks first. Ties trigger a reroll between tied players.';
    zone.id='wtDiceThrowZone';
    zone.className='wt-dice-throw-zone';
    zone.innerHTML=`
      <div class="wt-dice-zone-grid" aria-hidden="true"></div>
      <div class="wt-dice-shadow" id="wtDiceShadow"></div>
      <canvas id="wtActiveDie" class="wt-active-die" role="button" tabindex="0" aria-label="Roll D100: drag and release, or press Enter" width="320" height="320"></canvas>
      <div id="wtDieResult" class="wt-die-result" aria-live="polite"></div>
      <div id="wtDiceHint" class="wt-dice-hint">Grab the die and throw it across the table · Rolls 1–100</div>`;
    const oldDie=stage.querySelector('.roll-die');
    stage.insertBefore(zone,oldDie||stage.querySelector('.roll-action'));
    bindDie(zone);
    return zone;
  }

  function resetDiePosition(){
    const zone=ensureZone(),die=document.getElementById('wtActiveDie'),shadow=document.getElementById('wtDiceShadow');
    if(!zone||!die)return;
    const zr=zone.getBoundingClientRect();
    const size=Math.max(126,Math.min(186,zr.width*.30));
    const x=Math.max(22,zr.width*.08);
    const y=Math.max(18,(zr.height-size)*.48);
    die.dataset.x=String(x);die.dataset.y=String(y);die.dataset.size=String(size);
    die.style.width=size+'px';die.style.height=size+'px';
    die.style.transform=`translate3d(${x}px,${y}px,0) rotate(0deg)`;
    resultFace=null;orientation=mul(axisQ([.3,1,.1],.23),faceQ(9));paintDie(die,orientation);
    if(shadow){
      shadow.style.width=(size*.72)+'px';
      shadow.style.transform=`translate3d(${x+size*.14}px,${y+size*.79}px,0) scaleX(.82)`;
    }
  }

  function decorateRows(){
    const mini=miniImage(),active=activePerson();
    document.querySelectorAll('#unifiedOrder .unified-order-row').forEach(row=>{
      let icon=row.querySelector('.wt-player-mini-die');
      if(!icon){icon=document.createElement('img');icon.className='wt-player-mini-die';icon.alt='';row.insertBefore(icon,row.firstChild)}
      icon.src=mini;
      const name=(row.querySelector('span')?.textContent||'').replace(/^#\d+\s*·\s*/,'').trim();
      row.classList.toggle('wt-roll-active',!!active&&name===active.name&&!!rollState?.started&&!rollState?.animating);
      row.classList.toggle('wt-roll-finished',/\d/.test(row.querySelector('strong')?.textContent||'') && !/Waiting/i.test(row.querySelector('strong')?.textContent||''));
    });
    document.querySelectorAll('#rollEntries .roll-entry').forEach((row,i)=>{
      let icon=row.querySelector('.wt-player-mini-die');
      if(!icon){icon=document.createElement('img');icon.className='wt-player-mini-die';icon.alt='';row.insertBefore(icon,row.firstChild)}
      icon.src=mini;
      const person=rollState?.people?.[i];
      row.classList.toggle('wt-roll-active',!!active&&person===active&&!rollState?.animating);
    });
  }

  function renderInteractive(){
    const zone=ensureZone(); if(!zone)return;
    const die=document.getElementById('wtActiveDie'),hint=document.getElementById('wtDiceHint'),result=document.getElementById('wtDieResult');
    const person=activePerson();
    decorateRows();
    document.getElementById('rollAction')?.classList.add('wt-roll-button-retired');
    const oldDie=document.querySelector('#rollStage .roll-die'); if(oldDie)oldDie.classList.add('wt-old-roll-die');
    if(!rollState||!rollState.started||!person){
      zone.classList.add('wt-dice-zone-inactive');
      die.classList.add('wt-die-disabled');
      die.setAttribute('aria-disabled','true');
      hint.textContent=rollState&&!rollState.started?'Start rolling when everyone is ready':'Rolls complete';
      const finished=!!(rollState?.started&&rollState.last!=null&&!person);
      if(!finished)result.classList.remove('show');
      else {paintDie(die,orientation,rollState.last);result.textContent=rollState.last;result.style.color=rollColor(rollState.last);result.classList.add('show')}
      return;
    }
    zone.classList.remove('wt-dice-zone-inactive');
    die.classList.toggle('wt-die-disabled',!!rollState.animating);
    die.setAttribute('aria-disabled',String(!!rollState.animating));
    if(!rollState.animating)paintDie(die,orientation);
    result.classList.remove('show');result.textContent='';
    hint.textContent=rollState.animating?'Die in motion…':`${person.name}: grab the die, drag, and release to roll`;
    if(!rollState.animating)resetDiePosition();
  }

  function commitRoll(finalRoll){
    const st=rollState,person=activePerson();
    if(!st||!person)return;
    person.history.push(finalRoll);st.last=finalRoll;
    $('rollHeading').textContent=person.name+' ROLLED '+finalRoll+'!';
    $('rollNotice').textContent=finalRoll===100?'Perfect roll — 100!':finalRoll===1?'Brutal. Natural 1.':'The die settles. Result locked.';
    decorateRows();
    setTimeout(()=>{
      if(rollState!==st)return;
      st.position++;st.animating=false;
      if(st.position>=st.queue.length)nextRoll(); else showRoll();
    },1500);
  }


  function animateThrow(zone,die,shadow,finalRoll,startX,startY,vx,vy){
    const st=rollState;if(!st)return;
    const zr=zone.getBoundingClientRect(),size=Number(die.dataset.size)||140;
    const maxX=Math.max(0,zr.width-size-8),maxY=Math.max(0,zr.height-size-48);
    let x=Math.max(8,Math.min(maxX,startX)),y=Math.max(4,Math.min(maxY,startY));
    vx=Math.max(-1050,Math.min(1050,vx));vy=Math.max(-360,Math.min(360,vy));
    if(Math.hypot(vx,vy)<160){vx=x>maxX*.6?-700:700;vy=-35}
    let height=20,lift=240,last=performance.now(),elapsed=0,impacts=0,settling=false,settleTime=0,fromQ;
    resultFace={index:(finalRoll-1)%faces.length,value:finalRoll};
    const target=faceQ(resultFace.index),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    die.classList.add('wt-die-thrown');die.setAttribute('aria-disabled','true');zone.classList.add('wt-zone-live-roll');
    function draw(){
      // Keep the changing polygon silhouette on the table as it tips over edges.
      const support=.5+Math.max(...faces.flatMap(f=>f.v.map(v=>-rotate(v,orientation)[1])))*171/480;
      const contactY=y+size*.90;
      die.style.transform=`translate3d(${x}px,${contactY-size*support-height}px,0)`;
      paintDie(die,orientation,settling?finalRoll:0);
      shadow.style.width=size*.78+'px';
      shadow.style.transform=`translate3d(${x+size*.11}px,${y+size*.90}px,0) scale(${1+height/140})`;
      shadow.style.opacity=String(.62/(1+height/35));
    }
    function finish(){
      orientation=target;height=0;draw();
      die.dataset.x=x;die.dataset.y=y;
      die.classList.remove('wt-die-thrown');zone.classList.remove('wt-zone-live-roll');
      const res=document.getElementById('wtDieResult');
      res.textContent=finalRoll;res.style.left=(x+size*.5)+'px';res.style.top=Math.max(22,y-14)+'px';res.style.color=rollColor(finalRoll);res.classList.add('show');
      document.getElementById('wtDiceHint').textContent='Result locked';
      commitRoll(finalRoll);
    }
    function step(now){
      if(rollState!==st||!zone.isConnected)return;
      const dt=Math.min(.035,(now-last)/1000);last=now;elapsed+=dt;
      if(reduced){settling=true;orientation=target;finish();return}
      if(settling){
        settleTime+=dt;const t=Math.min(1,settleTime/.55),ease=t*t*(3-2*t);
        orientation=mixQ(fromQ,target,ease);
        orientation=mul(axisQ([1,.3,0],Math.sin(t*Math.PI*3)*.045*(1-t)),orientation);
        draw();if(t===1){finish();return}
      }else{
        x+=vx*dt;y+=vy*dt;
        if(x<8||x>maxX){x=Math.max(8,Math.min(maxX,x));vx*=-.38}
        if(y<4||y>maxY){y=Math.max(4,Math.min(maxY,y));vy*=-.38}
        lift-=1350*dt;height+=lift*dt;
        if(height<0){height=0;if(lift<-65){impacts++;lift=impacts<3?Math.abs(lift)*.4:0;vx*=.9;vy*=.9}else lift=0}
        const friction=height>0?.3:1.8;vx*=Math.exp(-friction*dt);vy*=Math.exp(-friction*dt);
        const speed=Math.hypot(vx,vy),axis=[-vy,-vx,40];
        orientation=mul(axisQ(axis,Math.min(14,speed/(size*.27))*dt),orientation);
        draw();
        if((elapsed>1.7&&height===0&&speed<55)||elapsed>2.8){settling=true;fromQ=orientation}
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function bindDie(zone){
    const die=zone.querySelector('#wtActiveDie'),shadow=zone.querySelector('#wtDiceShadow');
    let dragging=false,pid=null,ox=0,oy=0,lastX=0,lastY=0,lastT=0,vx=0,vy=0,startPX=0,startPY=0;
    die.addEventListener('pointerdown',e=>{
      const person=activePerson();if(!person||rollState?.animating)return;
      dragging=true;pid=e.pointerId;die.setPointerCapture(pid);die.classList.add('wt-die-grabbed');
      const zr=zone.getBoundingClientRect(),x=parseFloat(die.dataset.x)||0,y=parseFloat(die.dataset.y)||0;
      ox=e.clientX-zr.left-x;oy=e.clientY-zr.top-y;lastX=e.clientX;lastY=e.clientY;lastT=performance.now();startPX=e.clientX;startPY=e.clientY;vx=0;vy=0;
      document.getElementById('wtDiceHint').textContent='Release to throw';
      e.preventDefault();
    });
    die.addEventListener('pointermove',e=>{
      if(!dragging||e.pointerId!==pid)return;
      const now=performance.now(),dt=Math.max(8,now-lastT),zr=zone.getBoundingClientRect(),size=parseFloat(die.dataset.size)||150;
      let x=e.clientX-zr.left-ox,y=e.clientY-zr.top-oy;
      x=Math.max(8,Math.min(zr.width-size-8,x));y=Math.max(8,Math.min(zr.height-size-48,y));
      vx=(e.clientX-lastX)/(dt/1000);vy=(e.clientY-lastY)/(dt/1000);lastX=e.clientX;lastY=e.clientY;lastT=now;
      die.dataset.x=String(x);die.dataset.y=String(y);
      const tilt=Math.max(-22,Math.min(22,vx*.012));
      die.style.transform=`translate3d(${x}px,${y}px,0) rotate(${tilt}deg) scale(1.055)`;
      shadow.style.transform=`translate3d(${x+size*.16}px,${Math.min(zr.height-size*.21,y+size*.79)}px,0) scaleX(.72)`;
      e.preventDefault();
    });
    const release=e=>{
      if(!dragging||e.pointerId!==pid)return;dragging=false;die.classList.remove('wt-die-grabbed');
      try{die.releasePointerCapture(pid)}catch(_){ }
      const dist=Math.hypot(e.clientX-startPX,e.clientY-startPY);
      if(performance.now()-lastT>100){vx=0;vy=0}
      if(dist<18){vx=720;vy=-55}
      const finalRoll=d100();
      rollState.animating=true;
      $('rollHeading').textContent=activePerson().name+' IS ROLLING…';$('rollNotice').textContent='The die is in motion…';
      const x=parseFloat(die.dataset.x)||0,y=parseFloat(die.dataset.y)||0;
      animateThrow(zone,die,shadow,finalRoll,x,y,vx,vy);
      decorateRows();e.preventDefault();
    };
    die.addEventListener('pointerup',release);
    die.addEventListener('pointercancel',()=>{dragging=false;die.classList.remove('wt-die-grabbed');resetDiePosition()});
    die.addEventListener('keydown',e=>{
      if((e.key!=='Enter'&&e.key!==' ')||!activePerson()||rollState.animating)return;
      e.preventDefault();rollState.animating=true;
      $('rollHeading').textContent=activePerson().name+' IS ROLLING…';
      animateThrow(zone,die,shadow,d100(),Number(die.dataset.x)||0,Number(die.dataset.y)||0,720,-55);
      decorateRows();
    });
  }

  const priorShowRoll=showRoll;
  showRoll=function(){priorShowRoll();renderInteractive()};
  const priorUnified=renderUnifiedOrder;
  renderUnifiedOrder=function(){priorUnified();decorateRows()};

  const priorStartRoll=$('rollStart').onclick;
  $('rollStart').onclick=function(...args){if(typeof priorStartRoll==='function')priorStartRoll.apply(this,args);setTimeout(renderInteractive,0)};
  window.addEventListener('resize',()=>{if(rollState&&!rollState.animating)resetDiePosition()});
  ensureZone();renderInteractive();
})();
