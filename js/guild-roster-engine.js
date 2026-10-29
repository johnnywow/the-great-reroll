/* Guild Hall's planning rules. Reuses the site's shared character catalogue. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GuildRosterEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const ROLES = ['Tank', 'Healer', 'Melee', 'Ranged'];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function create(data) {
    const classes = Object.keys(data.CLASS_SPECS);
    const specs = cls => own(data.CLASS_SPECS, cls) ? data.CLASS_SPECS[cls].map(([name, role]) => ({name, role: role !== 'DPS' ? role : ['Warrior','Paladin','Rogue'].includes(cls) || (cls === 'Druid' && name === 'Feral (DPS)') || (cls === 'Shaman' && name === 'Enhancement') ? 'Melee' : 'Ranged'})) : [];
    const pool = faction => faction === 'Alliance' ? data.ALLIANCE : data.HORDE;
    const races = (faction, cls) => Object.keys(pool(faction)).filter(race => !cls || pool(faction)[race].includes(cls));
    const availableClasses = faction => classes.filter(cls => races(faction, cls).length);
    function member(raw, faction, index = 0) {
      const r = raw && typeof raw === 'object' ? raw : {};
      const cls = availableClasses(faction).includes(r.cls) ? r.cls : '';
      const allowed = specs(cls).map(s => s.name);
      const main = allowed.includes(r.main) ? r.main : '';
      const playerName = String(r.playerName || '').trim().slice(0,80);
      return {id: 'member-' + index, playerName, name: String(r.name || '').trim().slice(0,80) || (playerName ? '' : 'Member ' + (index+1)), cls,
        race: races(faction, cls).includes(r.race) ? r.race : '', main,
        backups: [...new Set(Array.isArray(r.backups) ? r.backups : [])].filter(s => allowed.includes(s) && s !== main),
        status: r.status === 'bench' ? 'bench' : 'active', notes: String(r.notes || '').slice(0,500)};
    }
    function normalize(raw) {
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.members)) throw new Error('Choose a Guild Hall roster backup with a members list.');
      if (raw.version != null && raw.version !== 1) throw new Error('This roster uses an unsupported backup version.');
      if (raw.members.length > 100) throw new Error('A roster can contain up to 100 members.');
      const faction = raw.faction === 'Alliance' ? 'Alliance' : 'Horde';
      const targets = {};
      ROLES.forEach(role => { const n = Number(raw.targets?.[role] ?? ({Tank:2,Healer:4,Melee:7,Ranged:7}[role])); targets[role] = Number.isFinite(n) ? Math.max(0,Math.min(100,Math.floor(n))) : 0; });
      if (Object.values(targets).reduce((a,b)=>a+b,0) > 100) throw new Error('Role targets must total 100 or fewer.');
      // Keep existing IDs stable: saved raid plans refer to members by ID.
      const used = new Set();
      const reserved = new Set(raw.members.map(r=>r?.id).filter(id=>/^member-\d{1,12}$/.test(id)));
      const members = raw.members.map((r,i) => {
        const preserve = /^member-\d{1,12}$/.test(r?.id) && !used.has(r.id);
        let id = preserve ? r.id : 'member-' + i;
        let next = i;
        while (used.has(id)||(!preserve&&reserved.has(id))) id = 'member-' + (++next);
        used.add(id);
        return {...member(r,faction,i),id};
      });
      return {version:1, name:String(raw.name || 'My Guild').slice(0,80), faction, targets, members};
    }
    const roleFor = (m, name = m.main) => specs(m.cls).find(s => s.name === name)?.role || '';
    const displayName = m => m.playerName ? m.playerName + (m.name ? ` (${m.name})` : '') : m.name || 'Unnamed member';
    function candidates(m, mode = 'declared') {
      const all = specs(m.cls);
      return mode === 'potential' || !m.main ? all : all.filter(s => s.name === m.main || m.backups.includes(s.name));
    }
    function coverage(state) {
      const active = state.members.filter(m=>m.status === 'active');
      return availableClasses(state.faction).map(cls => ({cls, members:active.filter(m=>m.cls === cls), specs:specs(cls).map(spec => ({...spec,
        assigned: active.filter(m=>m.cls===cls && m.main===spec.name),
        backup: active.filter(m=>m.cls===cls && m.backups.includes(spec.name)),
        possible: active.filter(m=>m.cls===cls)
      }))}));
    }
    // Maximum bipartite matching: each active member can occupy exactly one target slot.
    function suggest(state, mode = 'declared') {
      const active = state.members.filter(m=>m.status==='active');
      const slots = ROLES.flatMap(role => Array.from({length:state.targets[role]},(_,i)=>({role,index:i})));
      const owners = Array(slots.length).fill(-1);
      function assign(memberIndex, seen) {
        const options = candidates(active[memberIndex], mode).map(s=>s.role);
        const ordered = slots.map((s,i)=>({s,i})).filter(({s})=>options.includes(s.role)).sort((a,b)=>Number(b.s.role===roleFor(active[memberIndex]))-Number(a.s.role===roleFor(active[memberIndex])));
        for (const {i} of ordered) {
          if (seen.has(i)) continue;
          seen.add(i);
          if (owners[i] === -1 || assign(owners[i], seen)) {owners[i] = memberIndex; return true;}
        }
        return false;
      }
      active.map((m,i)=>i).sort((a,b)=>new Set(candidates(active[a],mode).map(s=>s.role)).size-new Set(candidates(active[b],mode).map(s=>s.role)).size).forEach(i=>assign(i,new Set()));
      const assignments = owners.flatMap((owner,i)=>{
        if (owner === -1) return [];
        const m=active[owner], role=slots[i].role;
        const list=candidates(m,mode).filter(s=>s.role===role);
        const spec=list.find(s=>s.name===m.main)?.name || list.find(s=>m.backups.includes(s.name))?.name || list[0].name;
        return [{id:m.id,name:m.name,playerName:m.playerName,cls:m.cls,role,spec,changed:m.main!==spec,unconfirmed:!m.main || (spec!==m.main && !m.backups.includes(spec))}];
      });
      const assigned = new Set(assignments.map(m=>m.id));
      return {assignments, missing:ROLES.map(role=>({role,count:slots.filter((s,i)=>s.role===role && owners[i]===-1).length})), unassigned:active.filter(m=>!assigned.has(m.id)), total:slots.length};
    }
    function csv(state) {
      const safe=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
      return [['Player name','Character name','Faction','Class','Race','Primary spec','Backup specs','Status','Notes'],...state.members.map(m=>[m.playerName,m.name,state.faction,m.cls,m.race,m.main,m.backups.join('; '),m.status,m.notes])].map(row=>row.map(safe).join(',')).join('\r\n');
    }
    return {classes, specs, races, availableClasses, member, normalize, roleFor, displayName, candidates, coverage, suggest, csv};
  }
  return {create, ROLES};
});
