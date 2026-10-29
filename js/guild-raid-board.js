/* Interactive raid board. Roster identity stays in the roster; plans own their slots. */
(function() {
  'use strict';
  window.GuildRaidBoard = {create({E,B,D,getState,save,toast}) {
    const $=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const option=(v,label,current)=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(label)}</option>`;
    const color=cls=>({Shaman:'#79b2ff',Warlock:'#b5a5e5',Warrior:'#d1b08a',Druid:'#ff9a58'}[cls]||D.GREAT_REROLL_CLASS_COLORS[cls]||'#a6b1c0');
    const art=info=>D.HERO_ART[`${getState().faction}|${info.race}|${info.cls}`]||D.GREAT_REROLL_CLASS_ICONS[info.cls];
    const portrait=info=>art(info)?`<img src="${esc(art(info))}" alt="" draggable="false">`:'<span class="raid-avatar" aria-hidden="true">?</span>';
    const clone=x=>JSON.parse(JSON.stringify(x));
    const current=()=>getState().plans.find(p=>p.id===getState().activePlanId);
    const slotName=i=>`group ${Math.floor(i/5)+1}, slot ${i%5+1}`;
    let palette='roster',selection=null,dragging=false,history=[],planMode='new',editingSlot=null,draft=null,guidanceRole='',pendingChoice=null,guidanceExpanded=false;
    const host=$('raidPlanner');
    function snapshot() {const s=getState();return clone({plans:s.plans,activePlanId:s.activePlanId});}
    function change(fn,message) {
      const before=snapshot();
      fn(getState());
      B.reconcile(getState());
      history.push(before);if(history.length>30)history.shift();
      selection=null;save();render();
      if(message)announce(message);
    }
    function announce(message) {$('raidAnnouncement').textContent=message;toast(message);}
    function replacePlan(next) {const s=getState();s.plans=s.plans.map(p=>p.id===next.id?next:p);}
    function payloadFor(el) {
      if(el.dataset.sourceMember)return {kind:'member',memberId:el.dataset.sourceMember};
      if(el.dataset.sourceClass)return {kind:'class',cls:el.dataset.sourceClass,race:$('paletteRace').value,spec:''};
      if(el.dataset.sourceSlot!==undefined)return {kind:'slot',index:Number(el.dataset.sourceSlot)};
      return null;
    }
    function selectedLabel() {
      if(!selection)return '';
      if(selection.kind==='slot')return B.info(current().slots[selection.index],getState())?.label||'Card';
      if(selection.kind==='member')return E.displayName(getState().members.find(m=>m.id===selection.memberId)||{});
      return (selection.race?selection.race+' ':'')+selection.cls;
    }
    function renderSelection() {
      host.classList.toggle('is-carrying',!!selection);
      $('raidSelection').hidden=false;
      $('raidSelection').classList.toggle('is-idle',!selection);
      $('raidCancelSelection').style.visibility=selection?'visible':'hidden';
      $('raidSelectionText').textContent=selection?`${selectedLabel()} selected. Choose a slot to place it.`:'Drag a card, or tap a card then a slot.';
      host.querySelectorAll('[data-source-member],[data-source-class],[data-source-slot]').forEach(el=>{
        const payload=payloadFor(el);
        const chosen=!!selection&&JSON.stringify(payload)===JSON.stringify(selection);
        el.classList.toggle('is-picked',chosen);
        if(el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed',String(chosen));
      });
    }
    function renderPalette() {
      const state=getState(),plan=current(),term=$('paletteSearch').value.toLowerCase().trim();
      const used=new Map(plan.slots.flatMap((s,i)=>s?.kind==='member'?[[E.playerKey(B.info(s,state)),i]]:[]));
      const highlighted=new Set(B.guidance(plan,state).choices.filter(c=>c.role===guidanceRole).map(c=>c.memberId));
      $('paletteRoster').setAttribute('aria-pressed',String(palette==='roster'));
      $('paletteClasses').setAttribute('aria-pressed',String(palette==='classes'));
      $('paletteRaceLabel').hidden=palette!=='classes';
      $('paletteSearchLabel').hidden=palette!=='roster';
      $('paletteFooter').textContent=palette==='classes'?'Drop a class card to reserve a spot. Choose its spec or assign a buddy afterward.':'Drag a buddy onto the board, or select them and then choose a slot. Each buddy can appear once per plan.';
      const chosenRace=$('paletteRace').value;
      $('paletteRace').innerHTML=option('','Any race',chosenRace)+E.races(state.faction).map(r=>option(r,r,chosenRace)).join('');
      if(palette==='classes') {
        const race=$('paletteRace').value;
        $('raidPalette').innerHTML=E.availableClasses(state.faction).filter(cls=>!race||E.races(state.faction,cls).includes(race)).map(cls=>`<button class="palette-card class-template" draggable="true" data-source-class="${esc(cls)}" aria-pressed="false" aria-label="Select ${esc((race?race+' ':'')+cls)} class card" style="--class:${color(cls)}">${portrait({cls,race})}<span><strong>${esc(cls)}</strong><small>${esc(race||'Any race')} · Class card</small></span><span class="drag-grip" aria-hidden="true">⠿</span></button>`).join('');
      } else {
        const members=state.members.filter(m=>`${E.displayName(m)} ${m.cls} ${m.race} ${m.main}`.toLowerCase().includes(term)).sort((a,b)=>Number(used.has(E.playerKey(a)))-Number(used.has(E.playerKey(b)))||Number(a.status==='bench')-Number(b.status==='bench'));
        $('raidPalette').innerHTML=members.map(m=>`<button class="palette-card ${used.has(E.playerKey(m))?'on-board':''} ${highlighted.has(m.id)?'is-option':''}" draggable="${!used.has(E.playerKey(m))}" data-source-member="${esc(m.id)}" aria-pressed="false" aria-label="Select ${esc(E.displayName(m))} for this plan" ${used.has(E.playerKey(m))?'disabled':''} style="--class:${color(m.cls)}">${portrait(m)}<span><strong>${esc(m.playerName||m.name)}</strong>${m.playerName&&m.name?`<small>${esc(m.name)}</small>`:''}<small>${esc([m.race,m.cls||'Class undecided'].filter(Boolean).join(' '))}</small><small class="palette-meta">${used.has(E.playerKey(m))?`Player on board · Group ${Math.floor(used.get(E.playerKey(m))/5)+1}`:m.status==='bench'?'Guild bench · Available for this plan':esc((m.isMain?'Main · ':'Alt · ')+(m.main||'Spec undecided'))}</small></span>${!used.has(E.playerKey(m))?'<span class="drag-grip" aria-hidden="true">⠿</span>':''}</button>`).join('')||`<div class="palette-empty"><strong>${state.members.length?'No matching buddies':'Your guild starts here'}</strong><p>${state.members.length?'Try another name, class, or race.':'Add your buddies in Roster, or use class cards to sketch your composition now.'}</p>${!state.members.length?'<button class="secondary" data-go-view="roster">Add your buddies</button>':''}</div>`;
      }
      renderSelection();
    }
    function renderBoard() {
      const state=getState(),plan=current(),counts=B.counts(plan,state);
      $('raidPlanSelect').innerHTML=state.plans.map(p=>option(p.id,p.name,state.activePlanId)).join('');
      $('raidBoardTitle').textContent=plan.name;
      $('raidBoardSize').textContent=`${plan.size} players · ${plan.size/5} group${plan.size===5?'':'s'}`;
      $('raidTotals').innerHTML=`<strong>${counts.filled}<span> / ${plan.size} spots</span></strong><span>${counts.members} ${counts.members===1?'buddy':'buddies'} · ${counts.placeholders} class card${counts.placeholders===1?'':'s'} · ${counts.open} open</span>`;
      const roleLabels={Tank:'Tanks',Healer:'Healers',Melee:'Melee',Ranged:'Ranged',Undecided:'Undecided'};
      const roleColors={Tank:'#7ea9df',Healer:'#8bc5a5',Melee:'#dbac75',Ranged:'#b39bd9',Undecided:'#8d96a3'};
      $('raidRoleSummary').innerHTML=Object.entries(counts.roles).map(([role,count])=>`<span style="--role:${roleColors[role]}"><i aria-hidden="true"></i>${roleLabels[role]} <strong>${count}</strong></span>`).join('');
      $('raidNotes').hidden=!plan.notes;$('raidNotesText').textContent=plan.notes;
      $('raidUndo').disabled=!history.length;
      $('raidNew').disabled=state.plans.length>=B.MAX_PLANS;$('raidDuplicate').disabled=state.plans.length>=B.MAX_PLANS;
      $('raidGroups').innerHTML=Array.from({length:plan.size/5},(_,group)=>{
        const entries=plan.slots.slice(group*5,group*5+5);
        return `<section class="raid-group" aria-label="Group ${group+1}"><div class="raid-group-head"><h3><span aria-hidden="true">${String(group+1).padStart(2,'0')}</span> Group ${group+1}</h3><small>${entries.filter(Boolean).length} / 5</small></div><div class="raid-group-slots">${entries.map((entry,offset)=>{
          const i=group*5+offset,info=B.info(entry,state);
          if(!info)return `<div class="raid-slot is-empty" data-slot-target="${i}"><button class="empty-raid-slot" data-open-slot="${i}" aria-label="Fill ${slotName(i)}"><span aria-hidden="true">+</span><span>Open spot<small>Drop a card here</small></span></button></div>`;
          return `<div class="raid-slot filled ${info.placeholder?'is-placeholder':''}" data-slot-target="${i}" style="--class:${color(info.cls)}"><button class="raid-card-main" draggable="true" data-source-slot="${i}" data-open-slot="${i}" aria-label="Edit ${esc(info.label)} in ${slotName(i)}">${portrait(info)}<span><strong>${esc(info.placeholder?info.cls:info.playerName||info.name)}</strong>${!info.placeholder&&info.playerName&&info.name?`<small>${esc(info.name)}</small>`:''}<small>${esc([info.race||'Race undecided',!info.placeholder?info.cls:''].filter(Boolean).join(' · '))}</small><span class="raid-spec">${esc(info.spec||'Choose spec')}${info.placeholder?' <em>Unassigned</em>':''}</span></span></button><div class="raid-card-actions"><button draggable="true" data-source-slot="${i}" data-select-slot="${i}" aria-label="Move ${esc(info.label)} from ${slotName(i)}" title="Move card">⠿</button><button data-remove-slot="${i}" aria-label="Remove ${esc(info.label)} from ${slotName(i)}" title="Remove from this plan">×</button></div></div>`;
        }).join('')}</div></section>`;
      }).join('');
      renderSelection();
    }
    function render() {renderBoard();renderGuidance();renderPalette();}
    function refresh() {selection=null;history=[];guidanceExpanded=false;B.reconcile(getState());if(!getState().members.length)palette='classes';render();}
    function dropAt(target) {
      if(!selection)return;
      try {const next=B.place(current(),selection,target,getState());change(()=>replacePlan(next),`Placed in ${slotName(target)}. You can undo this change.`);$('raidGroups').querySelector(`[data-open-slot="${target}"]`)?.focus({preventScroll:true});}
      catch(error){announce(error.message);}
    }
    function openPlan(mode) {
      planMode=mode;const p=current();$('raidPlanForm').reset();$('raidPlanError').textContent='';
      $('raidPlanDialogTitle').textContent=mode==='new'?'New raid plan':'Plan settings';
      $('raidPlanName').value=mode==='new'?'':p.name;
      $('raidPlanSize').innerHTML=B.SIZES.map(n=>option(String(n),`${n} players · ${n/5} group${n===5?'':'s'}`,String(mode==='new'?20:p.size))).join('');
      $('raidPlanNoteInput').value=mode==='new'?'':p.notes;renderPlanTargets(mode==='new'?B.defaultTargets(20):p.targets);
      $('raidDelete').hidden=mode==='new';$('raidPlanSave').textContent=mode==='new'?'Create plan':'Save changes';
      $('raidPlanDialog').showModal();$('raidPlanName').focus();
    }
    function syncSlot() {
      const state=getState(),info=B.info(draft,state);
      const cls=info?.cls||'',race=info?.race||'',spec=draft.spec||'';
      $('raidSlotClass').innerHTML=option('','Class undecided',cls)+E.availableClasses(state.faction).map(c=>option(c,c,cls)).join('');
      $('raidSlotRace').innerHTML=option('','Any / undecided',race)+E.races(state.faction,cls).map(r=>option(r,r,race)).join('');
      $('raidSlotSpec').innerHTML=option('','Undecided',spec)+E.specs(cls).map(s=>option(s.name,s.name,spec)).join('');
      $('raidSlotClass').disabled=draft.kind==='member';$('raidSlotRace').disabled=draft.kind==='member';$('raidSlotSpec').disabled=!cls;
      $('raidSlotHelp').textContent=draft.kind==='member'?'Class and race come from your roster. This spec choice applies only to this raid plan.':'This class and race card reserves a spot. Assign a buddy whenever you’re ready.';
      $('raidSlotPortrait').innerHTML=portrait(info||{cls,race});renderSlotImpact();
    }
    function openSlot(index) {
      editingSlot=index;draft=clone(current().slots[index]||{kind:'class',cls:E.availableClasses(getState().faction)[0],race:'',spec:''});
      $('raidSlotTitle').textContent=`${current().slots[index]?'Edit':'Fill'} ${slotName(index)}`;
      const used=new Set(current().slots.flatMap((e,i)=>i!==index&&e?.kind==='member'?[E.playerKey(B.info(e,getState()))]:[]));
      $('raidSlotMember').innerHTML=option('','Unassigned class card',draft.kind==='member'?draft.memberId:'')+getState().members.filter(m=>!used.has(E.playerKey(m))).map(m=>option(m.id,`${E.displayName(m)} · ${m.race?m.race+' ':''}${m.cls||'Class undecided'}`,draft.memberId)).join('');
      $('raidSlotError').textContent='';syncSlot();$('raidSlotDialog').showModal();$('raidSlotMember').focus();
    }
    const roleLabel=role=>({Tank:'Tanks',Healer:'Healers',Melee:'Melee DPS',Ranged:'Ranged DPS'}[role]);
    function renderPlanTargets(targets) {
      $('raidPlanTargets').innerHTML=['Tank','Healer','Melee','Ranged'].map(role=>`<label>${roleLabel(role)}<input type="number" min="0" max="40" step="1" required data-plan-target="${role}" value="${targets[role]}" aria-label="${role} target for this plan"></label>`).join('');
    }
    $('raidPlanSize').addEventListener('change',()=>renderPlanTargets(B.defaultTargets(Number($('raidPlanSize').value))));
    function impactText(before,after) {
      const changed=['Tank','Healer','Melee','Ranged'].filter(r=>before.actual[r]!==after.actual[r]);
      return changed.length?changed.map(r=>`${roleLabel(r)}: ${before.actual[r]} → ${after.actual[r]} / ${after.targets[r]} target`).join(' · '):'Role totals stay the same.';
    }
    function renderSlotImpact() {
      const next=clone(current());next.slots[editingSlot]=B.normalizeEntry(draft,getState());
      const before=B.guidance(current(),getState()),after=B.guidance(next,getState());
      $('raidSlotImpact').textContent=impactText(before,after);
      const opened=after.gaps.filter(g=>g.count>before.gaps.find(b=>b.role===g.role).count);
      if(opened.length)$('raidSlotImpact').textContent+=' · Opens a gap in '+opened.map(g=>roleLabel(g.role).toLowerCase()).join(', ')+'.';
    }
    function renderGuidance() {
      const report=B.guidance(current(),getState()),missing=report.gaps.filter(g=>g.count);
      if(!guidanceRole||!report.gaps.some(g=>g.role===guidanceRole))guidanceRole=missing[0]?.role||'';
      if(!report.gaps.find(g=>g.role===guidanceRole)?.count)guidanceRole=missing[0]?.role||'';
      const choices=report.choices.filter(c=>c.role===guidanceRole);
      $('raidGuidanceHeading').textContent=missing.length?'What would help this lineup?':'Your role targets are covered';
      $('raidGuidanceRoles').innerHTML=report.gaps.map(g=>`<button class="guidance-role ${g.count?'has-gap':''}" data-guidance-role="${g.role}" aria-pressed="${guidanceRole===g.role}" ${!g.count?'disabled':''}><span>${roleLabel(g.role)}</span><strong>${report.actual[g.role]} <small>/ ${report.targets[g.role]}</small></strong><small>${g.count?g.count+' to fill':'Covered'}</small></button>`).join('');
      const people=new Set(choices.map(c=>c.playerId)).size;
      $('raidGuidanceOptions').hidden=!guidanceExpanded;
      $('raidGuidanceNote').hidden=!guidanceExpanded;
      $('raidToggleOptions').hidden=!choices.length;
      $('raidToggleOptions').textContent=guidanceExpanded?'Hide options ↑':'Show options →';
      $('raidToggleOptions').setAttribute('aria-expanded',String(guidanceExpanded));
      $('raidGuidanceSummary').textContent=!missing.length?'Every role target has a player assigned. Confirm availability with your friends.':choices.length?`${people} friend${people===1?' has':'s have'} an option for ${roleLabel(guidanceRole).replace('DPS','damage').toLowerCase()}.`:'No placement or switch is available with the current primary and backup specs. Add a friend, free a spot, or review your roster options.';
      $('raidGuidanceOptions').innerHTML=choices.map(c=>{
        const m=getState().members.find(m=>m.id===c.memberId),old=c.source>=0?B.info(current().slots[c.source],getState()):null;
        return `<button class="guidance-option" data-preview-member="${m.id}" data-preview-spec="${esc(c.spec)}" style="--class:${color(m.cls)}">${portrait(m)}<span><strong>${esc(m.playerName||m.name)}</strong><span>${esc(m.name||m.cls)} · ${esc(c.spec)}</span><small>${c.source>=0?'Switch from '+esc(old.spec||'undecided spec'):c.alt?'Available alt':m.main===c.spec?'Primary spec':'Backup spec'}${c.unconfirmed?' · Confirm spec with player':''}</small></span><span class="preview-label">Preview →</span></button>`;
      }).join('');
    }
    $('raidToggleOptions').addEventListener('click',()=>{guidanceExpanded=!guidanceExpanded;renderGuidance();});
    $('raidGuidance').addEventListener('click',event=>{
      const role=event.target.closest('[data-guidance-role]');if(role){guidanceRole=role.dataset.guidanceRole;guidanceExpanded=true;renderGuidance();renderPalette();return;}
      const button=event.target.closest('[data-preview-member]');if(!button)return;
      const report=B.guidance(current(),getState());
      const choice=report.choices.find(c=>c.memberId===button.dataset.previewMember&&c.spec===button.dataset.previewSpec);
      if(!choice)return;
      try {
        const next=B.previewChoice(current(),getState(),choice),after=B.guidance(next,getState());pendingChoice=choice;
        const m=getState().members.find(m=>m.id===choice.memberId),old=B.info(current().slots[choice.target],getState());
        $('raidChoiceTitle').textContent=(choice.source>=0?'Switch ':'Add ')+(m.playerName||m.name);
        $('raidChoiceIdentity').innerHTML=`${portrait(m)}<div><strong>${esc(E.displayName(m))}</strong><p>${esc(m.race+' '+m.cls)} · ${esc(choice.spec)}</p></div>`;
        $('raidChoiceImpact').textContent=impactText(report,after);
        const opened=after.gaps.filter(g=>g.count>report.gaps.find(b=>b.role===g.role).count);
        $('raidChoiceTradeoff').textContent=opened.length?'This opens a gap in '+opened.map(g=>roleLabel(g.role).toLowerCase()).join(', ')+'.': 'This fills a needed role without opening another role gap.';
        $('raidChoicePlacement').textContent=`${choice.source>=0?'Updates':'Uses'} ${slotName(choice.target)}${old?.placeholder?' · Replaces '+old.label+' class card':''}.`;
        $('raidChoiceConfirm').textContent=choice.unconfirmed?'Spec is undecided on this character. Confirm this choice with your friend.':'Uses a primary or selected backup spec. Confirm attendance with your friend.';
        $('raidChoiceDialog').showModal();
      }catch(error){announce(error.message);}
    });
    $('raidApplyChoice').addEventListener('click',()=>{
      if(!pendingChoice)return;
      try {const next=B.previewChoice(current(),getState(),pendingChoice);change(()=>replacePlan(next),'Lineup updated. Use Undo to restore the previous choice.');$('raidChoiceDialog').close();pendingChoice=null;}
      catch(error){$('raidChoiceTradeoff').textContent=error.message;}
    });
    $('raidPlanSelect').addEventListener('change',()=>{getState().activePlanId=$('raidPlanSelect').value;selection=null;guidanceExpanded=false;save();render();});
    $('raidNew').addEventListener('click',()=>openPlan('new'));
    $('raidSettings').addEventListener('click',()=>openPlan('edit'));
    $('raidEditTargets').addEventListener('click',()=>openPlan('edit'));
    $('raidDuplicate').addEventListener('click',()=>{
      try {const p=B.duplicate(current(),getState().plans);change(s=>{s.plans.push(p);s.activePlanId=p.id;},'Plan duplicated. Changes to this copy stay separate.');}
      catch(error){announce(error.message);}
    });
    $('raidPlanForm').addEventListener('submit',event=>{
      event.preventDefault();const name=$('raidPlanName').value.trim();if(!name)return;
      try {
        if(planMode==='new'&&getState().plans.length>=B.MAX_PLANS)throw new Error('You can save up to 20 raid plans.');
        const next=planMode==='new'?B.newPlan(getState().plans,name,Number($('raidPlanSize').value)):B.resize(current(),Number($('raidPlanSize').value));
        next.name=name;next.notes=$('raidPlanNoteInput').value;
        const targets=Object.fromEntries(['Tank','Healer','Melee','Ranged'].map(r=>[r,Number($('raidPlanTargets').querySelector(`[data-plan-target="${r}"]`).value)]));
        if(!B.validTargets(targets,next.size))throw new Error('Use whole numbers of zero or more. Role targets cannot exceed the group size.');
        next.targets=targets;
        change(s=>{if(planMode==='new')s.plans.push(next);else replacePlan(next);s.activePlanId=next.id;},'Raid plan saved.');
        $('raidPlanDialog').close();
      }catch(error){$('raidPlanError').textContent=error.message;}
    });
    $('raidDelete').addEventListener('click',()=>{const id=current().id;change(s=>{s.plans=s.plans.filter(p=>p.id!==id);},'Plan deleted. Use Undo to restore it.');$('raidPlanDialog').close();});
    $('raidUndo').addEventListener('click',()=>{const previous=history.pop();if(!previous)return;Object.assign(getState(),previous);selection=null;save();render();announce('Last board change undone.');});
    $('raidExpand').addEventListener('click',()=>{const expanded=document.body.classList.toggle('board-focus');$('raidExpand').textContent=expanded?'Exit expanded view':'Expand board';$('raidExpand').setAttribute('aria-pressed',String(expanded));});
    $('paletteRoster').addEventListener('click',()=>{palette='roster';selection=null;renderPalette();});
    $('paletteClasses').addEventListener('click',()=>{palette='classes';selection=null;renderPalette();});
    $('paletteSearch').addEventListener('input',renderPalette);
    $('paletteRace').addEventListener('change',()=>{selection=null;renderPalette();});
    $('raidCancelSelection').addEventListener('click',()=>{selection=null;renderSelection();});
    host.addEventListener('click',event=>{
      const target=event.target.closest('button');if(!target)return;
      if(target.dataset.removeSlot!==undefined) {
        const i=Number(target.dataset.removeSlot);change(()=>{current().slots[i]=null;},'Card removed from this plan. Use Undo to restore it.');return;
      }
      if(target.dataset.selectSlot!==undefined){selection={kind:'slot',index:Number(target.dataset.selectSlot)};renderSelection();return;}
      if(target.dataset.sourceMember||target.dataset.sourceClass) {selection=payloadFor(target);renderSelection();$('raidAnnouncement').textContent=$('raidSelectionText').textContent;return;}
      if(target.dataset.openSlot!==undefined) {const i=Number(target.dataset.openSlot);if(selection)dropAt(i);else openSlot(i);}
    });
    host.addEventListener('dragstart',event=>{
      const source=event.target.closest('[draggable="true"]');if(!source)return;
      selection=payloadFor(source);if(!selection)return;
      dragging=true;event.dataTransfer.effectAllowed=selection.kind==='class'?'copy':'move';
      event.dataTransfer.setData('text/plain','War Table card');
      renderSelection();
    });
    host.addEventListener('dragover',event=>{
      const target=event.target.closest('[data-slot-target]');if(!dragging||!selection||!target)return;
      event.preventDefault();event.dataTransfer.dropEffect=selection.kind==='class'?'copy':'move';
      host.querySelectorAll('.drop-ready').forEach(el=>el.classList.remove('drop-ready'));target.classList.add('drop-ready');
    });
    host.addEventListener('dragleave',event=>{const target=event.target.closest('[data-slot-target]');if(target&&!target.contains(event.relatedTarget))target.classList.remove('drop-ready');});
    host.addEventListener('drop',event=>{
      const target=event.target.closest('[data-slot-target]');if(!dragging||!selection||!target)return;
      event.preventDefault();dragging=false;dropAt(Number(target.dataset.slotTarget));
    });
    host.addEventListener('dragend',()=>{dragging=false;host.querySelectorAll('.drop-ready').forEach(el=>el.classList.remove('drop-ready'));selection=null;renderSelection();});
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      if(selection){selection=null;renderSelection();}
      else if(document.body.classList.contains('board-focus')&&!document.querySelector('dialog[open]'))$('raidExpand').click();
    });
    $('raidSlotMember').addEventListener('change',()=>{
      const id=$('raidSlotMember').value,old=B.info(draft,getState());
      if(id){const member=getState().members.find(m=>m.id===id);draft={kind:'member',memberId:id,spec:old?.cls===member.cls?draft.spec:member.main};}
      else draft={kind:'class',cls:old?.cls||E.availableClasses(getState().faction)[0],race:old?.race||'',spec:draft.spec};
      syncSlot();
    });
    $('raidSlotClass').addEventListener('change',()=>{draft.cls=$('raidSlotClass').value;draft.spec='';if(!E.races(getState().faction,draft.cls).includes(draft.race))draft.race='';syncSlot();});
    $('raidSlotRace').addEventListener('change',()=>{draft.race=$('raidSlotRace').value;});
    $('raidSlotSpec').addEventListener('change',()=>{draft.spec=$('raidSlotSpec').value;renderSlotImpact();});
    $('raidSlotForm').addEventListener('submit',event=>{
      event.preventDefault();const entry=B.normalizeEntry(draft,getState());
      if(!entry){$('raidSlotError').textContent='Choose a class or a roster member for this spot.';return;}
      const index=editingSlot;
      try {const next=entry.kind==='member'?B.place(current(),entry,index,getState()):clone(current());next.slots[index]=entry;change(()=>replacePlan(next),'Card saved for this plan.');}catch(error){$('raidSlotError').textContent=error.message;return;}$('raidSlotDialog').close();
      $('raidGroups').querySelector(`[data-open-slot="${index}"]`)?.focus({preventScroll:true});
    });
    document.querySelectorAll('[data-raid-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
    return {render,refresh};
  }};
})();
