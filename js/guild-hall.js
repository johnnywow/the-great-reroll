(function() {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.GR_CHARACTER_DATA;
  const E = window.GuildRosterEngine.create(D);
  const roles = window.GuildRosterEngine.ROLES;
  const classColor = cls => ({Shaman:'#79b2ff',Warlock:'#b5a5e5',Warrior:'#d1b08a',Druid:'#ff9a58'}[cls] || D.GREAT_REROLL_CLASS_COLORS[cls] || '#b5a283');
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
    try {localStorage.setItem(KEY,JSON.stringify(state));$('saveStatus').textContent='Saved in this browser';}
    catch(e) {$('saveStatus').textContent='Could not save — export a backup';toast('Your changes are in this tab only. Export a backup to keep them.');}
  }
  function commit() {suggestion=null;save();render();}
  const names = list => list.length ? list.map(m=>esc(E.displayName(m))).join(', ') : 'None yet';
  function setView(view, focus = false) {
    const selected = ['roster','composition','coverage'].includes(view) ? view : 'roster';
    if(selected==='roster')renderRoster();
    if(selected==='coverage')renderCoverage();
    document.querySelectorAll('[data-view]').forEach(tab => {
      const active=tab.dataset.view===selected;
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      $(tab.getAttribute('aria-controls')).hidden=!active;
      if(active&&focus)tab.focus();
    });
  }
  function renderChrome() {
    $('guildTitle').textContent=state.name;
    $('guildSubtitle').textContent=state.faction+' · Guild roster planner';
    const empty=!state.members.length;
    $('rosterOverview').hidden=empty;
    document.querySelector('.roster-layout').classList.toggle('is-empty',empty);
    $('rosterFilters').hidden=empty;
    $('rosterFooter').hidden=empty;
    $('rosterHint').textContent=empty?'Your people, their characters, and where they fit.':'Edit assignments directly. Open Details for backups and notes.';
  }
  function renderRoles() {
    const active=state.members.filter(m=>m.status==='active');
    const total=Object.values(state.targets).reduce((a,b)=>a+b,0);
    const undecided=active.filter(m=>!m.main).length;
    $('activeCount').textContent=active.length;
    $('targetCount').textContent=`/ ${total} active target`;
    $('targetTotal').textContent=`${total} spots`;
    $('rosterMeta').textContent=`${state.members.length-active.length} bench · ${undecided} undecided`;
    const colors={Tank:'#7ea9df',Healer:'#8bc5a5',Melee:'#dbac75',Ranged:'#b39bd9'};
    $('roleCards').innerHTML=roles.map(role=>{
      const assigned=active.filter(m=>E.roleFor(m)===role).length;
      const backup=active.filter(m=>E.roleFor(m)!==role && m.backups.some(s=>E.roleFor(m,s)===role)).length;
      const target=state.targets[role];
      return `<div class="role-card" style="--role:${colors[role]}"><div class="role-top"><span class="role-label"><i class="role-dot" aria-hidden="true"></i>${role==='Melee'||role==='Ranged'?role+' DPS':role+'s'}</span><span><strong>${assigned}</strong><span class="target"> / ${target}</span></span></div><div class="meter"><i style="width:${target?Math.min(100,assigned/target*100):0}%"></i></div><small>${Math.max(0,target-assigned)} open${backup?` · ${backup} backup${backup===1?'':'s'}`:''}</small></div>`;
    }).join('');
    $('targetInputs').innerHTML=roles.map(role=>`<label>${role==='Melee'||role==='Ranged'?role+' DPS':role+'s'}<input type="number" min="0" max="100" step="1" data-target="${role}" value="${state.targets[role]}" aria-label="${role} target"></label>`).join('');
    const plan=E.suggest(state,$('scenarioMode').value);
    const missing=plan.missing.filter(r=>r.count);
    $('planningInsight').innerHTML=active.length?`<strong>${plan.assignments.length} of ${total} spots can be filled</strong><p>${missing.length?'Open roles: '+missing.map(r=>`${r.count} ${r.role.toLowerCase()}`).join(' · '):'Your current options cover every target.'}</p>`:'<strong>Your lineup starts with your roster</strong><p>Add members and choose their classes to explore a composition.</p><button class="text-button" data-go-view="roster">Go to roster →</button>';
    $('rosterNextStep').innerHTML=!active.length?'<p>Mark members Active to include them in your composition.</p>':undecided?`<p>${undecided} active member${undecided===1?' still needs':'s still need'} a primary spec.</p><button class="text-button" data-filter-undecided>Review undecided members →</button>`:`<p>All active members have a primary spec.</p><button class="text-button" data-go-view="composition">Explore a lineup →</button>`;
    $('suggestLineup').disabled=!active.some(m=>m.cls)||!total;
  }
  function renderRoster() {
    const term=$('search').value.toLowerCase().trim(), filter=$('statusFilter').value;
    const visible=state.members.filter(m=>(filter==='all'||filter===m.status||(filter==='undecided'&&!m.main&&m.status==='active')) && `${m.playerName} ${m.name} ${m.cls} ${m.race} ${m.main}`.toLowerCase().includes(term));
    $('memberCount').textContent=state.members.length;
    $('visibleCount').textContent=`${visible.length} member${visible.length===1?'':'s'}`;
    $('addMember').disabled=state.members.length>=100;
    $('bulkAdd').disabled=state.members.length>=100;
    if(!visible.length) {
      $('rosterBody').innerHTML=state.members.length
        ? '<div class="empty"><h3>No members found</h3><p>Try a different name or change your filter.</p><button data-action="clear-filters" class="secondary">Clear filters</button></div>'
        : `<div class="empty"><div class="empty-art" aria-hidden="true"><span><img src="${D.GREAT_REROLL_CLASS_ICONS.Warrior}" alt=""></span><span><img src="${D.GREAT_REROLL_CLASS_ICONS.Priest}" alt=""></span><span><img src="${D.GREAT_REROLL_CLASS_ICONS.Mage}" alt=""></span></div><h3>Bring your guild together.</h3><p>Add your members to start planning. You can choose their classes, races, and specs as you go.</p><div class="actions"><button class="primary" data-action="add">+ Add first member</button><button class="secondary" data-action="paste">Paste a list</button></div><button class="text-button example-link" data-action="example">Just exploring? Try an example roster →</button></div><div class="onboarding-steps"><div class="onboarding-step"><span>1</span><div><strong>Add your people</strong><p>One at a time or all at once.</p></div></div><div class="onboarding-step"><span>2</span><div><strong>Assign characters</strong><p>Choose classes, races, and specs.</p></div></div><div class="onboarding-step"><span>3</span><div><strong>Find your composition</strong><p>See coverage and open roles.</p></div></div></div>`;
      return;
    }
    const rows=visible.map(m=>{
      const color=classColor(m.cls);
      const art=D.HERO_ART[`${state.faction}|${m.race}|${m.cls}`]||D.GREAT_REROLL_CLASS_ICONS[m.cls];
      const open=expanded.has(m.id);
      const identity=esc(E.displayName(m));
      return `<tr class="member-row ${m.status==='bench'?'bench':''} ${open?'is-expanded':''}" data-member="${esc(m.id)}" style="--class:${color}"><td><div class="member-cell">${art?`<img class="member-art" src="${art}" alt="" loading="lazy">`:`<span class="member-art member-initial" aria-hidden="true">${esc((m.playerName||m.name).charAt(0))}</span>`}<div class="member-names"><input data-field="playerName" value="${esc(m.playerName)}" maxlength="80" placeholder="Add player name" title="Player name" aria-label="Player name for ${identity}"><input data-field="name" value="${esc(m.name)}" maxlength="80" placeholder="Character name" title="Character name" aria-label="Character name for ${identity}"></div></div></td><td><label><span class="mobile-label">Class</span><select data-field="cls" aria-label="Class for ${identity}">${selectOptions(E.availableClasses(state.faction),m.cls,'Choose class')}</select></label></td><td><label><span class="mobile-label">Race</span><select data-field="race" class="${m.race?'':'undecided'}" aria-label="Race for ${identity}">${selectOptions(E.races(state.faction,m.cls),m.race,'Undecided')}</select></label></td><td><label><span class="mobile-label">Primary spec</span><select data-field="main" class="${m.main?'':'undecided'}" aria-label="Primary spec for ${identity}" ${!m.cls?'disabled':''}>${selectOptions(E.specs(m.cls).map(s=>s.name),m.main,m.cls?'Undecided':'Choose a class')}</select></label>${m.backups.length?`<button class="spec-backups" data-action="expand" aria-label="Backup specs for ${identity}">+ ${m.backups.length} backup${m.backups.length===1?'':'s'}</button>`:''}</td><td><label><span class="mobile-label">Status</span><select class="status-select" data-field="status" aria-label="Status for ${identity}">${option('active','Active',m.status)}${option('bench','Bench',m.status)}</select></label></td><td><button class="options-toggle" data-action="expand" aria-expanded="${open}" aria-controls="options-${esc(m.id)}" aria-label="Details for ${identity}">${open?'Close':'Details'}</button></td></tr><tr class="member-details" data-member="${esc(m.id)}" id="options-${esc(m.id)}" ${open?'':'hidden'}><td colspan="6"><div class="member-more"><div class="member-options-head"><h3>Backup specs</h3><button class="delete" data-action="delete">Remove member</button></div><div class="backup-options">${E.specs(m.cls).filter(s=>s.name!==m.main).map(s=>`<label class="checkbox"><input type="checkbox" data-backup="${esc(s.name)}" ${m.backups.includes(s.name)?'checked':''}>${esc(s.name)}</label>`).join('')||'<span class="footnote">Choose a class to see spec options.</span>'}</div><label>Notes<textarea data-field="notes" rows="2" maxlength="500" placeholder="Preferences, availability, or anything worth knowing" aria-label="Notes for ${identity}">${esc(m.notes)}</textarea></label></div></td></tr>`;
    }).join('');
    $('rosterBody').innerHTML=`<table class="roster-table"><caption class="sr-only">Guild members and character assignments</caption><thead><tr><th scope="col">Player / character</th><th scope="col">Class</th><th scope="col">Race</th><th scope="col">Primary spec</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Member details</span></th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderCoverage() {
    $('coverageGrid').innerHTML=E.coverage(state).filter(c=>$('showEmpty').checked||c.members.length).map(c=>`<article class="class-card ${!c.members.length?'missing':''}" style="--class:${classColor(c.cls)}"><div class="class-head"><img src="${D.GREAT_REROLL_CLASS_ICONS[c.cls]}" alt=""><div><strong>${c.cls}</strong><small>${c.members.length?'Active roster':'No active members'}</small></div><span>${c.members.length} member${c.members.length===1?'':'s'}</span></div><div class="coverage-labels"><span>Spec</span><span>Assigned</span><span>Backup</span><span>Possible</span></div>${c.specs.map(s=>`<details class="spec-row"><summary class="spec-line" aria-label="${c.cls} ${s.name}: ${s.assigned.length} assigned, ${s.backup.length} backup, ${s.possible.length} possible"><span>${esc(s.name)}</span>${['assigned','backup','possible'].map(k=>`<span class="${s[k].length?'nonzero':'zero'}">${s[k].length||'—'}</span>`).join('')}</summary><div class="spec-people"><div><strong>Assigned:</strong> ${names(s.assigned)}</div><div><strong>Backup:</strong> ${names(s.backup)}</div><div><strong>Class possibilities:</strong> ${names(s.possible)}</div></div></details>`).join('')}</article>`).join('')||'<div class="empty"><h3>Your spec options will appear here.</h3><p>Add active members and choose their classes to see what your guild could cover.</p><button class="secondary" data-go-view="roster">Go to roster →</button></div>';
  }
  function render() {
    $('guildName').value=state.name;
    $('faction').value=state.faction;
    renderChrome();
    renderRoles();
    renderRoster();
    renderCoverage();
  }
  function syncAdd() {
    const cls=$('newClass').value;
    const race=$('newRace').value, spec=$('newSpec').value;
    $('newRace').innerHTML=selectOptions(E.races(state.faction,cls),race,'Undecided');
    $('newSpec').innerHTML=selectOptions(E.specs(cls).map(s=>s.name),spec,'Undecided');$('newSpec').disabled=!cls;
  }
  function openAdd() {$('memberForm').reset();$('newPlayerName').setCustomValidity('');$('newClass').innerHTML=selectOptions(E.availableClasses(state.faction),'','Undecided');syncAdd();$('memberDialog').showModal();$('newPlayerName').focus();}
  function newMember(raw) {
    let index=0;
    while(state.members.some(m=>m.id==='member-'+index)) index++;
    return E.member(raw,state.faction,index);
  }
  function loadExample() {
    if(state.members.length&&!confirm('Replace this roster with the example? Export a backup first if you want to keep it.'))return;
    state=E.normalize({name:'The Unbroken · Example',faction:'Horde',targets:{Tank:2,Healer:2,Melee:3,Ranged:3},members:[
      {playerName:'Alex',name:'War Tusk',cls:'Warrior',race:'Troll',main:'Fury',backups:['Protection']},
      {playerName:'Sam',name:'Kill Roy',cls:'Rogue',race:'Undead',main:'Combat'},
      {playerName:'Jordan',name:'Ironhide',cls:'Druid',race:'Tauren',main:'Feral (Tank)',backups:['Restoration']},
      {playerName:'Casey',name:'Hex',cls:'Shaman',race:'Troll',main:'Restoration',backups:['Elemental']},
      {playerName:'Riley',name:'Gravesong',cls:'Priest',race:'Undead',main:'',backups:[]},
      {playerName:'Taylor',name:'Ashfall',cls:'Mage',race:'Orc',main:'Fire'},
      {playerName:'Morgan',name:'Gore Khan',cls:'Warrior',race:'Orc',main:'',backups:[]},
      {playerName:'Jamie',name:'Wildshot',cls:'Hunter',race:'Tauren',main:'Marksmanship'},
      {playerName:'Drew',name:'Nightveil',cls:'Warlock',race:'Undead',main:'Affliction',status:'bench'}
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
  function syncBulk() {$('bulkNames').placeholder=$('bulkNameType').value==='playerName'?'Alex\nSam\nJordan':'War Tusk\nKill Roy\nGoro Khan';}
  function openBulk() {$('bulkForm').reset();syncBulk();$('bulkDialog').showModal();$('bulkNames').focus();}
  $('bulkNameType').addEventListener('change',syncBulk);
  ['newPlayerName','newName'].forEach(id=>$(id).addEventListener('input',()=>$('newPlayerName').setCustomValidity('')));
  $('addMember').addEventListener('click',openAdd);$('bulkAdd').addEventListener('click',openBulk);$('newClass').addEventListener('change',()=>{$('newSpec').value='';syncAdd();});
  $('memberForm').addEventListener('submit',event=>{event.preventDefault();const playerName=$('newPlayerName').value.trim(),name=$('newName').value.trim();if(!playerName&&!name){$('newPlayerName').setCustomValidity('Enter a player or character name.');$('newPlayerName').reportValidity();return;}if(state.members.length>=100){toast('The roster limit is 100 members.');return;}
    state.members.push(newMember({playerName,name,cls:$('newClass').value,race:$('newRace').value,main:$('newSpec').value,status:$('newStatus').value}));$('memberDialog').close();commit();toast(`${playerName||name} added to the roster.`);
  });
  $('bulkForm').addEventListener('submit',event=>{event.preventDefault();const list=$('bulkNames').value.split(/\r?\n/).map(n=>n.trim()).filter(Boolean);if(!list.length)return;if(state.members.length+list.length>100){toast(`You can add ${100-state.members.length} more members.`);return;}
    list.forEach(name=>state.members.push(newMember({[$('bulkNameType').value]:name})));$('bulkDialog').close();commit();toast(`${list.length} members added.`);
  });
  $('rosterBody').addEventListener('input',event=>{
    const field=event.target.dataset.field;
    if(!['name','playerName','notes'].includes(field))return;
    const id=event.target.closest('[data-member]')?.dataset.member;
    const member=state.members.find(m=>m.id===id);
    if(!member)return;
    member[field]=field==='notes'?event.target.value:event.target.value.trim();
    suggestion=null;
    save();
  });
  $('rosterBody').addEventListener('change',event=>{
    const row=event.target.closest('[data-member]');if(!row)return;const m=state.members.find(m=>m.id===row.dataset.member);if(!m)return;
    const field=event.target.dataset.field,backup=event.target.dataset.backup;
    if(backup){m.backups=event.target.checked?[...new Set([...m.backups,backup])]:m.backups.filter(s=>s!==backup);}
    else if(field){m[field]=event.target.value;if(field==='cls'){if(!E.races(state.faction,m.cls).includes(m.race))m.race='';m.main='';m.backups=[];}if(field==='main')m.backups=m.backups.filter(s=>s!==m.main);if(field==='name'||field==='playerName')m[field]=m[field].trim();}
    if(['name','playerName','notes'].includes(field)) {
      // Keep text fields mounted so tabbing or clicking into the next field stays smooth.
      save();renderChrome();renderRoles();renderCoverage();
      if(field==='name'||field==='playerName') {
        row.querySelector(`[data-field="${field}"]`).value=m[field];
        ['playerName','name','cls','race','main','status'].forEach(key=>{
          const fieldEl=row.querySelector(`[data-field="${key}"]`);
          const label={playerName:'Player name',name:'Character name',cls:'Class',race:'Race',main:'Primary spec',status:'Status'}[key];
          fieldEl?.setAttribute('aria-label',`${label} for ${E.displayName(m)}`);
        });
        row.querySelector('.options-toggle')?.setAttribute('aria-label',`Details for ${E.displayName(m)}`);
      }
      suggestion=null;
      return;
    }
    commit();
    const focusSelector=backup?`[data-backup="${CSS.escape(backup)}"]`:`[data-field="${field}"]`;
    const el=$('rosterBody').querySelector(`[data-member="${CSS.escape(m.id)}"] ${focusSelector}`);el?.focus({preventScroll:true});
  });
  $('rosterBody').addEventListener('click',event=>{
    const btn=event.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;
    if(action==='add')return openAdd();if(action==='paste')return openBulk();if(action==='example')return loadExample();if(action==='clear-filters'){$('search').value='';$('statusFilter').value='all';renderRoster();return;}
    const id=btn.closest('[data-member]')?.dataset.member,m=state.members.find(m=>m.id===id);if(!m)return;
    if(action==='expand'){expanded.has(id)?expanded.delete(id):expanded.add(id);renderRoster();$('rosterBody').querySelector(`[data-member="${CSS.escape(id)}"] .options-toggle`)?.focus({preventScroll:true});}
    if(action==='delete'&&confirm(`Remove ${E.displayName(m)} from this roster?`)){state.members=state.members.filter(m=>m.id!==id);expanded.delete(id);commit();toast(`${E.displayName(m)} removed.`);}
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
    $('lineupContent').innerHTML=`<div class="lineup-summary">${suggestion.assignments.length} / ${suggestion.total} target spots filled<small>${$('scenarioMode').value==='potential'?'All class possibilities':'Primary + backup specs, with flexible undecided members'} · Each player appears once.</small></div>${missing.length?`<p class="warning">Open spots: ${missing.map(m=>`${m.count} ${m.role.toLowerCase()}`).join(' · ')}.</p>`:''}${unconfirmed.length?`<p class="warning">${unconfirmed.length} suggestion${unconfirmed.length===1?' needs':'s need'} player confirmation.</p>`:''}${roles.map(role=>`<h3 class="lineup-role">${role==='Ranged'||role==='Melee'?role+' DPS':role+'s'}</h3>${suggestion.assignments.filter(m=>m.role===role).map(m=>`<div class="lineup-person"><span>${esc(E.displayName(m))}${m.unconfirmed?'<small>Class possibility · confirm with player</small>':m.changed?'<small>Uses selected backup</small>':''}</span><span>${esc(m.spec)}<small style="color:${classColor(m.cls)}">${m.cls}</small></span></div>`).join('')||'<p class="footnote">No members assigned.</p>'}`).join('')}${suggestion.unassigned.length?`<p class="lineup-unassigned">Outside this lineup: ${names(suggestion.unassigned)}.</p>`:''}<p class="footnote" style="margin-top:20px">Applying updates the listed members’ primary specs. Previous primary specs become backups. Other members keep their assignments and status.</p>`;
    $('applyLineup').disabled=!suggestion.assignments.some(m=>m.changed);$('lineupDialog').showModal();
  });
  $('applyLineup').addEventListener('click',()=>{if(!suggestion)return;const count=suggestion.assignments.filter(a=>a.changed).length;suggestion.assignments.forEach(a=>{const m=state.members.find(m=>m.id===a.id);if(!m)return;const previous=m.main;m.main=a.spec;m.backups=[...new Set([...m.backups,...(previous&&previous!==m.main?[previous]:[])])].filter(s=>s!==m.main);});$('lineupDialog').close();commit();toast(`${count} primary spec${count===1?'':'s'} updated.`);});
  window.addEventListener('storage',event=>{if(event.key===KEY){storageBlocked=true;$('saveStatus').textContent='Changed in another tab — reload to continue';toast('This roster changed in another tab. Export your work before reloading.');}});
  $('editGuild').addEventListener('click',()=>{$('guildDialog').showModal();$('guildName').focus();});
  document.querySelectorAll('[data-view]').forEach(tab=>{
    tab.addEventListener('click',()=>setView(tab.dataset.view));
    tab.addEventListener('keydown',event=>{
      const tabs=Array.from(document.querySelectorAll('[data-view]'));
      const index=tabs.indexOf(tab);
      let next;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();setView(tabs[next].dataset.view,true);}
    });
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-go-view]');
    if(target)setView(target.dataset.goView,true);
    if(event.target.closest('[data-filter-undecided]')){
      $('statusFilter').value='undecided';$('search').value='';renderRoster();$('statusFilter').focus();
    }
    if(!event.target.closest('.tools'))document.querySelector('.tools').open=false;
  });
  document.querySelectorAll('.tools button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('.tools').open=false;}));
  render();setView('roster');if(storageBlocked){$('saveStatus').textContent='Saved roster unavailable';toast(startupMessage);}
})();
