/* Saved raid compositions. Pure rules shared by the board and its tests. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuildRaidEngine = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const SIZES = [5,10,20,25,40];
  const MAX_PLANS = 20;
  const copy = value => JSON.parse(JSON.stringify(value));
  function create(E) {
    function newPlan(plans, name = 'Raid night', size = 20) {
      let n = 1;
      while (plans.some(p=>p.id==='plan-'+n)) n++;
      return {id:'plan-'+n,name:String(name).trim().slice(0,80)||'Untitled plan',size:SIZES.includes(Number(size))?Number(size):20,notes:'',slots:Array(SIZES.includes(Number(size))?Number(size):20).fill(null)};
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
        const seen=new Set();
        plan.slots=plan.slots.map((_,i)=>{
          const entry=normalizeEntry(Array.isArray(value.slots)?value.slots[i]:null,state);
          if (entry?.kind==='member') {
            if (seen.has(entry.memberId)) return null;
            seen.add(entry.memberId);
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
        source=plan.slots.findIndex(e=>e?.kind==='member'&&e.memberId===payload.memberId);
        const m=state.members.find(m=>m.id===payload.memberId);
        if (!m) throw new Error('This member is no longer in your roster.');
        const targetEntry=plan.slots[target];
        const targetSpec=targetEntry?.kind==='class'&&targetEntry.cls===m.cls?targetEntry.spec:null;
        entry=source>=0?plan.slots[source]:{kind:'member',memberId:m.id,spec:targetSpec??m.main};
      } else entry=normalizeEntry(payload,state);
      if (!entry) throw new Error('Choose a valid class card.');
      if (source===target) return next;
      if (source>=0) next.slots[source]=next.slots[target];
      next.slots[target]=copy(entry);
      return next;
    }
    function resize(plan,size) {
      size=Number(size);
      if (!SIZES.includes(size)) throw new Error('Choose a supported group size.');
      if (plan.slots.slice(size).some(Boolean)) throw new Error('Move or remove cards from the extra groups before reducing the size.');
      return {...copy(plan),size,slots:Array.from({length:size},(_,i)=>plan.slots[i]?copy(plan.slots[i]):null)};
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
    return {normalize,normalizePlans,reconcile,newPlan,normalizeEntry,info,place,resize,duplicate,counts,SIZES,MAX_PLANS};
  }
  return {create};
});
