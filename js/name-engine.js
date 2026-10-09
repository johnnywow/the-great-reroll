/* Standalone, browser/CommonJS Name Forge engine. No network or numerical padding.
   Each grammar is a virtual Cartesian deck traversed in a random permutation.
   A shared full-name history also prevents duplicates between overlapping decks. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GRNameEngine=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const HISTORY_KEY='war-table-name-history-v1';
  const normalize=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
  const uniq=a=>[...new Set(a)];
  const join=(a,b)=>a+b.toLowerCase();
  const validPart=s=>/^[a-z]{2,14}$/i.test(s)&&!/(.)\1\1|[bcdfghjklmnpqrstvwxyz]{5}|[aeiou]{4}/i.test(s);
  const compounds=(a,b)=>uniq(a.flatMap(x=>b.filter(y=>!x.toLowerCase().includes(y.toLowerCase())&&!y.toLowerCase().includes(x.toLowerCase())).map(y=>join(x,y)))).filter(validPart);
  function validFull(name){
    const p=name.split(' ');
    return p.length===2&&p.every(validPart)&&normalize(p[0])!==normalize(p[1])&&name.length<=29;
  }
  function gcd(a,b){while(b){const c=a%b;a=b;b=c}return a}
  function create({data,grammar,storage=null,legacyStorage=null,random=Math.random}={}){
    if(!data||!grammar)throw new Error('Name Forge vocabulary is missing.');
    let seen=new Set(),savedRaw=null,persistent=!!storage;
    const cache=new Map();
    function importNames(names){if(Array.isArray(names))for(const n of names)if(typeof n==='string'&&n.length<100)seen.add(normalize(n))}
    function sync(){
      if(!storage)return;
      try{
        const raw=storage.getItem(HISTORY_KEY);
        if(raw!==savedRaw){const value=raw?JSON.parse(raw):[];if(!Array.isArray(value))throw new Error('Invalid history');importNames(value);savedRaw=raw}
      }catch(e){persistent=false}
    }
    sync();
    try{importNames(JSON.parse(legacyStorage?.getItem('great-reroll-name-forge-recent-v5')||'[]'))}catch(e){}
    // Preserve names already saved by users of earlier builds as well.
    try{const favorites=JSON.parse(storage?.getItem('great-reroll-name-forge-favorites-v1')||'[]');if(Array.isArray(favorites))importNames(favorites.map(x=>x?.full))}catch(e){}
    function persist(){
      if(!storage){persistent=false;return}
      try{const raw=JSON.stringify([...seen]);storage.setItem(HISTORY_KEY,raw);savedRaw=raw;persistent=true}catch(e){persistent=false}
    }
    function deck(first,last,weight=1){
      first=uniq(first);last=last?uniq(last):null;
      const size=first.length*(last?last.length:1);
      let step=size>1?1+Math.floor(random()*(size-1)):1;
      while(gcd(step,size)!==1)step=step%size+1;
      const offset=Math.floor(random()*size);
      return {weight,size,visited:0,next(){
        if(this.visited>=size)return null;
        const n=(offset+step*this.visited++)%size;
        return last?first[Math.floor(n/last.length)]+' '+last[n%last.length]:first[n];
      }};
    }
    function build(cfg){
      const r=grammar.races[cfg.race],c=grammar.classes[cfg.cls],theme=data.CLASS_SERIOUS[cfg.cls];
      if(!r||!c||!theme)throw new Error('Choose a supported race and class.');
      const decks=[];
      const add=(a,b,w)=>{if(a.length&&(!b||b.length))decks.push(deck(a,b,w))};
      const raceFirst=uniq([...(data.RACE_FIRST[cfg.race]||[]),...compounds(r.starts,r.ends)]);
      const raceLast=uniq([...(data.RACE_LAST[cfg.race]||[]),...compounds(r.roots,r.tails)]);
      // Race roots + class endings, and class roots + race endings, retain both identities.
      const themedLast=uniq([...compounds(r.roots,theme.tails),...compounds(theme.roots,r.tails)]);
      const nouns=cfg.classTheme?c.nouns:r.nouns;
      if(cfg.style==='serious'){
        add(raceFirst,cfg.classTheme?themedLast:raceLast,1);
      }else if(cfg.style==='clever'){
        const g=grammar.clever;
        add(nouns,cfg.classTheme?uniq([...c.jobs,...g.jobs]):g.jobs,4);
        add(g.descriptors,nouns,2);
        add(nouns,g.endings,2);
        add(g.first,cfg.classTheme?themedLast:raceLast,2);
        add(cfg.classTheme?(data.CLASS_CLEVER[cfg.cls]||[]):r.puns,null,2);
        // A class-specific word paired with a race-specific occupational surname.
        if(cfg.classTheme)add(r.nouns,c.jobs,2);
      }else if(cfg.style==='silly'){
        const g=grammar.silly;
        add(g.titles,compounds(nouns,g.endings),4);
        add(uniq([...r.adjectives,...g.adjectives]),nouns,3);
        add(nouns,g.jobs,3);
        add(raceFirst,compounds(nouns,g.endings),2);
        add(cfg.classTheme?(data.CLASS_SILLY[cfg.cls]||[]):[],null,1);
      }else throw new Error('Choose a supported naming style.');
      if(cfg.raunchy&&cfg.style!=='serious'){
        const a=grammar.adult;
        add(a.adjectives,nouns,2);
        add(a.nouns,a.jobs,1);
        add(cfg.classTheme?(data.CLASS_RAUNCHY[cfg.cls]||[]):data.GENERAL_RAUNCHY,null,1);
      }
      return decks;
    }
    function configKey(cfg){return JSON.stringify([cfg.race,cfg.cls,cfg.style,!!cfg.classTheme,cfg.style!=='serious'&&!!cfg.raunchy])}
    function next(decks){
      while(true){
        const available=decks.filter(d=>d.visited<d.size);
        if(!available.length)return null;
        let draw=random()*available.reduce((n,d)=>n+d.weight,0);
        const d=available.find(d=>(draw-=d.weight)<0)||available[available.length-1];
        const name=d.next();
        if(validFull(name)&&!seen.has(normalize(name)))return name;
      }
    }
    function generate(cfg,count=3){
      if(!Number.isInteger(count)||count<1||count>100)throw new Error('Choose between 1 and 100 names.');
      sync();
      const key=configKey(cfg);
      if(!cache.has(key))cache.set(key,build(cfg));
      const decks=cache.get(key),names=[];
      // Look ahead for variety within the batch; unshown candidates remain available.
      const deferred=[];
      while(names.length<count){
        let full=null;
        for(let attempts=0;attempts<24;attempts++){
          const candidate=next(decks);
          if(!candidate)break;
          const [first,last]=candidate.split(' ');
          if(names.some(n=>n.first===first||n.last===last)){deferred.push(candidate);continue}
          full=candidate;break;
        }
        while(!full&&deferred.length){const candidate=deferred.shift();if(!seen.has(normalize(candidate)))full=candidate;}
        if(!full)break;
        seen.add(normalize(full));
        const [first,last]=full.split(' ');
        names.push({first,last,full,cfg:{...cfg}});
      }
      for(let i=decks.length-1;i>=0;i--)if(decks[i].visited>=decks[i].size)decks.splice(i,1);
      const unused=uniq(deferred).filter(n=>!seen.has(normalize(n)));
      if(unused.length)decks.push(deck(unused,null,1));
      persist();
      return {names,exhausted:names.length<count,persistent,historySize:seen.size};
    }
    return {generate,historyKey:HISTORY_KEY};
  }
  return {create,validFull,HISTORY_KEY};
});
