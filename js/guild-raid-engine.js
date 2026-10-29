/* Saved raid compositions. Pure rules shared by the board and its tests. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuildRaidEngine = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const SIZES = [5,10,20,25,40];
  const MAX_PLANS = 20;
  const copy = value => JSON.parse(JSON.stringify(value));
  const ROLES=['Tank','Healer','Melee','Ranged'];
  const defaultTargets=size=>Object.fromEntries(ROLES.map((r,i)=>[r,({5:[1,1,1,2],10:[2,2,3,3],20:[2,4,7,7],25:[2,5,9,9],40:[3,8,14,15]}[size]||[2,4,7,7])[i]]));
  function validTargets(value,size) {return value&&ROLES.every(r=>Number.isInteger(value[r])&&value[r]>=0)&&ROLES.reduce((n,r)=>n+value[r],0)<=size;}
  function create(E) {
    function newPlan(plans, name = 'Raid night', size = 20) {
      let n = 1;
      while (plans.some(p=>p.id==='plan-'+n)) n++;
      size=SIZES.includes(Number(size))?Number(size):20;
      return {id:'plan-'+n,name:String(name).trim().slice(0,80)||'Untitled plan',size,targets:defaultTargets(size),notes:'',slots:Array(size).fill(null)};
    }
    function normalizeEntry(raw, state) {
      if (!raw || typeof raw !== 'object') return null;
      if (raw.kind==='member') {
        const m=state.members.find(m=>m.id===raw.memberId);
        return m ? {kind:'member',memberId:m.id,spec:E.specs(m.cls).some(s=>s.name===raw.spec)?raw.spec:''} : null;
      }
      if (raw.kind!=='class'||!E.availableClasses(state.faction).includes(raw.cls)) return null;
      return {kind:'class',cls:raw.cls,race:E.races(state.faction,raw.cls).includes(raw.race)?raw.race:'',spec:E.specs(raw.cls).some(s=>s.name===raw.spec)?raw.spec:''};
    }
    function normalizePlans(raw, state) {
      if (raw != null && (!Array.isArray(raw)||raw.length>MAX_PLANS)) throw new Error('A roster can contain up to 20 raid plans.');
      const plans=[];
      (raw||[]).forEach(value=>{
        if (!value||typeof value!=='object') return;
        const plan=newPlan(plans,value.name,value.size);
        if (/^plan-[a-zA-Z0-9-]{1,80}$/.test(value.id)&&!plans.some(p=>p.id===value.id)) plan.id=value.id;
        plan.notes=String(value.notes||'').slice(0,1000);
        const targets=validTargets(value.targets,plan.size)?value.targets:validTargets(state.targets,plan.size)&&Object.values(state.targets).reduce((a,b)=>a+b,0)===plan.size?state.targets:defaultTargets(plan.size);
        plan.targets=Object.fromEntries(ROLES.map(role=>[role,targets[role]]));
        const seen=new Set();
        plan.slots=plan.slots.map((_,i)=>{
          const entry=normalizeEntry(Array.isArray(value.slots)?value.slots[i]:null,state);
          if (entry?.kind==='member') {
            const key=E.playerKey(state.members.find(m=>m.id===entry.memberId));
            if (seen.has(key)) return null;
            seen.add(key);
          }
          return entry;
        });
        plans.push(plan);
      });
      return plans.length?plans:[newPlan([])];
    }
    function reconcile(state) {
      state.plans=normalizePlans(state.plans,state);
      if (!state.plans.some(p=>p.id===state.activePlanId)) state.activePlanId=state.plans[0].id;
      return state;
    }
    function normalize(raw) {
      return reconcile({...E.normalize(raw),plans:raw.plans,activePlanId:raw.activePlanId});
    }
    function info(entry,state) {
      if (!entry) return null;
      if (entry.kind==='member') {
        const m=state.members.find(m=>m.id===entry.memberId);
        return m?{...m,spec:entry.spec,role:E.roleFor(m,entry.spec),label:E.displayName(m),placeholder:false}:null;
      }
      return {...entry,role:E.roleFor(entry,entry.spec),label:(entry.race?entry.race+' ':'')+entry.cls,placeholder:true};
    }
    // A move onto an occupied slot swaps the cards; a new card replaces the target.
    // Every roster member occurs at most once in each independent plan.
    function place(plan, payload, target, state) {
      if (!Number.isInteger(target)||target<0||target>=plan.size) throw new Error('Choose a slot on this board.');
      const next=copy(plan);
      let source=-1, entry;
      if (payload.kind==='slot') {
        source=payload.index;
        if (!Number.isInteger(source)||source<0||source>=plan.size||!plan.slots[source]) throw new Error('Choose a card to move.');
        entry=plan.slots[source];
      } else if (payload.kind==='member') {
        const m=state.members.find(m=>m.id===payload.memberId);
        if (!m) throw new Error('This member is no longer in your roster.');
        source=plan.slots.findIndex(e=>e?.kind==='member'&&E.playerKey(state.members.find(m=>m.id===e.memberId)||{})===E.playerKey(m));
        if(source>=0&&plan.slots[source].memberId!==m.id&&source!==target)throw new Error(`${m.playerName||'This player'} is already on this board. Edit their existing card to switch characters.`);
        const targetEntry=plan.slots[target];
        const targetSpec=targetEntry?.kind==='class'&&targetEntry.cls===m.cls?targetEntry.spec:null;
        entry=source>=0&&plan.slots[source].memberId===m.id?plan.slots[source]:{kind:'member',memberId:m.id,spec:targetSpec??m.main};
      } else entry=normalizeEntry(payload,state);
      if (!entry) throw new Error('Choose a valid class card.');
      if (source===target) {next.slots[target]=copy(entry);return next;}
      if (source>=0) next.slots[source]=next.slots[target];
      next.slots[target]=copy(entry);
      return next;
    }
    function resize(plan,size) {
      size=Number(size);
      if (!SIZES.includes(size)) throw new Error('Choose a supported group size.');
      if (plan.slots.slice(size).some(Boolean)) throw new Error('Move or remove cards from the extra groups before reducing the size.');
      return {...copy(plan),size,targets:validTargets(plan.targets,size)?copy(plan.targets):defaultTargets(size),slots:Array.from({length:size},(_,i)=>plan.slots[i]?copy(plan.slots[i]):null)};
    }
    function duplicate(plan,plans) {
      if (plans.length>=MAX_PLANS) throw new Error('You can save up to 20 raid plans.');
      return {...copy(plan),id:newPlan(plans).id,name:(plan.name+' · Copy').slice(0,80)};
    }
    function counts(plan,state) {
      const entries=plan.slots.map(e=>info(e,state)).filter(Boolean);
      const roles={Tank:0,Healer:0,Melee:0,Ranged:0,Undecided:0};
      entries.forEach(e=>roles[e.role||'Undecided']++);
      return {filled:entries.length,members:entries.filter(e=>!e.placeholder).length,placeholders:entries.filter(e=>e.placeholder).length,open:plan.size-entries.length,roles};
    }
    function guidance(plan,state) {
      const real=plan.slots.map(e=>e?.kind==='member'?info(e,state):null).filter(Boolean);
      const actual=Object.fromEntries(ROLES.map(role=>[role,real.filter(m=>m.role===role).length]));
      const targets=validTargets(plan.targets,plan.size)?plan.targets:defaultTargets(plan.size);
      const gaps=ROLES.map(role=>({role,count:Math.max(0,targets[role]-actual[role])}));
      const choices=[];
      for(const {role,count} of gaps) {
        if(!count)continue;
        for(const m of state.members) {
          const source=plan.slots.findIndex(e=>e?.kind==='member'&&E.playerKey(info(e,state))===E.playerKey(m));
          if(m.status==='bench'&&source<0)continue;
          const old=source>=0?info(plan.slots[source],state):null;
          if(old?.role===role)continue;
          const candidates=E.candidates(m).filter(s=>s.role===role);
          const spec=candidates.find(s=>s.name===m.main)||candidates[0];
          if(!spec)continue;
          let target=source;
          if(target<0)target=plan.slots.findIndex(e=>e?.kind==='class'&&e.cls===m.cls&&(!e.spec||info(e,state).role===role));
          if(target<0)target=plan.slots.findIndex(e=>!e);
          if(target<0)target=plan.slots.findIndex(e=>e?.kind==='class');
          if(target<0)continue;
          choices.push({memberId:m.id,playerId:E.playerKey(m),role,spec:spec.name,target,source,oldRole:old?.role||'',unconfirmed:!m.main,alt:m.isMain===false});
        }
      }
      choices.sort((a,b)=>Number(a.source>=0)-Number(b.source>=0)||Number(a.unconfirmed)-Number(b.unconfirmed)||Number(a.alt)-Number(b.alt));
      return {actual,targets,gaps,choices};
    }
    function previewChoice(plan,state,choice) {
      const valid=guidance(plan,state).choices.find(c=>c.memberId===choice.memberId&&c.spec===choice.spec&&c.target===choice.target);
      if(!valid)throw new Error('This option changed. Review the updated suggestions.');
      const next=place(plan,{kind:'member',memberId:valid.memberId},valid.target,state);
      next.slots[valid.target].spec=valid.spec;
      return next;
    }
    return {normalize,normalizePlans,reconcile,newPlan,normalizeEntry,info,place,resize,duplicate,counts,guidance,previewChoice,defaultTargets,validTargets,SIZES,MAX_PLANS};
  }
  return {create};
});
