(function() {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.GR_CHARACTER_DATA;
  const E = window.GuildRosterEngine.create(D);
  const roles = window.GuildRosterEngine.ROLES;
  const KEY = 'war-table-guild-roster-v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const option = (value, label, selected) => `<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(label)}</option>`;
  const selectOptions = (values, selected, blank) => option('',blank,selected)+values.map(v=>option(v,v,selected)).join('');
  const fresh = () => E.normalize({name:'My Guild',faction:'Horde',members:[]});
  let state = fresh(), storageBlocked = false, startupMessage = '', suggestion = null, toastTimer;
  let expanded = new Set();
  try {const saved=localStorage.getItem(KEY);if(saved)state=E.normalize(JSON.parse(saved));}
  catch(e) {storageBlocked=true;startupMessage='The saved roster could not be loaded. Export any current work, then start a new roster or import a backup.';}
  function toast(message) {clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
  function save() {
    if(storageBlocked) {$('saveStatus').textContent='Not saving — reload or start a new roster';return;}
    try {localStorage.setItem(KEY,JSON.stringify(state));$('saveStatus').textContent='Saved on this browser';}
    catch(e) {$('saveStatus').textContent='Could not save — export a backup';toast('Your changes are in this tab only. Export a backup to keep them.');}
  }
  function commit() {suggestion=null;save();render();}
  const names = list => list.length ? list.map(m=>esc(m.name)).join(', ') : 'None yet';
  function renderRoles() {
    const active=state.members.filter(m=>m.status==='active');
    const total=Object.values(state.targets).reduce((a,b)=>a+b,0);
    $('activeCount').textContent=active.length;$('targetCount').textContent=`/ ${total} target`;
    $('rosterMeta').textContent=`${state.members.length-active.length} bench · ${active.filter(m=>!m.main).length} need a spec`;
    const symbols={Tank:'◈',Healer:'✦',Melee:'⚔',Ranged:'◎'};
    $('roleCards').innerHTML=roles.map(role=>{
      const assigned=active.filter(m=>E.roleFor(m)===role).length;
      const backup=active.filter(m=>E.roleFor(m)!==role && m.backups.some(s=>E.roleFor(m,s)===role)).length;
      const target=state.targets[role];
      return `<div class="role-card panel"><div class="role-top"><span>${role==='Melee'?'Melee DPS':role==='Ranged'?'Ranged DPS':role+'s'}</span><span class="role-icon" aria-hidden="true">${symbols[role]}</span></div><div><strong>${assigned}</strong><span class="target">/ ${target} target</span></div><div class="meter"><i style="width:${target?Math.min(100,assigned/target*100):0}%"></i></div><small>${backup} backup${backup===1?'':'s'} · ${Math.max(0,target-assigned)} open</small></div>`;
    }).join('');
    $('targetInputs').innerHTML=roles.map(role=>`<label>${role==='Melee'||role==='Ranged'?role+' DPS':role+'s'}<input type="number" min="0" max="100" step="1" data-target="${role}" value="${state.targets[role]}" aria-label="${role} target"></label>`).join('');
    const plan=E.suggest(state,$('scenarioMode').value);
    const missing=plan.missing.filter(r=>r.count);
    $('planningInsight').innerHTML=`<strong>${plan.assignments.length} of ${total} spots can be filled</strong><p>${missing.length?'Still need '+missing.map(r=>`${r.count} ${r.role.toLowerCase()}`).join(' · ')+'.':'Your current options can cover every target.'}</p><p>One member per spot. Undecided specs are possibilities to confirm with players.</p>`;
    $('suggestLineup').disabled=!active.some(m=>m.cls)||!total;
  }
  function renderRoster() {
    const term=$('search').value.toLowerCase().trim(), filter=$('statusFilter').value;
    const visible=state.members.filter(m=>(filter==='all'||filter===m.status||(filter==='undecided'&&!m.main)) && `${m.name} ${m.cls} ${m.race} ${m.main}`.toLowerCase().includes(term));
    $('memberCount').textContent=state.members.length;$('visibleCount').textContent=`${visible.length} shown`;
    $('addMember').disabled=state.members.length>=100;$('bulkAdd').disabled=state.members.length>=100;
    if(!visible.length) {
      $('rosterBody').innerHTML=state.members.length?'<div class="empty"><h3>No matching members</h3><p>Try another search or status filter.</p><button data-action="clear-filters">Clear filters</button></div>':'<div class="empty"><div class="empty-symbol" aria-hidden="true">⚔</div><h3>A guild starts with its people.</h3><p>Add your members, give them a class and race, and watch your possible composition take shape.</p><div class="actions"><button class="primary" data-action="add">+ Add first member</button><button class="secondary" data-action="example">Try an example</button></div></div>';
      return;
    }
    $('rosterBody').innerHTML=visible.map(m=>{
      const color=D.GREAT_REROLL_CLASS_COLORS[m.cls]||'#b99d71';
      const art=D.HERO_ART[`${state.faction}|${m.race}|${m.cls}`]||D.GREAT_REROLL_CLASS_ICONS[m.cls];
      return `<article class="member-row ${m.status==='bench'?'bench':''}" data-member="${esc(m.id)}" style="--class:${color}"><div class="member-grid">${art?`<img class="member-art" src="${art}" alt="" loading="lazy">`:`<span class="member-art member-initial" aria-hidden="true">${esc(m.name.charAt(0))}</span>`}<label class="name-field">MEMBER${m.status==='bench'?' · BENCH':''}<input data-field="name" value="${esc(m.name)}" maxlength="80" aria-label="Member name for ${esc(m.name)}"></label><label class="class-field">CLASS<select data-field="cls" aria-label="Class for ${esc(m.name)}">${selectOptions(E.availableClasses(state.faction),m.cls,'Undecided')}</select></label><label class="race-field">RACE<select data-field="race" aria-label="Race for ${esc(m.name)}">${selectOptions(E.races(state.faction,m.cls),m.race,'Undecided')}</select></label><label class="spec-field">PRIMARY SPEC<select data-field="main" aria-label="Primary spec for ${esc(m.name)}" ${!m.cls?'disabled':''}>${selectOptions(E.specs(m.cls).map(s=>s.name),m.main,'Undecided')}</select></label><button class="options-toggle" data-action="expand" aria-expanded="${expanded.has(m.id)}" aria-controls="options-${esc(m.id)}" aria-label="Options for ${esc(m.name)}">${expanded.has(m.id)?'−':'+'}</button></div><div class="member-more" id="options-${esc(m.id)}" ${expanded.has(m.id)?'':'hidden'}><div class="member-options-head"><label>ROSTER STATUS<select data-field="status" aria-label="Status for ${esc(m.name)}">${option('active','Active roster',m.status)}${option('bench','Bench',m.status)}</select></label><button class="delete" data-action="delete">Remove member</button></div><p class="eyebrow">BACKUP SPECS</p><div class="backup-options">${E.specs(m.cls).filter(s=>s.name!==m.main).map(s=>`<label class="checkbox"><input type="checkbox" data-backup="${esc(s.name)}" ${m.backups.includes(s.name)?'checked':''}>${esc(s.name)}</label>`).join('')||'<span class="footnote">Choose a class to see spec options.</span>'}</div><label>NOTES<textarea data-field="notes" rows="2" maxlength="500" placeholder="Preferences, availability, or recruitment notes" aria-label="Notes for ${esc(m.name)}">${esc(m.notes)}</textarea></label></div></article>`;
    }).join('');
  }
  function renderCoverage() {
    $('coverageGrid').innerHTML=E.coverage(state).filter(c=>$('showEmpty').checked||c.members.length).map(c=>`<article class="class-card ${!c.members.length?'missing':''}" style="--class:${D.GREAT_REROLL_CLASS_COLORS[c.cls]}"><div class="class-head"><img src="${D.GREAT_REROLL_CLASS_ICONS[c.cls]}" alt=""><div><strong>${c.cls}</strong><small>${c.members.length?`${c.members.length} active member${c.members.length===1?'':'s'}`:'Recruitment opportunity'}</small></div><span>${c.members.length}</span></div><div class="coverage-labels"><span>Specialization</span><span>Assigned</span><span>Backup</span><span>Possible</span></div>${c.specs.map(s=>`<details class="spec-row"><summary class="spec-line" aria-label="${c.cls} ${s.name}: ${s.assigned.length} assigned, ${s.backup.length} backup, ${s.possible.length} possible"><span>${esc(s.name)}</span>${['assigned','backup','possible'].map(k=>`<span class="${s[k].length?'nonzero':'zero'}">${s[k].length}</span>`).join('')}</summary><div class="spec-people"><div><strong>Assigned:</strong> ${names(s.assigned)}</div><div><strong>Backup:</strong> ${names(s.backup)}</div><div><strong>Class possibilities:</strong> ${names(s.possible)}</div></div></details>`).join('')}</article>`).join('')||'<p class="muted">Assign a class to a member to see their spec options.</p>';
  }
  function render() {$('guildName').value=state.name;$('faction').value=state.faction;renderRoles();renderRoster();renderCoverage();}
  function syncAdd() {
    const cls=$('newClass').value;
    const race=$('newRace').value, spec=$('newSpec').value;
    $('newRace').innerHTML=selectOptions(E.races(state.faction,cls),race,'Undecided');
    $('newSpec').innerHTML=selectOptions(E.specs(cls).map(s=>s.name),spec,'Undecided');$('newSpec').disabled=!cls;
  }
  function openAdd() {$('memberForm').reset();$('newClass').innerHTML=selectOptions(E.availableClasses(state.faction),'','Undecided');syncAdd();$('memberDialog').showModal();$('newName').focus();}
  function newMember(raw) {
    let index=0;
    while(state.members.some(m=>m.id==='member-'+index)) index++;
    return E.member(raw,state.faction,index);
  }
  function loadExample() {
    if(state.members.length&&!confirm('Replace this roster with the example? Export a backup first if you want to keep it.'))return;
    state=E.normalize({name:'The Unbroken · Example',faction:'Horde',targets:{Tank:2,Healer:2,Melee:3,Ranged:3},members:[
      {name:'War Tusk',cls:'Warrior',race:'Troll',main:'Fury',backups:['Protection']},
      {name:'Kill Roy',cls:'Rogue',race:'Undead',main:'Combat'},
      {name:'Ironhide',cls:'Druid',race:'Tauren',main:'Feral (Tank)',backups:['Restoration']},
      {name:'Hex',cls:'Shaman',race:'Troll',main:'Restoration',backups:['Elemental']},
      {name:'Gravesong',cls:'Priest',race:'Undead',main:'',backups:[]},
      {name:'Ashfall',cls:'Mage',race:'Orc',main:'Fire'},
      {name:'Gore Khan',cls:'Warrior',race:'Orc',main:'',backups:[]},
      {name:'Wildshot',cls:'Hunter',race:'Tauren',main:'Marksmanship'},
      {name:'Nightveil',cls:'Warlock',race:'Undead',main:'Affliction',status:'bench'}
    ]});storageBlocked=false;expanded.clear();$('search').value='';$('statusFilter').value='all';commit();toast('Example loaded. Every assignment is editable.');
  }
  function download(content, type, suffix) {
    const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');
    a.href=url;a.download=(state.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,60)||'guild')+suffix;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('guildName').addEventListener('change',()=>{state.name=$('guildName').value.trim()||'My Guild';commit();});
  $('faction').addEventListener('change',()=>{
    const faction=$('faction').value;
    if(state.members.length&&!confirm(`Switch this roster to ${faction}? Race assignments that are unavailable for the selected class will be cleared.`)){$('faction').value=state.faction;return;}
    state=E.normalize({...state,faction});expanded.clear();commit();
  });
  $('targetInputs').addEventListener('change',event=>{
    const role=event.target.dataset.target;if(!role)return;
    const n=Number(event.target.value);if(!Number.isInteger(n)||n<0||n>100||roles.reduce((sum,r)=>sum+(r===role?n:state.targets[r]),0)>100){toast('Use whole numbers from 0 to 100, with no more than 100 total spots.');renderRoles();return;}
    state.targets[role]=n;commit();
  });
  $('search').addEventListener('input',renderRoster);$('statusFilter').addEventListener('change',renderRoster);$('showEmpty').addEventListener('change',renderCoverage);
  $('scenarioMode').addEventListener('change',()=>{$('scenarioHelp').textContent=$('scenarioMode').value==='potential'?'Explores every spec each class could play. Confirm changes with your members.':'Members without a primary spec can fill any spec their class offers.';renderRoles();});
  $('addMember').addEventListener('click',openAdd);$('bulkAdd').addEventListener('click',()=>{$('bulkForm').reset();$('bulkDialog').showModal();$('bulkNames').focus();});$('newClass').addEventListener('change',()=>{$('newSpec').value='';syncAdd();});
  $('memberForm').addEventListener('submit',event=>{event.preventDefault();const name=$('newName').value.trim();if(!name){$('newName').focus();return;}if(state.members.length>=100){toast('The roster limit is 100 members.');return;}
    state.members.push(newMember({name,cls:$('newClass').value,race:$('newRace').value,main:$('newSpec').value,status:$('newStatus').value}));$('memberDialog').close();commit();toast(`${name} added to the roster.`);
  });
  $('bulkForm').addEventListener('submit',event=>{event.preventDefault();const list=$('bulkNames').value.split(/\r?\n/).map(n=>n.trim()).filter(Boolean);if(!list.length)return;if(state.members.length+list.length>100){toast(`You can add ${100-state.members.length} more members.`);return;}
    list.forEach(name=>state.members.push(newMember({name})));$('bulkDialog').close();commit();toast(`${list.length} members added.`);
  });
  $('rosterBody').addEventListener('change',event=>{
    const row=event.target.closest('[data-member]');if(!row)return;const m=state.members.find(m=>m.id===row.dataset.member);if(!m)return;
    const field=event.target.dataset.field,backup=event.target.dataset.backup;
    if(backup){m.backups=event.target.checked?[...new Set([...m.backups,backup])]:m.backups.filter(s=>s!==backup);}
    else if(field){m[field]=event.target.value;if(field==='cls'){if(!E.races(state.faction,m.cls).includes(m.race))m.race='';m.main='';m.backups=[];}if(field==='main')m.backups=m.backups.filter(s=>s!==m.main);if(field==='name')m.name=m.name.trim()||'Unnamed member';}
    commit();
    const focusSelector=backup?`[data-backup="${CSS.escape(backup)}"]`:`[data-field="${field}"]`;
    const el=$('rosterBody').querySelector(`[data-member="${CSS.escape(m.id)}"] ${focusSelector}`);el?.focus({preventScroll:true});
  });
  $('rosterBody').addEventListener('click',event=>{
    const btn=event.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;
    if(action==='add')return openAdd();if(action==='example')return loadExample();if(action==='clear-filters'){$('search').value='';$('statusFilter').value='all';renderRoster();return;}
    const id=btn.closest('[data-member]')?.dataset.member,m=state.members.find(m=>m.id===id);if(!m)return;
    if(action==='expand'){expanded.has(id)?expanded.delete(id):expanded.add(id);renderRoster();$('rosterBody').querySelector(`[data-member="${CSS.escape(id)}"] [data-action="expand"]`)?.focus({preventScroll:true});}
    if(action==='delete'&&confirm(`Remove ${m.name} from this roster?`)){state.members=state.members.filter(m=>m.id!==id);expanded.delete(id);commit();toast(`${m.name} removed.`);}
  });
  $('loadExample').addEventListener('click',loadExample);
  $('newRoster').addEventListener('click',()=>{if(state.members.length&&!confirm('Start a new roster? Export a backup first if you want to keep this one.'))return;state=fresh();storageBlocked=false;expanded.clear();$('search').value='';$('statusFilter').value='all';commit();});
  $('exportBackup').addEventListener('click',()=>download(JSON.stringify(state,null,2),'application/json','-roster.json'));
  $('exportCsv').addEventListener('click',()=>download(E.csv(state),'text/csv;charset=utf-8','-roster.csv'));
  $('importBackup').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async()=>{const file=$('importFile').files[0];if(!file)return;try{if(file.size>1000000)throw new Error('Choose a roster backup smaller than 1 MB.');const incoming=E.normalize(JSON.parse(await file.text()));if(state.members.length&&!confirm(`Replace your current roster with ${incoming.name} (${incoming.members.length} members)?`))return;state=incoming;storageBlocked=false;expanded.clear();$('search').value='';$('statusFilter').value='all';commit();toast('Roster imported. Review any undecided assignments.');}catch(e){toast(e instanceof SyntaxError?'That file is not a valid JSON roster backup.':e.message);}finally{$('importFile').value='';}});
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
  $('suggestLineup').addEventListener('click',()=>{
    suggestion=E.suggest(state,$('scenarioMode').value);
    const missing=suggestion.missing.filter(r=>r.count),unconfirmed=suggestion.assignments.filter(m=>m.unconfirmed);
    $('lineupContent').innerHTML=`<div class="lineup-summary">${suggestion.assignments.length} / ${suggestion.total} target spots filled<small>${$('scenarioMode').value==='potential'?'All class possibilities':'Primary + backup specs, with flexible undecided members'} · Each player appears once.</small></div>${missing.length?`<p class="warning">Open spots: ${missing.map(m=>`${m.count} ${m.role.toLowerCase()}`).join(' · ')}.</p>`:''}${unconfirmed.length?`<p class="warning">${unconfirmed.length} suggestion${unconfirmed.length===1?' needs':'s need'} player confirmation.</p>`:''}${roles.map(role=>`<h3 class="lineup-role">${role==='Ranged'||role==='Melee'?role+' DPS':role+'s'}</h3>${suggestion.assignments.filter(m=>m.role===role).map(m=>`<div class="lineup-person"><span>${esc(m.name)}${m.unconfirmed?'<small>Class possibility · confirm with player</small>':m.changed?'<small>Uses selected backup</small>':''}</span><span>${esc(m.spec)}<small style="color:${D.GREAT_REROLL_CLASS_COLORS[m.cls]}">${m.cls}</small></span></div>`).join('')||'<p class="footnote">No members assigned.</p>'}`).join('')}${suggestion.unassigned.length?`<p class="lineup-unassigned">Outside this lineup: ${names(suggestion.unassigned)}.</p>`:''}<p class="footnote" style="margin-top:20px">Applying updates the listed members’ primary specs. Previous primary specs become backups. Other members keep their assignments and status.</p>`;
    $('applyLineup').disabled=!suggestion.assignments.some(m=>m.changed);$('lineupDialog').showModal();
  });
  $('applyLineup').addEventListener('click',()=>{if(!suggestion)return;const count=suggestion.assignments.filter(a=>a.changed).length;suggestion.assignments.forEach(a=>{const m=state.members.find(m=>m.id===a.id);if(!m)return;const previous=m.main;m.main=a.spec;m.backups=[...new Set([...m.backups,...(previous&&previous!==m.main?[previous]:[])])].filter(s=>s!==m.main);});$('lineupDialog').close();commit();toast(`${count} primary spec${count===1?'':'s'} updated.`);});
  window.addEventListener('storage',event=>{if(event.key===KEY){storageBlocked=true;$('saveStatus').textContent='Changed in another tab — reload to continue';toast('This roster changed in another tab. Export your work before reloading.');}});
  render();if(storageBlocked){$('saveStatus').textContent='Saved roster unavailable';toast(startupMessage);}
})();
