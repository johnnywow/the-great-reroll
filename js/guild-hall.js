(function() {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.GR_CHARACTER_DATA;
  const E = window.GuildRosterEngine.create(D);
  const B = window.GuildRaidEngine.create(E);
  let raidBoard;
  const roles = window.GuildRosterEngine.ROLES;
  const classColor = cls => ({Shaman:'#79b2ff',Warlock:'#b5a5e5',Warrior:'#d1b08a',Druid:'#ff9a58'}[cls] || D.GREAT_REROLL_CLASS_COLORS[cls] || '#b5a283');
  const KEY = 'war-table-guild-roster-v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const option = (value, label, selected) => `<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(label)}</option>`;
  const selectOptions = (values, selected, blank) => option('',blank,selected)+values.map(v=>option(v,v,selected)).join('');
  const fresh = () => B.normalize({name:'My Guild',faction:'Horde',members:[]});
  let state = fresh(), storageBlocked = false, startupMessage = '', suggestion = null, toastTimer;
  let expanded = new Set(), addingFor = null;
  try {const saved=localStorage.getItem(KEY);if(saved)state=B.normalize(JSON.parse(saved));}
  catch(e) {storageBlocked=true;startupMessage='The saved roster could not be loaded. Export any current work, then start a new roster or import a backup.';}
  function toast(message) {clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
  function save() {
    if(storageBlocked) {$('saveStatus').textContent='Not saving — reload or start a new roster';return;}
    try {localStorage.setItem(KEY,JSON.stringify(state));$('saveStatus').textContent='Saved in this browser';}
    catch(e) {$('saveStatus').textContent='Could not save — export a backup';toast('Your changes are in this tab only. Export a backup to keep them.');}
  }
  function commit() {suggestion=null;state=B.normalize(state);save();render();}
  const counted=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
  const names = list => list.length ? list.map(m=>esc(E.displayName(m))).join(', ') : 'None yet';
  function setView(view, focus = false) {
    const selected = ['roster','composition','coverage'].includes(view) ? view : 'roster';
    if(selected==='roster')renderRoster();
    if(selected==='coverage')renderCoverage();
    if(selected==='composition')raidBoard?.render();
    if(selected!=='composition'){document.body.classList.remove('board-focus');$('raidExpand').textContent='Expand board';$('raidExpand').setAttribute('aria-pressed','false');}
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
    $('guildSubtitle').textContent=state.faction+' · '+counted(E.people(state.members).length,'friend')+' · '+counted(state.members.length,'character');
    renderSpotlight();
    const empty=!state.members.length;
    $('rosterOverview').hidden=empty;
    document.querySelector('.roster-layout').classList.toggle('is-empty',empty);
    $('rosterFilters').hidden=empty;
    $('rosterFooter').hidden=empty;
    $('rosterHint').textContent=empty?'Your people, their characters, and where they fit.':'A place for every friend. Keep their main and alts together.';
  }
  function renderRoles() {
    const active=state.members.filter(m=>m.status==='active'&&m.isMain);
    const total=Object.values(state.targets).reduce((a,b)=>a+b,0);
    const undecided=active.filter(m=>!m.main).length;
    $('activeCount').textContent=active.length;
    $('targetCount').textContent=`/ ${total} active target`;
    $('targetTotal').textContent=`${total} spots`;
    $('rosterMeta').textContent=`${counted(E.people(state.members).length,'friend')} · ${counted(state.members.filter(m=>!m.isMain).length,'alt')} · ${undecided} undecided`;
    const colors={Tank:'#7ea9df',Healer:'#8bc5a5',Melee:'#dbac75',Ranged:'#b39bd9'};
    $('roleCards').innerHTML=roles.map(role=>{
      const assigned=active.filter(m=>E.roleFor(m)===role).length;
      const assignedPlayers=new Set(active.filter(m=>E.roleFor(m)===role).map(E.playerKey));
      const backup=E.uniquePlayers(state.members.filter(m=>m.status==='active'&&!assignedPlayers.has(E.playerKey(m))&&E.candidates(m).some(s=>s.role===role))).length;
      const target=state.targets[role];
      return `<div class="role-card" style="--role:${colors[role]}"><div class="role-top"><span class="role-label"><i class="role-dot" aria-hidden="true"></i>${role==='Melee'||role==='Ranged'?role+' DPS':role+'s'}</span><span><strong>${assigned}</strong><span class="target"> / ${target}</span></span></div><div class="meter"><i style="width:${target?Math.min(100,assigned/target*100):0}%"></i></div><small>${Math.max(0,target-assigned)} open${backup?` · ${backup} other option${backup===1?'':'s'}`:''}</small></div>`;
    }).join('');
    $('targetInputs').innerHTML=roles.map(role=>`<label>${role==='Melee'||role==='Ranged'?role+' DPS':role+'s'}<input type="number" min="0" max="100" step="1" data-target="${role}" value="${state.targets[role]}" aria-label="${role} target"></label>`).join('');
    const plan=E.suggest(state,$('scenarioMode').value);
    const missing=plan.missing.filter(r=>r.count);
    $('planningInsight').innerHTML=state.members.some(m=>m.status==='active')?`<strong>${plan.assignments.length} of ${total} spots can be filled</strong><p>${missing.length?'Open roles: '+missing.map(r=>`${r.count} ${r.role.toLowerCase()}`).join(' · '):'Your current options cover every target.'}</p>`:'<strong>Your lineup starts with your roster</strong><p>Add members and choose their classes to explore a composition.</p><button class="text-button" data-go-view="roster">Go to roster →</button>';
    $('rosterNextStep').innerHTML=!active.length?'<p>Mark members Active to include them in your composition.</p>':undecided?`<p>${undecided} active member${undecided===1?' still needs':'s still need'} a primary spec.</p><button class="text-button" data-filter-undecided>Review undecided members →</button>`:`<p>Main characters count here. Alts and backup specs are additional options.</p><button class="text-button" data-go-view="composition" data-role-planner>Explore a lineup →</button>`;
    $('suggestLineup').disabled=!state.members.some(m=>m.status==='active'&&m.cls)||!total;
  }
  function renderRoster() {
    const term=$('search').value.toLowerCase().trim(), filter=$('statusFilter').value;
    const visible=state.members.filter(m=>(filter==='all'||filter===m.status||(filter==='undecided'&&!m.main&&m.status==='active')) && `${m.playerName} ${m.name} ${m.cls} ${m.race} ${m.main}`.toLowerCase().includes(term));
    $('memberCount').textContent=E.people(state.members).length;
    $('visibleCount').textContent=`${counted(E.people(visible).length,'friend')} · ${counted(visible.length,'character')}`;
    $('addMember').disabled=state.members.length>=100;
    $('bulkAdd').disabled=state.members.length>=100;
    if(!visible.length) {
      $('rosterBody').innerHTML=state.members.length
        ? '<div class="empty"><h3>No members found</h3><p>Try a different name or change your filter.</p><button data-action="clear-filters" class="secondary">Clear filters</button></div>'
        : `<div class="empty"><div class="empty-art" aria-hidden="true"><span><img src="${D.GREAT_REROLL_CLASS_ICONS.Warrior}" alt=""></span><span><img src="${D.GREAT_REROLL_CLASS_ICONS.Priest}" alt=""></span><span><img src="${D.GREAT_REROLL_CLASS_ICONS.Mage}" alt=""></span></div><h3>Bring your guild together.</h3><p>Add your members to start planning. You can choose their classes, races, and specs as you go.</p><div class="actions"><button class="primary" data-action="add">+ Add first member</button><button class="secondary" data-action="paste">Paste a list</button></div><button class="text-button example-link" data-action="example">Just exploring? Try an example roster →</button></div><div class="onboarding-steps"><div class="onboarding-step"><span>1</span><div><strong>Add your people</strong><p>One at a time or all at once.</p></div></div><div class="onboarding-step"><span>2</span><div><strong>Assign characters</strong><p>Choose classes, races, and specs.</p></div></div><div class="onboarding-step"><span>3</span><div><strong>Find your composition</strong><p>See coverage and open roles.</p></div></div></div>`;
      return;
    }
    const shown=new Set(visible.map(m=>m.id));
    $('rosterBody').innerHTML='<div class="player-cards">'+E.people(state.members).filter(group=>group.some(m=>shown.has(m.id))).map(group=>{
      const primary=group.find(m=>m.isMain)||group[0],friend=primary.playerName||'Add player name';
      const mainArt=D.HERO_ART[`${state.faction}|${primary.race}|${primary.cls}`]||D.GREAT_REROLL_CLASS_ICONS[primary.cls];
      return `<article class="player-card" style="--class:${classColor(primary.cls)}" aria-label="${esc(primary.playerName||primary.name)} player card">
        <header class="player-card-head" data-member="${primary.id}"><div class="player-portrait">${mainArt?`<img src="${esc(mainArt)}" alt="" loading="lazy">`:`<span>${esc((primary.playerName||primary.name).charAt(0))}</span>`}</div><div class="player-identity"><span class="eyebrow">YOUR PEOPLE</span><input class="player-name" data-field="playerName" value="${esc(primary.playerName)}" maxlength="80" placeholder="Add player name" aria-label="Player name for ${esc(E.displayName(primary))}"><span class="player-character-count">${group.length} character${group.length===1?'':'s'} · One raid spot</span></div><button data-action="add-alt" class="secondary add-alt" ${state.members.length>=100?'disabled':''} aria-label="Add alt for ${esc(friend)}">+ Add alt</button></header>
        <div class="player-characters">${group.filter(m=>shown.has(m.id)).sort((a,b)=>Number(b.isMain)-Number(a.isMain)).map(m=>{
          const identity=esc(E.displayName(m)),open=expanded.has(m.id);
          return `<section class="character-card ${m.status==='bench'?'bench':''}" data-member="${m.id}" style="--class:${classColor(m.cls)}">
            <div class="character-identity">${m.cls?`<img src="${esc(D.GREAT_REROLL_CLASS_ICONS[m.cls])}" alt="">`:'<span class="character-unknown">?</span>'}<div><span class="character-type">${m.isMain?'MAIN CHARACTER':'ALTERNATE'}</span><input data-field="name" value="${esc(m.name)}" maxlength="80" placeholder="Character name" aria-label="Character name for ${identity}"></div></div>
            <div class="character-fields"><label>Class<select data-field="cls" aria-label="Class for ${identity}">${selectOptions(E.availableClasses(state.faction),m.cls,'Choose class')}</select></label><label>Race<select data-field="race" aria-label="Race for ${identity}">${selectOptions(E.races(state.faction,m.cls),m.race,'Undecided')}</select></label><label>Primary spec<select data-field="main" aria-label="Primary spec for ${identity}" ${!m.cls?'disabled':''}>${selectOptions(E.specs(m.cls).map(s=>s.name),m.main,'Undecided')}</select></label></div>
            <div class="character-bottom"><label class="character-status"><span class="sr-only">Character status</span><select data-field="status" aria-label="Status for ${identity}">${option('active','Active',m.status)}${option('bench','Bench',m.status)}</select></label><span class="backup-note">${m.backups.length?m.backups.length+' backup spec'+(m.backups.length===1?'':'s'):'No backup specs'}</span><button class="options-toggle" data-action="expand" aria-expanded="${open}" aria-controls="options-${m.id}" aria-label="Details for ${identity}">${open?'Close details':'Details'}</button></div>
            <div class="character-details" id="options-${m.id}" ${open?'':'hidden'}><h3>Backup specs</h3><div class="backup-options">${E.specs(m.cls).filter(s=>s.name!==m.main).map(s=>`<label class="checkbox"><input type="checkbox" data-backup="${esc(s.name)}" ${m.backups.includes(s.name)?'checked':''}>${esc(s.name)}</label>`).join('')||'<p class="footnote">Choose a class to see spec options.</p>'}</div><label>Character notes<textarea data-field="notes" maxlength="500" rows="2" aria-label="Notes for ${identity}" placeholder="Preferences or anything worth knowing">${esc(m.notes)}</textarea></label><label>Belongs to<select data-link-player aria-label="Player for ${identity}">${E.people(state.members).map(g=>option(E.playerKey(g[0]),g[0].playerName||g[0].name,E.playerKey(m))).join('')}${group.length>1?option('separate','Create a separate player',''):''}</select></label><div class="character-detail-actions">${!m.isMain?'<button class="secondary" data-action="make-main">Make main character</button>':''}<button class="delete" data-action="delete">Remove character</button></div></div>
          </section>`;
        }).join('')}</div></article>`;
    }).join('')+'</div>';
  }
  function renderSpotlight() {
    const plan=state.plans.find(p=>p.id===state.activePlanId);if(!plan)return;
    const count=B.counts(plan,state),report=B.guidance(plan,state);
    $('spotlightTitle').textContent=plan.name;
    $('spotlightCount').textContent=`${count.members} / ${plan.size}`;
    $('spotlightDetail').textContent=count.members?'Friends placed · attendance to confirm':'Build a lineup from your friends and their alts';
    const gaps=report.gaps.filter(g=>g.count);
    $('spotlightRoles').textContent=gaps.length?'Still to fill: '+gaps.map(g=>g.role==='Melee'||g.role==='Ranged'?g.count+' '+g.role.toLowerCase()+' DPS':counted(g.count,g.role.toLowerCase())).join(' · '):'Every role target has a player assigned.';
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
    raidBoard?.refresh();
  }
  function syncAdd() {
    const cls=$('newClass').value;
    const race=$('newRace').value, spec=$('newSpec').value;
    $('newRace').innerHTML=selectOptions(E.races(state.faction,cls),race,'Undecided');
    $('newSpec').innerHTML=selectOptions(E.specs(cls).map(s=>s.name),spec,'Undecided');$('newSpec').disabled=!cls;
  }
  function openAdd(memberId=null) {addingFor=typeof memberId==='string'?state.members.find(m=>m.id===memberId):null;$('memberForm').reset();$('memberDialogTitle').textContent=addingFor?'Add an alternate character':'Add a friend';$('newPlayerName').value=addingFor?.playerName||'';$('newPlayerName').disabled=!!addingFor;$('newPlayerName').setCustomValidity('');$('newName').setCustomValidity('');$('memberDialogHint').textContent=addingFor?'Another character for '+(addingFor.playerName||addingFor.name)+'. One friend still fills one raid spot.':'Add your buddy’s name or nickname. Their character can come later.';$('newClass').innerHTML=selectOptions(E.availableClasses(state.faction),'','Undecided');syncAdd();$('memberDialog').showModal();$(addingFor?'newName':'newPlayerName').focus();}
  function newMember(raw) {
    let index=0;
    while(state.members.some(m=>m.id==='member-'+index)) index++;
    let person=0;while(state.members.some(m=>m.playerId==='player-'+person))person++;
    return E.member({...raw,playerId:raw.playerId||'player-'+person},state.faction,index);
  }
  const hasSavedWork=()=>state.members.length||state.plans.length>1||state.plans.some(p=>p.slots.some(Boolean)||p.notes||p.name!=='Raid night');
  function loadExample() {
    if(hasSavedWork()&&!confirm('Replace this roster and its raid plans with the example? Export a backup first if you want to keep them.'))return;
    state=B.normalize({name:'The Unbroken · Example',faction:'Horde',targets:{Tank:2,Healer:2,Melee:3,Ranged:3},members:[
      {playerId:'player-101',playerName:'Alex',name:'War Tusk',cls:'Warrior',race:'Troll',main:'Fury',backups:['Protection']},
      {playerName:'Sam',name:'Kill Roy',cls:'Rogue',race:'Undead',main:'Combat'},
      {playerId:'player-102',playerName:'Jordan',name:'Ironhide',cls:'Druid',race:'Tauren',main:'Feral (Tank)',backups:['Restoration']},
      {playerName:'Casey',name:'Hex',cls:'Shaman',race:'Troll',main:'Restoration',backups:['Elemental']},
      {playerName:'Riley',name:'Gravesong',cls:'Priest',race:'Undead',main:'',backups:[]},
      {playerName:'Taylor',name:'Ashfall',cls:'Mage',race:'Orc',main:'Fire'},
      {playerName:'Morgan',name:'Gore Khan',cls:'Warrior',race:'Orc',main:'',backups:[]},
      {playerName:'Jamie',name:'Wildshot',cls:'Hunter',race:'Tauren',main:'Marksmanship'},
      {playerId:'player-101',isMain:false,playerName:'Alex',name:'Duskwarden',cls:'Priest',race:'Undead',main:'Shadow',backups:['Holy']},
      {playerId:'player-102',isMain:false,playerName:'Jordan',name:'Earthsong',cls:'Shaman',race:'Tauren',main:'Enhancement',backups:['Restoration']},
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
    state=B.normalize({...state,faction});expanded.clear();commit();
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
  ['newPlayerName','newName'].forEach(id=>$(id).addEventListener('input',()=>{$('newPlayerName').setCustomValidity('');$('newName').setCustomValidity('');}));
  $('addMember').addEventListener('click',openAdd);$('bulkAdd').addEventListener('click',openBulk);$('newClass').addEventListener('change',()=>{$('newSpec').value='';syncAdd();});
  $('memberForm').addEventListener('submit',event=>{event.preventDefault();const playerName=$('newPlayerName').value.trim(),name=$('newName').value.trim();if(!playerName&&!name){const required=$(addingFor?'newName':'newPlayerName');required.setCustomValidity(addingFor?'Enter a character name.':'Enter a player or character name.');required.reportValidity();return;}if(state.members.length>=100){toast('The roster limit is 100 characters.');return;}
    state.members.push(newMember({playerName:addingFor?.playerName||playerName,name,playerId:addingFor?.playerId,isMain:!addingFor,cls:$('newClass').value,race:$('newRace').value,main:$('newSpec').value,status:$('newStatus').value}));$('memberDialog').close();commit();toast(`${playerName||name} added to the roster.`);
  });
  $('bulkForm').addEventListener('submit',event=>{event.preventDefault();const list=$('bulkNames').value.split(/\r?\n/).map(n=>n.trim()).filter(Boolean);if(!list.length)return;if(state.members.length+list.length>100){toast(`You can add ${100-state.members.length} more members.`);return;}
    list.forEach(name=>state.members.push(newMember({[$('bulkNameType').value]:name})));$('bulkDialog').close();commit();toast(`${list.length} members added.`);
  });
  function updateNames(m) {
        const linked=state.members.filter(c=>c.playerId===m.playerId);
        linked.forEach(c=>{
          $('rosterBody').querySelectorAll(`[data-member="${c.id}"]`).forEach(container=>{
            for(const [key,label] of Object.entries({playerName:'Player name',name:'Character name',cls:'Class',race:'Race',main:'Primary spec',status:'Status',notes:'Notes'}))container.querySelector(`[data-field="${key}"]`)?.setAttribute('aria-label',`${label} for ${E.displayName(c)}`);
            container.querySelector('.options-toggle')?.setAttribute('aria-label',`Details for ${E.displayName(c)}`);
            container.querySelector('[data-link-player]')?.setAttribute('aria-label',`Player for ${E.displayName(c)}`);
            container.querySelector('[data-action="add-alt"]')?.setAttribute('aria-label',`Add alt for ${c.playerName||'this player'}`);
          });
        });
        $('rosterBody').querySelector(`[data-member="${m.id}"]`)?.closest('.player-card')?.setAttribute('aria-label',`${m.playerName||m.name} player card`);
  }
  $('rosterBody').addEventListener('input',event=>{
    const field=event.target.dataset.field;
    if(!['name','playerName','notes'].includes(field))return;
    const id=event.target.closest('[data-member]')?.dataset.member;
    const member=state.members.find(m=>m.id===id);
    if(!member)return;
    member[field]=field==='notes'?event.target.value:event.target.value.trim();
    if(field==='playerName')state.members.filter(m=>E.playerKey(m)===E.playerKey(member)).forEach(m=>m.playerName=member.playerName);
    if(field==='playerName'||field==='name')updateNames(member);
    suggestion=null;
    save();
  });
  $('rosterBody').addEventListener('change',event=>{
    const row=event.target.closest('[data-member]');if(!row)return;const m=state.members.find(m=>m.id===row.dataset.member);if(!m)return;
    const field=event.target.dataset.field,backup=event.target.dataset.backup;
    if(event.target.hasAttribute('data-link-player')) {
      const key=event.target.value;if(key===m.playerId)return;
      const target=state.members.find(c=>c.playerId===key);
      const collisions=target?state.plans.filter(p=>p.slots.some(e=>e?.memberId===m.id)&&p.slots.some(e=>e?.kind==='member'&&state.members.find(c=>c.id===e.memberId)?.playerId===key)).length:0;
      if(collisions&&!confirm(`This player would appear twice in ${collisions} raid plan(s). Keep the first placement in each plan and remove the extra?`)){event.target.value=m.playerId;return;}
      m.playerId=target?.playerId||newMember({}).playerId;m.playerName=target?.playerName||m.playerName;m.isMain=!target;commit();toast(target?'Characters linked to the same player.':'Character moved to a separate player.');return;
    }
    if(backup){m.backups=event.target.checked?[...new Set([...m.backups,backup])]:m.backups.filter(s=>s!==backup);}
    else if(field){m[field]=event.target.value;if(field==='cls'){if(!E.races(state.faction,m.cls).includes(m.race))m.race='';m.main='';m.backups=[];}if(field==='main')m.backups=m.backups.filter(s=>s!==m.main);if(field==='name'||field==='playerName')m[field]=m[field].trim();}
    if(['name','playerName','notes'].includes(field)) {
      // Keep text fields mounted so tabbing or clicking into the next field stays smooth.
      save();renderChrome();renderRoles();renderCoverage();raidBoard?.refresh();
      if(field==='name'||field==='playerName') {
        row.querySelector(`[data-field="${field}"]`).value=m[field];
        ['playerName','name','cls','race','main','status'].forEach(key=>{
          const fieldEl=row.querySelector(`[data-field="${key}"]`);
          const label={playerName:'Player name',name:'Character name',cls:'Class',race:'Race',main:'Primary spec',status:'Status'}[key];
          fieldEl?.setAttribute('aria-label',`${label} for ${E.displayName(m)}`);
        });
        row.querySelector('.options-toggle')?.setAttribute('aria-label',`Details for ${E.displayName(m)}`);
        updateNames(m);
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
    if(action==='add-alt')return openAdd(id);
    if(action==='make-main'){state.members.filter(c=>c.playerId===m.playerId).forEach(c=>c.isMain=c.id===id);commit();toast('Main character updated. Saved raid choices stay the same.');return;}
    if(action==='expand'){expanded.has(id)?expanded.delete(id):expanded.add(id);renderRoster();$('rosterBody').querySelector(`[data-member="${CSS.escape(id)}"] .options-toggle`)?.focus({preventScroll:true});}
    if(action==='delete'&&confirm(`Remove ${E.displayName(m)}? This character will also be removed from saved raid plans.`)){state.members=state.members.filter(m=>m.id!==id);expanded.delete(id);commit();toast(`${E.displayName(m)} removed.`);}
  });
  $('loadExample').addEventListener('click',loadExample);
  $('newRoster').addEventListener('click',()=>{if(hasSavedWork()&&!confirm('Start a new roster and reset its raid plans? Export a backup first if you want to keep this work.'))return;state=fresh();storageBlocked=false;expanded.clear();$('search').value='';$('statusFilter').value='all';commit();});
  $('exportBackup').addEventListener('click',()=>download(JSON.stringify(state,null,2),'application/json','-roster.json'));
  $('exportCsv').addEventListener('click',()=>download(E.csv(state),'text/csv;charset=utf-8','-roster.csv'));
  $('importBackup').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async()=>{const file=$('importFile').files[0];if(!file)return;try{if(file.size>1000000)throw new Error('Choose a roster backup smaller than 1 MB.');const incoming=B.normalize(JSON.parse(await file.text()));if(hasSavedWork()&&!confirm(`Replace your current roster and raid plans with ${incoming.name} (${incoming.members.length} members)?`))return;state=incoming;storageBlocked=false;expanded.clear();$('search').value='';$('statusFilter').value='all';commit();toast('Roster imported. Review any undecided assignments.');}catch(e){toast(e instanceof SyntaxError?'That file is not a valid JSON roster backup.':e.message);}finally{$('importFile').value='';}});
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
  $('suggestLineup').addEventListener('click',()=>{
    suggestion=E.suggest(state,$('scenarioMode').value);
    const missing=suggestion.missing.filter(r=>r.count),unconfirmed=suggestion.assignments.filter(m=>m.unconfirmed);
    $('lineupContent').innerHTML=`<div class="lineup-summary">${suggestion.assignments.length} / ${suggestion.total} target spots filled<small>${$('scenarioMode').value==='potential'?'All class possibilities':'Primary + backup specs, with flexible undecided members'} · Each player appears once.</small></div>${missing.length?`<p class="warning">Open spots: ${missing.map(m=>`${m.count} ${m.role.toLowerCase()}`).join(' · ')}.</p>`:''}${unconfirmed.length?`<p class="warning">${unconfirmed.length} suggestion${unconfirmed.length===1?' needs':'s need'} player confirmation.</p>`:''}${roles.map(role=>`<h3 class="lineup-role">${role==='Ranged'||role==='Melee'?role+' DPS':role+'s'}</h3>${suggestion.assignments.filter(m=>m.role===role).map(m=>`<div class="lineup-person"><span>${esc(E.displayName(m))}${m.unconfirmed?'<small>Class possibility · confirm with player</small>':m.alt?'<small>Uses alternate character</small>':m.changed?'<small>Uses selected backup</small>':''}</span><span>${esc(m.spec)}<small style="color:${classColor(m.cls)}">${m.cls}</small></span></div>`).join('')||'<p class="footnote">No members assigned.</p>'}`).join('')}${suggestion.unassigned.length?`<p class="lineup-unassigned">Outside this lineup: ${names(suggestion.unassigned)}.</p>`:''}<p class="footnote" style="margin-top:20px">Applying makes selected characters the player’s main and updates their primary specs. Previous primary specs become backups. Other members keep their assignments and status.</p>`;
    $('applyLineup').disabled=!suggestion.assignments.some(m=>m.changed);$('lineupDialog').showModal();
  });
  $('applyLineup').addEventListener('click',()=>{if(!suggestion)return;const count=suggestion.assignments.filter(a=>a.changed).length;suggestion.assignments.forEach(a=>{const m=state.members.find(m=>m.id===a.id);if(!m)return;state.members.filter(c=>c.playerId===m.playerId).forEach(c=>c.isMain=c.id===m.id);const previous=m.main;m.main=a.spec;m.backups=[...new Set([...m.backups,...(previous&&previous!==m.main?[previous]:[])])].filter(s=>s!==m.main);});$('lineupDialog').close();commit();toast(`${count} character assignment${count===1?'':'s'} updated.`);});
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
    if(event.target.closest('[data-role-planner]')){$('rosterRolePlanner').open=true;$('rosterRolePlanner').scrollIntoView({block:'start'});}
    if(event.target.closest('[data-filter-undecided]')){
      $('statusFilter').value='undecided';$('search').value='';renderRoster();$('statusFilter').focus();
    }
    if(!event.target.closest('.tools'))document.querySelector('.tools').open=false;
  });
  document.querySelectorAll('.tools button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('.tools').open=false;}));
  raidBoard=window.GuildRaidBoard.create({E,B,D,getState:()=>state,save:()=>{save();renderSpotlight();},toast});
  render();setView('roster');if(storageBlocked){$('saveStatus').textContent='Saved roster unavailable';toast(startupMessage);}
})();
