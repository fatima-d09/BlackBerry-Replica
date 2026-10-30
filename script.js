// Quill K1 phone logic
(function(){
const scr=document.getElementById('scr'), phoneEl=document.getElementById('phone'), led=document.getElementById('led');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem('quillk1.'+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem('quillk1.'+k,JSON.stringify(v))}catch(e){}}};
const rand=n=>Math.floor(Math.random()*n);
const pick=a=>a[rand(a.length)];
const now=()=>Date.now();
const MIN=60000;
const pad2=n=>String(n).padStart(2,'0');
function fmtT(t){const d=new Date(t);let h=d.getHours()%12||12;return h+':'+pad2(d.getMinutes())}
function fmtWhen(t){const d=new Date(t),n=new Date();if(d.toDateString()===n.toDateString())return fmtT(t);return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ---------- data ---------- */
const seedContacts=[
 {id:1,name:'Maya Okafor',phone:'(212) 555-0148'},{id:2,name:'Dev Patel',phone:'(646) 555-0192'},
 {id:3,name:'Lena Fischer',phone:'(917) 555-0133'},{id:4,name:'Marcus Reed',phone:'(718) 555-0176'},
 {id:5,name:'Priya Shah',phone:'(347) 555-0121'},{id:6,name:'Tom Alvarez',phone:'(212) 555-0187'},
 {id:7,name:'Mom',phone:'(203) 555-0110'}];
const T0=now();
const seedThreads={
 1:{unread:1,msgs:[{me:0,text:'Are you coming to the show Saturday?',t:T0-95*MIN},{me:1,text:"Wouldn't miss it",t:T0-90*MIN},{me:0,text:"Doors at 8. I'll save you a spot up front",t:T0-12*MIN}]},
 2:{unread:0,msgs:[{me:1,text:'Did the build pass?',t:T0-300*MIN},{me:0,text:'Green across the board',t:T0-290*MIN}]},
 7:{unread:1,msgs:[{me:0,text:'Call me when you land, sweetheart',t:T0-40*MIN}]}};
let contacts=store.get('contacts',seedContacts);
let threads=store.get('threads',seedThreads);
let callLog=store.get('calls',[{cid:3,num:'(917) 555-0133',type:'missed',t:T0-70*MIN},{cid:4,num:'(718) 555-0176',type:'out',t:T0-26*60*MIN}]);
let notes=store.get('notes',[{id:1,text:'Groceries\n- coffee beans\n- limes\n- AA batteries',t:T0-3*1440*MIN},{id:2,text:'Gift ideas for Priya: field notebook, that ramen place gift card',t:T0-1440*MIN}]);
let events=store.get('events',(()=>{const d=new Date();const o={};o[dkey(d)]=['6:30 Climbing w/ Dev'];const d2=new Date(d);d2.setDate(d.getDate()+1);o[dkey(d2)]=['Show at 8 (Maya)'];const d3=new Date(d);d3.setDate(d.getDate()+5);o[dkey(d3)]=['Dentist 10am'];return o})());
let settings=Object.assign({clicks:true,led:true,wall:0,tone:true},store.get('settings',{}));
let scores=Object.assign({bricks:0,snake:0,mines:0},store.get('scores',{}));
function dkey(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
const save={c(){store.set('contacts',contacts)},th(){store.set('threads',threads)},calls(){store.set('calls',callLog)},n(){store.set('notes',notes)},ev(){store.set('events',events)},s(){store.set('settings',settings)},sc(){store.set('scores',scores)}};
const cById=id=>contacts.find(c=>c.id===id);
const AVC=['#e0624f','#e08a2e','#38a56a','#2f8fd8','#8a63d2','#d2558f','#2aa3a3'];
const ini=n=>(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const avc=n=>{let h=0;for(const c of n||'')h=(h*31+c.charCodeAt(0))|0;return AVC[Math.abs(h)%AVC.length]};
const cname=id=>(cById(id)||{}).name||'Unknown';
const totalUnread=()=>Object.values(threads).reduce((a,t)=>a+(t.unread||0),0);
const missedCount=()=>callLog.filter(c=>c.type==='missed'&&!c.seen).length;

/* ---------- sound ---------- */
let actx=null;
function tone(f,d,v=.04,type='square',delay=0){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const t=actx.currentTime+delay;const o=actx.createOscillator(),g=actx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+d)}catch(e){}}
const click=()=>{if(settings.clicks)tone(1800,.025,.025)};
const chime=()=>{if(settings.tone){tone(988,.12,.05,'sine');tone(1319,.18,.05,'sine',.12)}};
const blip=()=>tone(660,.06,.04);
const thud=()=>tone(140,.25,.06,'sawtooth');

/* ---------- screen stack ---------- */
let stack=[], menu=null, toastMsg=null, toastTimer=0;
const top=()=>stack[stack.length-1];
function push(s){stack.push(s);s.enter&&s.enter();draw()}
function pop(){if(stack.length>1){const s=stack.pop();s.leave&&s.leave();draw()}}
function goHome(){while(stack.length>1){const s=stack.pop();s.leave&&s.leave()}menu=null;draw()}
function toast(m){toastMsg=m;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastMsg=null;draw()},1300);draw()}

function statusBar(){
  const u=totalUnread();
  return `<div class="sb"><span class="l"><span class="bat"><i></i></span>${u?`<span>✉ ${u}</span>`:''}${missedCount()?`<span>☏ ${missedCount()}</span>`:''}</span>
  <span class="c" id="sbt">${fmtT(now())}</span><span class="r">QNET LTE<span class="sig"><i style="height:3px"></i><i style="height:5px"></i><i style="height:7px"></i><i style="height:10px"></i></span></span></div>`;
}
function draw(){
  const s=top();
  const bar=false, pr=null;
  scr.innerHTML=statusBar()+`<div class="bd ${bar?'wb':''}">${s.html()}</div>`+
    (bar?`<div class="ab"><button class="bk" data-act="back" aria-label="Back">‹</button>${pr?`<button class="pr" data-act="primary">${esc(pr.label)}</button>`:'<span></span>'}<button class="mo" data-act="menu" aria-label="More options">⋯</button></div>`:'')+
    (menu?`<div class="menu">${menu.items.map((m,i)=>`<div class="row ${i===menu.sel?'sel':''}" data-m="${i}">${esc(m.label)}</div>`).join('')}</div>`:'')+
    (toastMsg?`<div class="toast">${esc(toastMsg)}</div>`:'');
  const bd=scr.querySelector('.bd');
  s.mounted&&s.mounted(bd);
  const list=bd.querySelector('.list'), sel=list&&list.querySelector('.row.sel');
  if(list){list.scrollTop=s._st||0;if(sel)ensureVisible(list,sel);s._st=list.scrollTop}
  led.classList.toggle('on',settings.led&&(totalUnread()>0||missedCount()>0));
}
function ensureVisible(list,el){
  if(el.offsetTop<list.scrollTop)list.scrollTop=el.offsetTop;
  else if(el.offsetTop+el.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=el.offsetTop+el.offsetHeight-list.clientHeight;
}
function openMenu(items){menu={items:[...items,{label:'Close',fn:()=>{}}],sel:0};draw()}
const ch=k=>k.length===1?k:(k==='space'?' ':null);

function dispatch(k,src){
  click();
  if(menu){
    if(k==='up')menu.sel=Math.max(0,menu.sel-1);
    else if(k==='down')menu.sel=Math.min(menu.items.length-1,menu.sel+1);
    else if(k==='select'||k==='enter'){const m=menu.items[menu.sel];menu=null;draw();m.fn();return}
    else if(k==='back'||k==='menu'){menu=null}
    else if(k==='end'){menu=null;goHome();return}
    draw();return;
  }
  const s=top();
  if(s.key&&s.key(k,src))return;
  if(k==='back'){pop();return}
  if(k==='menu'){openMenu((s.menu&&s.menu())||[]);return}
  if(k==='end'){goHome();return}
  if(k==='call'){push(phoneScreen());return}
}

/* ---------- icons ---------- */
const P='fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS={
 messages:`<svg viewBox="0 0 24 24" ${P}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/></svg>`,
 contacts:`<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>`,
 phone:`<svg viewBox="0 0 24 24" fill="#fff"><path d="M6.6 3h3l1.4 4.2-2.1 1.3a11 11 0 0 0 5.6 5.6l1.3-2.1L20 13.4v3a2 2 0 0 1-2 2A15.6 15.6 0 0 1 4.6 5a2 2 0 0 1 2-2z"/></svg>`,
 calendar:`<svg viewBox="0 0 24 24" ${P}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" stroke-width="2.6"/></svg>`,
 memo:`<svg viewBox="0 0 24 24" ${P}><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 14.5h7M9 18h4"/></svg>`,
 clock:`<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>`,
 bricks:`<svg viewBox="0 0 24 24" fill="#fff"><rect x="3" y="4" width="5" height="3" rx=".6"/><rect x="9.5" y="4" width="5" height="3" rx=".6"/><rect x="16" y="4" width="5" height="3" rx=".6"/><rect x="6" y="8.5" width="5" height="3" rx=".6"/><rect x="13" y="8.5" width="5" height="3" rx=".6"/><circle cx="14" cy="15.5" r="1.6"/><rect x="7" y="19" width="10" height="2" rx="1"/></svg>`,
 snake:`<svg viewBox="0 0 24 24" ${P} stroke-width="2.6"><path d="M4 18h6V12h8V6"/><circle cx="18" cy="6" r=".6" fill="#fff"/><path d="M14 18h.01" stroke-width="3.2"/></svg>`,
 mines:`<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="5" fill="#fff"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>`,
 settings:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff"><circle cx="12" cy="12" r="6.5" stroke-width="4" stroke-dasharray="2.6 2.5"/><circle cx="12" cy="12" r="4.5" stroke-width="2"/></svg>`};
const APPS=[
 {id:'messages',name:'Messages',c:'#2f6fb5',open:()=>messagesScreen()},
 {id:'contacts',name:'Contacts',c:'#3a8b6e',open:()=>contactsScreen()},
 {id:'phone',name:'Phone',c:'#3c9a3f',open:()=>phoneScreen()},
 {id:'calendar',name:'Calendar',c:'#c2553f',open:()=>calendarScreen()},
 {id:'memo',name:'MemoPad',c:'#c79a2c',open:()=>memoScreen()},
 {id:'clock',name:'Clock',c:'#4b5866',open:()=>clockScreen()},
 {id:'bricks',name:'Bricks',c:'#8a4fb3',open:()=>bricksScreen()},
 {id:'snake',name:'Snake',c:'#5f8f2a',open:()=>snakeScreen()},
 {id:'mines',name:'Mines',c:'#7b6a58',open:()=>minesScreen()},
 {id:'settings',name:'Settings',c:'#5a6470',open:()=>settingsScreen()}];
const WALLS=[
 {n:'Nebula',bg:'radial-gradient(45% 35% at 78% 18%,rgba(110,200,255,.75),transparent 70%),radial-gradient(55% 45% at 12% 85%,rgba(200,70,220,.7),transparent 70%),radial-gradient(40% 30% at 40% 50%,rgba(70,90,255,.55),transparent 70%),linear-gradient(165deg,#1a2a8a,#3b1676 60%,#12062e)'},
 {n:'Lagoon',bg:'radial-gradient(50% 40% at 80% 15%,rgba(120,255,220,.6),transparent 70%),radial-gradient(60% 50% at 10% 90%,rgba(30,140,200,.7),transparent 70%),linear-gradient(165deg,#0b5a6e,#0a2a4a 60%,#04121f)'},
 {n:'Ember',bg:'radial-gradient(50% 40% at 75% 20%,rgba(255,180,90,.7),transparent 70%),radial-gradient(60% 50% at 15% 85%,rgba(230,60,90,.65),transparent 70%),linear-gradient(165deg,#7a2a3a,#3a1030 60%,#14060f)'},
 {n:'Slate',bg:'radial-gradient(50% 40% at 75% 15%,rgba(200,210,230,.35),transparent 70%),linear-gradient(165deg,#3e4652,#1c2027 60%,#0b0d10)'}];

/* ---------- home ---------- */
function homeScreen(){
  const s={sel:0,live:true,
   html(){
    const d=new Date(),u=totalUnread(),m=missedCount();
    return `<div class="home" style="background:${WALLS[settings.wall].bg}">
     <div class="hclock">${fmtT(now())}<small>${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}</small></div>
     ${u||m?`<div class="hnote">${u?`<span>✉ ${u} new message${u>1?'s':''}</span>`:''}${m?`<span>☏ ${m} missed call${m>1?'s':''}</span>`:''}</div>`:''}
     <div class="grid">${APPS.map((a,i)=>`<div class="ico ${i===s.sel?'sel':''}" data-i="${i}" title="${a.name}"><i style="background:linear-gradient(160deg,rgba(255,255,255,.22),rgba(0,0,0,.12)),${a.c}">${ICONS[a.id]}</i><b>${a.name}</b></div>`).join('')}</div></div>`},
   key(k){
    if(k==='left')s.sel=(s.sel+9)%10;else if(k==='right')s.sel=(s.sel+1)%10;
    else if(k==='up'||k==='down')s.sel=(s.sel+5)%10;
    else if(k==='select'||k==='enter'){push(APPS[s.sel].open());return true}
    else if(k==='back')return true;
    else return false;
    draw();return true},
   menu(){return[{label:'Open '+APPS[s.sel].name,fn:()=>push(APPS[s.sel].open())},{label:'Compose message',fn:()=>push(pickContact('Compose to',id=>{stack.pop();push(threadScreen(id))}))},{label:'Change wallpaper',fn:()=>{settings.wall=(settings.wall+1)%WALLS.length;save.s();draw()}}]}};
  return s;
}

/* ---------- generic list ---------- */
function listScreen(o){
  const s={sel:0,q:'',
   items(){let it=o.items();if(o.filter&&s.q){const q=s.q.toLowerCase();it=it.filter(x=>x.label.toLowerCase().includes(q)||(x.sub||'').toLowerCase().includes(q))}return it},
   html(){
    const it=s.items();s.sel=Math.max(0,Math.min(s.sel,it.length-1));
    return `<div class="hdr">${esc(typeof o.title==='function'?o.title():o.title)}${o.right?`<span>${esc(o.right())}</span>`:''}</div>`+
     (o.filter?`<div class="find">Find: <b>${esc(s.q)}</b><span class="caret"></span></div>`:'')+
     `<div class="list ${o.filter?'f':''}">${it.length?it.map((x,i)=>`<div class="row ${i===s.sel?'sel':''} ${x.bold?'b':''}" data-i="${i}">${x.av?`<span class="av" style="background:${avc(x.label)}">${esc(ini(x.label))}</span>`:''}${x.gl?`<span class="gl" style="color:${x.glc}">${x.gl}</span>`:''}${x.dot?`<span class="dot" style="background:${x.dot}"></span>`:''}<div class="tx"><div>${esc(x.label)}</div>${x.sub?`<div class="s">${esc(x.sub)}</div>`:''}</div>${x.rt?`<span class="rt">${esc(x.rt)}</span>`:''}${x.un?'<span class="un"></span>':''}</div>`).join(''):`<div class="empty">${esc(o.empty||'Nothing here yet')}</div>`}</div>`},
   key(k){
    const n=s.items().length;
    if(k==='up')s.sel=Math.max(0,s.sel-1);
    else if(k==='down')s.sel=Math.min(n-1,s.sel+1);
    else if(k==='select'||k==='enter'){const x=s.items()[s.sel];if(x&&x.fn)x.fn();return true}
    else if(o.filter&&k==='bksp')s.q=s.q.slice(0,-1);
    else if(o.filter&&k==='back'&&s.q)s.q='';
    else if(o.filter&&ch(k)){s.q+=ch(k);s.sel=0}
    else if(o.key&&o.key(k,s))return true;
    else return false;
    draw();return true},
   menu:o.menu?()=>o.menu(s):null,prim:o.primary?()=>o.primary(s):null};
  return s;
}
function confirmScreen(q,yesLabel,fn){
  return listScreen({title:q,items:()=>[{label:yesLabel,fn:()=>{stack.pop();fn()}},{label:'Cancel',fn:()=>pop()}]});
}

/* ---------- text input ---------- */
function inputScreen(title,init,onSave,opts={}){
  const s={buf:init||'',
   html(){return `<div class="hdr">${esc(title)}<span>${opts.multiline?'Back saves':'Enter saves'}</span></div><div class="ed ${opts.multiline?'':'single'}">${s.buf?esc(s.buf):`<span style="color:#93a0ac">${esc(opts.ph||'Start typing…')}</span>`}<span class="caret"></span></div>`},
   key(k){
    if(k==='bksp')s.buf=s.buf.slice(0,-1);
    else if(k==='enter'){if(opts.multiline)s.buf+='\n';else{done();return true}}
    else if(k==='select'&&!opts.multiline){done();return true}
    else if(k==='back'){done();return true}
    else if(ch(k))s.buf+=ch(k);
    else return false;
    draw();return true},
   menu(){return[{label:'Save',fn:done},{label:'Discard',fn:()=>pop()}]},prim:()=>({label:'Save',fn:done})};
  function done(){const v=s.buf.trim();stack.pop();if(v)onSave(v);draw()}
  return s;
}

/* ---------- messages ---------- */
const REPLIES=['Sounds good!','On my way.','Ha, nice','Can I call you later?','Yes! See you then.','Give me 5 min','Perfect, thanks','lol','Running a bit late, sorry','Got it','Wait, really?','Deal.','Haha same','Let me check and get back to you'];
const OPENERS=['Are we still on for lunch?','Did you see the game last night?','Call me when you get a sec','Pick up milk on the way home pls','Meeting moved to 3','Look outside, the sky is unreal right now','Are you around this weekend?'];
const typingNow={};
function addMsg(cid,me,text){
  threads[cid]=threads[cid]||{unread:0,msgs:[]};
  threads[cid].msgs.push({me:me?1:0,text,t:now()});
  if(!me){const t=top();if(t&&t.cid===cid&&!menu){}else{threads[cid].unread=(threads[cid].unread||0)+1;notify()}}
  save.th();
}
function notify(){chime();phoneEl.classList.remove('buzz');void phoneEl.offsetWidth;phoneEl.classList.add('buzz')}
function scheduleReply(cid){
  if(typingNow[cid])return;
  typingNow[cid]=true;
  const d=1500+rand(2500);
  setTimeout(()=>{if(top().cid===cid)draw()},500);
  setTimeout(()=>{typingNow[cid]=false;addMsg(cid,false,pick(REPLIES));draw()},d);
}
function messagesScreen(){
  return listScreen({title:'Messages',primary:()=>({label:'Compose',fn:()=>push(pickContact('Compose to',cid=>{stack.pop();push(threadScreen(cid))}))}),right:()=>{const u=totalUnread();return u?u+' unread':''},
   empty:'No messages. Press Menu to compose.',
   items:()=>Object.keys(threads).filter(id=>threads[id].msgs.length).map(Number)
     .sort((a,b)=>threads[b].msgs.at(-1).t-threads[a].msgs.at(-1).t)
     .map(id=>{const m=threads[id].msgs.at(-1);return{av:1,un:threads[id].unread>0,label:cname(id),sub:(m.me?'You: ':'')+m.text,rt:fmtWhen(m.t),bold:threads[id].unread>0,fn:()=>push(threadScreen(id))}}),
   menu:(s)=>{const ids=Object.keys(threads).filter(id=>threads[id].msgs.length).map(Number).sort((a,b)=>threads[b].msgs.at(-1).t-threads[a].msgs.at(-1).t);const id=ids[s.sel];
     return[{label:'Compose message',fn:()=>push(pickContact('Compose to',cid=>{stack.pop();push(threadScreen(cid))}))},
      ...(id!=null?[{label:'Call '+cname(id),fn:()=>startCall(id)},{label:'Delete conversation',fn:()=>push(confirmScreen('Delete conversation?','Delete',()=>{delete threads[id];save.th();draw()}))}]:[]),
      {label:'Mark all read',fn:()=>{Object.values(threads).forEach(t=>t.unread=0);save.th();draw()}}]}});
}
function pickContact(title,fn){
  return listScreen({title,filter:true,empty:'No matches',items:()=>[...contacts].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({av:1,label:c.name,sub:c.phone,fn:()=>fn(c.id)}))});
}
function threadScreen(cid){
  const s={cid,buf:'',off:0,
   enter(){if(threads[cid]){threads[cid].unread=0;save.th()}},
   html(){
    const t=threads[cid]||{msgs:[]};if(t.unread){t.unread=0;save.th()}
    return `<div class="hdr">${esc(cname(cid))}<span>${esc((cById(cid)||{}).phone||'')}</span></div>
    <div class="msgs">${t.msgs.map((m,i)=>`<div class="bub ${m.me?'me':'them'}">${esc(m.text)}<i>${fmtT(m.t)}${m.me?(i<t.msgs.length-1||!typingNow[cid]?' · Read':' · Delivered'):''}</i></div>`).join('')}${typingNow[cid]?'<div class="typing">typing…</div>':''}</div>
    <div class="inp">${s.buf?esc(s.buf):'<span class="ph">Type a message, Enter to send</span>'}<span class="caret"></span></div>`},
   mounted(bd){const m=bd.querySelector('.msgs');m.style.justifyContent='flex-start';m.scrollTop=m.scrollHeight-m.clientHeight-s.off*24;const inp=bd.querySelector('.inp');inp.scrollLeft=inp.scrollWidth},
   key(k){
    if(k==='enter'||(k==='select'&&s.buf)){if(!s.buf.trim())return true;addMsg(cid,true,s.buf.trim());s.buf='';s.off=0;blip();scheduleReply(cid)}
    else if(k==='bksp')s.buf=s.buf.slice(0,-1);
    else if(k==='up')s.off++;
    else if(k==='down')s.off=Math.max(0,s.off-1);
    else if(k==='call'){startCall(cid);return true}
    else if(ch(k))s.buf+=ch(k);
    else return false;
    draw();return true},
   prim:()=>({label:'Send',fn:()=>s.key('enter')}),
   menu(){return[{label:'Send',fn:()=>s.key('enter')},{label:'Call '+cname(cid),fn:()=>startCall(cid)},{label:'View contact',fn:()=>cById(cid)&&push(contactDetail(cid))},{label:'Clear text',fn:()=>{s.buf='';draw()}}]}};
  return s;
}

/* ---------- contacts ---------- */
function contactsScreen(){
  return listScreen({title:'Contacts',primary:()=>({label:'Add contact',fn:()=>push(contactForm())}),right:()=>contacts.length+'',filter:true,empty:'No matches. Menu adds a contact.',
   items:()=>[...contacts].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({av:1,label:c.name,sub:c.phone,fn:()=>push(contactDetail(c.id))})),
   menu:()=>[{label:'New contact',fn:()=>push(contactForm())}]});
}
function contactDetail(id){
  return listScreen({title:()=>cname(id),primary:()=>({label:'Call',fn:()=>startCall(id)}),right:()=>(cById(id)||{}).phone||'',
   items:()=>{const c=cById(id);if(!c)return[];return[
    {label:'Call',sub:c.phone,fn:()=>startCall(id)},
    {label:'Send message',fn:()=>push(threadScreen(id))},
    {label:'Edit',fn:()=>push(contactForm(c))},
    {label:'Delete contact',fn:()=>push(confirmScreen('Delete '+c.name+'?','Delete',()=>{contacts=contacts.filter(x=>x.id!==id);save.c();stack.pop();toast('Contact deleted')}))}]},
   key(k){if(k==='call'){startCall(id);return true}return false}});
}
const DIAL={w:'1',e:'2',r:'3',s:'4',d:'5',f:'6',z:'7',x:'8',c:'9',q:'#',a:'*'};
function contactForm(c){
  const s={f:0,v:[c?c.name:'',c?c.phone:''],
   html(){return `<div class="hdr">${c?'Edit contact':'New contact'}<span>Enter saves</span></div><div class="form">
     ${['Name','Phone'].map((l,i)=>`<div class="fld ${i===s.f?'on':''}" data-f="${i}"><label>${l}</label><div>${esc(s.v[i])}${i===s.f?'<span class="caret"></span>':''}</div></div>`).join('')}
     <div class="hint">Trackpad up/down switches fields. Letters type digits in the phone field (W=1 … C=9).</div></div>`},
   key(k){
    if(k==='up'||k==='down')s.f=1-s.f;
    else if(k==='bksp')s.v[s.f]=s.v[s.f].slice(0,-1);
    else if(k==='enter'||k==='select'){if(s.f===0){s.f=1}else{done();return true}}
    else if(ch(k)){let x=ch(k);if(s.f===1){x=DIAL[x.toLowerCase()]||(/[0-9+()\- ]/.test(x)?x:'');}s.v[s.f]+=x}
    else return false;
    draw();return true},
   menu(){return[{label:'Save',fn:done}]},prim:()=>({label:'Save',fn:done})};
  function done(){
    const name=s.v[0].trim(),ph=s.v[1].trim();
    if(!name){toast('Add a name first');s.f=0;return}
    if(c){c.name=name;c.phone=ph}else contacts.push({id:Math.max(0,...contacts.map(x=>x.id))+1,name,phone:ph});
    save.c();stack.pop();toast(c?'Saved':'Contact added');
  }
  return s;
}

/* ---------- phone ---------- */
function phoneScreen(){
  const s={num:'',sel:0,
   enter(){callLog.forEach(c=>c.seen=true);save.calls()},
   rows(){
    if(s.num){const digits=s.num.replace(/\D/g,'');const m=contacts.filter(c=>c.phone.replace(/\D/g,'').includes(digits)).slice(0,4);
      return[{label:'Call '+s.num,fn:()=>startCall(null,s.num)},...m.map(c=>({label:c.name,sub:c.phone,fn:()=>startCall(c.id)}))]}
    return callLog.slice(0,20).map(l=>({label:l.cid?cname(l.cid):l.num,sub:{missed:'Missed call',out:'Outgoing',in:'Incoming'}[l.type]+(l.dur?' · '+fmtDur(l.dur):''),rt:fmtWhen(l.t),gl:{missed:'↙',out:'↗',in:'↙'}[l.type],glc:l.type==='missed'?'#ff6b5e':l.type==='out'?'#4cc46a':'#5ea0ff',fn:()=>startCall(l.cid,l.num)}))},
   html(){const r=s.rows();s.sel=Math.max(0,Math.min(s.sel,r.length-1));
    return `<div class="hdr">Phone<span>${s.num?'':'Call log'}</span></div><div class="dial">${s.num?esc(s.num)+'<span class="caret"></span>':'<span class="ph">Type a number: W E R / S D F / Z X C = 1–9, then press green</span>'}</div>
    <div class="list d">${r.length?r.map((x,i)=>`<div class="row ${i===s.sel?'sel':''}" data-i="${i}">${x.gl?`<span class="gl" style="color:${x.glc}">${x.gl}</span>`:''}${x.dot?`<span class="dot" style="background:${x.dot}"></span>`:''}<div class="tx"><div>${esc(x.label)}</div>${x.sub?`<div class="s">${esc(x.sub)}</div>`:''}</div>${x.rt?`<span class="rt">${x.rt}</span>`:''}</div>`).join(''):'<div class="empty">No calls yet</div>'}</div>`},
   key(k){
    const r=s.rows();
    if(k==='up')s.sel=Math.max(0,s.sel-1);
    else if(k==='down')s.sel=Math.min(r.length-1,s.sel+1);
    else if(k==='select'||k==='enter'||k==='call'){const x=r[s.sel];if(x)x.fn();return true}
    else if(k==='bksp')s.num=s.num.slice(0,-1);
    else if(k==='back'&&s.num)s.num='';
    else if(ch(k)){const c=ch(k);const d=DIAL[c.toLowerCase()]||(/[0-9*#+]/.test(c)?c:null);if(!d)return true;s.num+=d;s.sel=0}
    else return false;
    draw();return true},
   prim:()=>s.num?{label:'Call',fn:()=>startCall(null,s.num)}:null,
   menu(){return[{label:'Contacts',fn:()=>push(contactsScreen())},{label:'Clear call log',fn:()=>{callLog=[];save.calls();draw()}}]}};
  return s;
}
const fmtDur=sec=>Math.floor(sec/60)+':'+pad2(sec%60);
function startCall(cid,num){
  const c=cid?cById(cid):null;num=num||(c&&c.phone)||'';
  if(!num){toast('No number');return}
  push(callScreen(cid,num,false));
}
function callScreen(cid,num,incoming){
  const s={noBar:true,cid:'call',t0:now(),state:incoming?'ringing':'dialing',ans:0,last:-1,
   html(){
    const name=cid?cname(cid):num;
    let st=s.state==='dialing'?'Calling…':s.state==='ringing'?'Incoming call':s.state==='ended'?'Call ended':'Connected  '+fmtDur(Math.floor((now()-s.ans)/1000));
    return `<div class="callscr"><div class="av">${esc(name.replace(/[^A-Za-z0-9]/g,'').charAt(0)||'#')}</div><div class="nm">${esc(name)}</div><div class="st">${cid?esc(num)+' · ':''}${st}</div>
    <div class="sk">${s.state==='ringing'?'<span class="g">◀ Answer (green key)</span><span class="r">Ignore (red key) ▶</span>':s.state==='ended'?'<span></span>':'<span></span><span class="r">End call (red key) ▶</span>'}</div></div>`},
   tick(){
    if(s.state==='dialing'&&now()-s.t0>2200){s.state='live';s.ans=now();tone(440,.15,.04,'sine')}
    if(s.state==='dialing'){const ph=Math.floor((now()-s.t0)/1000);if(ph!==s.last){s.last=ph;tone(425,.4,.02,'sine')}}
    if(s.state==='ringing'){const ph=Math.floor((now()-s.t0)/1200);if(ph!==s.last){s.last=ph;tone(880,.15,.05,'sine');tone(660,.15,.05,'sine',.18);draw()}if(now()-s.t0>15000){hang(true)}}
    if(s.state==='live'){const sec=Math.floor((now()-s.ans)/1000);if(sec!==s.last){s.last=sec;draw()}}},
   key(k){
    if(k==='end'||(k==='back'&&s.state!=='ringing')||(k==='select'&&s.state!=='ringing')){hang(s.state==='ringing');return true}
    if(s.state==='ringing'&&(k==='call'||k==='select'||k==='enter')){s.state='live';s.ans=now();draw();return true}
    if(s.state==='ringing'&&k==='back'){hang(true);return true}
    return true}};
  function hang(missed){
    const dur=s.state==='live'?Math.floor((now()-s.ans)/1000):0;
    callLog.unshift({cid,num,type:incoming?(dur?'in':'missed'):'out',dur,t:now(),seen:!missed||!incoming?true:false});
    if(incoming&&!dur)callLog[0].seen=false;
    save.calls();s.state='ended';draw();
    setTimeout(()=>{if(top()===s)pop()},900);
  }
  return s;
}

/* ---------- calendar ---------- */
function calendarScreen(){
  const s={d:new Date(),
   html(){
    const d=s.d,y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1),start=new Date(first);start.setDate(1-first.getDay());
    const today=dkey(new Date());let cells='';
    for(let i=0;i<42;i++){const c=new Date(start);c.setDate(start.getDate()+i);const k=dkey(c);
      cells+=`<div class="${c.getMonth()!==m?'o':''} ${k===today?'td':''} ${k===dkey(d)?'sel':''} ${events[k]&&events[k].length?'ev':''}" data-day="${k}">${c.getDate()}</div>`}
    const ev=events[dkey(d)]||[];
    return `<div class="hdr">${MONTHS[m]} ${y}<span>${DAYS[d.getDay()].slice(0,3)} ${d.getDate()}</span></div>
     <div class="cal"><div class="wk">${'SMTWTFS'.split('').map(x=>`<div>${x}</div>`).join('')}</div><div class="days">${cells}</div></div>
     <div class="evs"><b>${DAYS[d.getDay()]}, ${MONTHS[m].slice(0,3)} ${d.getDate()}</b>${ev.length?ev.map(e=>`<div>• ${esc(e)}</div>`).join(''):'<div style="color:#8a96a2">No appointments. Click the trackpad to add one.</div>'}</div>`},
   key(k){
    const mv=n=>{s.d=new Date(s.d);s.d.setDate(s.d.getDate()+n)};
    if(k==='left')mv(-1);else if(k==='right')mv(1);else if(k==='up')mv(-7);else if(k==='down')mv(7);
    else if(k==='select'||k==='enter'){add();return true}
    else if(k==='t'){s.d=new Date()}
    else return false;
    draw();return true},
   prim:()=>({label:'Add',fn:add}),
   menu(){return[{label:'New appointment',fn:add},{label:'Go to today',fn:()=>{s.d=new Date();draw()}},...((events[dkey(s.d)]||[]).length?[{label:'Clear this day',fn:()=>{delete events[dkey(s.d)];save.ev();draw()}}]:[])]}};
  function add(){const k=dkey(s.d);push(inputScreen('New appointment','',v=>{(events[k]=events[k]||[]).push(v);save.ev()},{ph:'e.g. Lunch with Priya 1pm'}))}
  return s;
}

/* ---------- memopad ---------- */
function memoScreen(){
  return listScreen({title:'MemoPad',primary:()=>({label:'New memo',fn:()=>push(inputScreen('New memo','',v=>{notes.unshift({id:now(),text:v,t:now()});save.n()},{multiline:true}))}),right:()=>notes.length+' memos',filter:true,
   items:()=>[{label:'+ New memo',fn:()=>push(inputScreen('New memo','',v=>{notes.unshift({id:now(),text:v,t:now()});save.n()},{multiline:true}))},
     ...[...notes].sort((a,b)=>b.t-a.t).map(n=>({label:n.text.split('\n')[0],sub:n.text.split('\n').slice(1).join(' ').trim(),rt:fmtWhen(n.t),fn:()=>push(inputScreen('Edit memo',n.text,v=>{n.text=v;n.t=now();save.n()},{multiline:true}))}))],
   menu:(s)=>{const sorted=[...notes].sort((a,b)=>b.t-a.t);const it=s.items()[s.sel];const n=it&&sorted.find(x=>x.text.split('\n')[0]===it.label);
     return n?[{label:'Delete memo',fn:()=>push(confirmScreen('Delete this memo?','Delete',()=>{notes=notes.filter(x=>x!==n);save.n();draw()}))}]:[]}});
}

/* ---------- clock ---------- */
function clockScreen(){
  const s={run:false,acc:0,st:0,last:'',
   el(){return s.acc+(s.run?now()-s.st:0)},
   html(){const d=new Date(),e=s.el(),sec=Math.floor(e/1000);
    return `<div class="hdr">Clock<span>Stopwatch</span></div><div class="clk"><div class="t">${fmtT(now())}<span style="font-size:18px">:${pad2(d.getSeconds())}</span></div><div class="d">${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</div>
    <div class="sw">${pad2(Math.floor(sec/60))}:${pad2(sec%60)}.${Math.floor(e%1000/100)}</div><div class="h">Click to ${s.run?'stop':'start'} · Menu to reset</div></div>`},
   tick(){const k=Math.floor(s.el()/100)+'|'+new Date().getSeconds();if(k!==s.last){s.last=k;draw()}},
   key(k){if(k==='select'||k==='enter'||k==='space'){if(s.run){s.acc+=now()-s.st;s.run=false}else{s.st=now();s.run=true}draw();return true}return false},
   prim:()=>({label:s.run?'Stop':'Start',fn:()=>s.key('select')}),
   menu(){return[{label:'Reset stopwatch',fn:()=>{s.run=false;s.acc=0;draw()}}]}};
  return s;
}

/* ---------- settings ---------- */
function settingsScreen(){
  return listScreen({title:'Settings',
   items:()=>[
    {label:'Key clicks',rt:settings.clicks?'On':'Off',fn:()=>{settings.clicks=!settings.clicks;save.s();draw()}},
    {label:'Message tone',rt:settings.tone?'On':'Off',fn:()=>{settings.tone=!settings.tone;save.s();draw()}},
    {label:'Notification light',rt:settings.led?'On':'Off',fn:()=>{settings.led=!settings.led;save.s();draw()}},
    {label:'Wallpaper',rt:WALLS[settings.wall].n,fn:()=>{settings.wall=(settings.wall+1)%WALLS.length;save.s();draw()}},
    {label:'Test notification',sub:'A friend texts you in 3 seconds',fn:()=>{toast('Go home and wait…');setTimeout(incoming,3000)}},
    {label:'High scores',sub:`Bricks ${scores.bricks} · Snake ${scores.snake} · Mines ${scores.mines?scores.mines+'s':'–'}`},
    {label:'About this phone',sub:'Quill K1 · OS 4.2 · 64 MB',fn:()=>toast('Quill K1, est. 2008')},
    {label:'Reset phone',sub:'Restore sample contacts and messages',fn:()=>push(confirmScreen('Erase all data?','Erase and restart',()=>{try{Object.keys(localStorage).filter(k=>k.startsWith('quillk1.')).forEach(k=>localStorage.removeItem(k))}catch(e){}location.reload()}))}]});
}

/* ---------- games ---------- */
const held={left:0,right:0};
function bricksScreen(){
  const W=296,H=205;
  const COLS=['#e2574c','#e8923a','#e7c64a','#5cb85c','#4a90d9'];
  const g={state:'ready',score:0,lives:3,level:1,px:124,pw:48,ctx:null};
  function build(){g.bricks=[];for(let r=0;r<5;r++)for(let c=0;c<10;c++)g.bricks.push({x:4+c*29,y:24+r*11,w:27,h:9,r,alive:1})}
  function serve(){g.state='ready';g.ball={x:g.px+g.pw/2,y:H-17,vx:0,vy:0,r:3.5}}
  function reset(){g.score=0;g.lives=3;g.level=1;g.pw=48;build();serve()}
  reset();
  const speed=()=>150+g.level*25;
  function launch(){const a=(-Math.PI/2)+(Math.random()*.8-.4);g.ball.vx=Math.cos(a)*speed();g.ball.vy=Math.sin(a)*speed();g.state='play'}
  function render(){
    const c=g.ctx;if(!c)return;
    c.fillStyle='#0d1014';c.fillRect(0,0,W,H);
    c.fillStyle='#8ea0b3';c.font='600 11px Figtree,sans-serif';c.textBaseline='top';
    c.fillText('SCORE '+g.score,6,5);c.textAlign='center';c.fillText('LEVEL '+g.level,W/2,5);c.textAlign='right';c.fillText('♥'.repeat(g.lives)+'  HI '+scores.bricks,W-6,5);c.textAlign='left';
    g.bricks.forEach(b=>{if(!b.alive)return;c.fillStyle=COLS[b.r];c.fillRect(b.x,b.y,b.w,b.h);c.fillStyle='rgba(255,255,255,.3)';c.fillRect(b.x,b.y,b.w,2)});
    c.fillStyle='#d6dde4';c.fillRect(g.px,H-12,g.pw,5);c.fillStyle='#fff';c.fillRect(g.px,H-12,g.pw,1);
    c.beginPath();c.arc(g.ball.x,g.ball.y,g.ball.r,0,7);c.fill();
    const msg={ready:'Click trackpad to launch',paused:'Paused · click to resume',over:'Game over · click to play again'}[g.state];
    if(msg){c.fillStyle='rgba(13,16,20,.8)';c.fillRect(0,H/2+10,W,22);c.fillStyle='#eef1f5';c.textAlign='center';c.font='600 13px Figtree,sans-serif';c.fillText(msg,W/2,H/2+14);c.textAlign='left'}
  }
  const s={game:true,
   html(){return `<canvas width="${W}" height="${H}"></canvas>`},
   mounted(bd){const cv=bd.querySelector('canvas');g.ctx=cv.getContext('2d');
     cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();g.px=Math.max(0,Math.min(W-g.pw,(e.clientX-r.left)/r.width*W-g.pw/2))});
     cv.addEventListener('click',e=>{e.stopPropagation();if(e.detail&&swiped())return;click();s.key('select')});render()},
   tick(dt){
    const sec=dt/1000;
    g.px=Math.max(0,Math.min(W-g.pw,g.px+(held.right-held.left)*240*sec));
    const b=g.ball;
    if(g.state==='ready'){b.x=g.px+g.pw/2;b.y=H-17}
    if(g.state==='play'){
      const steps=3;for(let i=0;i<steps;i++){
        b.x+=b.vx*sec/steps;b.y+=b.vy*sec/steps;
        if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)}if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx)}if(b.y<18+b.r){b.y=18+b.r;b.vy=Math.abs(b.vy)}
        if(b.vy>0&&b.y+b.r>=H-12&&b.y-b.r<=H-7&&b.x>=g.px-2&&b.x<=g.px+g.pw+2){const rel=(b.x-(g.px+g.pw/2))/(g.pw/2);const a=-Math.PI/2+rel*1.05;b.vx=Math.cos(a)*speed();b.vy=Math.sin(a)*speed();b.y=H-12-b.r;tone(520,.03,.03)}
        for(const br of g.bricks){if(!br.alive)continue;
          if(b.x+b.r>br.x&&b.x-b.r<br.x+br.w&&b.y+b.r>br.y&&b.y-b.r<br.y+br.h){
            br.alive=0;g.score+=(5-br.r)*10;tone(880-br.r*90,.04,.03);
            const ox=Math.min(b.x+b.r-br.x,br.x+br.w-(b.x-b.r)),oy=Math.min(b.y+b.r-br.y,br.y+br.h-(b.y-b.r));
            if(ox<oy)b.vx=-b.vx;else b.vy=-b.vy;break}}
      }
      if(!g.bricks.some(x=>x.alive)){g.level++;build();serve();chime()}
      else if(b.y>H+6){g.lives--;thud();if(g.lives<=0){g.state='over';if(g.score>scores.bricks){scores.bricks=g.score;save.sc()}}else serve()}
    }
    render()},
   key(k,src){
    if((k==='left'||k==='right')&&src==='kbd')return true;
    if(k==='left'){g.px=Math.max(0,g.px-30);return true}
    if(k==='right'){g.px=Math.min(W-g.pw,g.px+30);return true}
    if(k==='select'||k==='enter'||k==='space'){if(g.state==='ready')launch();else if(g.state==='play')g.state='paused';else if(g.state==='paused')g.state='play';else{reset()}render();return true}
    if(k==='back'||k==='menu'||k==='end'){if(g.state==='play')g.state='paused';return false}
    return true},
   menu(){return[{label:'Resume',fn:()=>{}},{label:'New game',fn:()=>{reset();render()}}]}};
  return s;
}
function snakeScreen(){
  const C=14,GW=21,GH=13,TOP=18,W=296,H=205;
  const g={ctx:null,acc:0};
  function place(){do{g.food={x:rand(GW),y:rand(GH)}}while(g.snake.some(p=>p.x===g.food.x&&p.y===g.food.y))}
  function reset(){g.snake=[{x:6,y:6},{x:5,y:6},{x:4,y:6}];g.dir={x:1,y:0};g.q=[];g.score=0;g.state='ready';place()}
  reset();
  const OX=(W-GW*C)/2;
  function step(){
    if(g.q.length)g.dir=g.q.shift();
    const h={x:g.snake[0].x+g.dir.x,y:g.snake[0].y+g.dir.y};
    if(h.x<0||h.y<0||h.x>=GW||h.y>=GH||g.snake.slice(0,-1).some(p=>p.x===h.x&&p.y===h.y)){g.state='over';thud();if(g.score>scores.snake){scores.snake=g.score;save.sc()}return}
    g.snake.unshift(h);
    if(h.x===g.food.x&&h.y===g.food.y){g.score++;place();tone(990,.05,.03)}else g.snake.pop();
  }
  function turn(d){const last=g.q.length?g.q[g.q.length-1]:g.dir;if((d.x===-last.x&&d.y===-last.y)||(d.x===last.x&&d.y===last.y))return;if(g.q.length<3)g.q.push(d);if(g.state==='ready')g.state='play'}
  function render(){
    const c=g.ctx;if(!c)return;
    c.fillStyle='#0d1014';c.fillRect(0,0,W,H);
    c.fillStyle='#8a95a3';c.font='600 11px Figtree,sans-serif';c.textBaseline='top';
    c.fillText('SCORE '+g.score,OX,4);c.textAlign='right';c.fillText('HI '+scores.snake,W-OX,4);c.textAlign='left';
    c.strokeStyle='#262d36';c.lineWidth=1;c.strokeRect(OX-.5,TOP-.5,GW*C+1,GH*C+1);
    c.fillStyle='#12161b';for(let x=0;x<GW;x++)for(let y=0;y<GH;y++)if((x+y)%2)c.fillRect(OX+x*C,TOP+y*C,C,C);
    c.fillStyle='#ff6b5e';c.beginPath();c.arc(OX+g.food.x*C+C/2,TOP+g.food.y*C+C/2,C/2-3,0,7);c.fill();
    g.snake.forEach((p,i)=>{c.fillStyle=i?'#2f7cf6':'#8fc0ff';c.fillRect(OX+p.x*C+1,TOP+p.y*C+1,C-2,C-2)});
    const msg={ready:'Swipe the trackpad to start',paused:'Paused · click to resume',over:'Game over · click to restart'}[g.state];
    if(msg){c.fillStyle='rgba(13,16,20,.85)';c.fillRect(0,H/2-11,W,22);c.fillStyle='#eef1f5';c.textAlign='center';c.font='600 13px Figtree,sans-serif';c.fillText(msg,W/2,H/2-7);c.textAlign='left'}
  }
  const D={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  return{game:true,
   html(){return `<canvas width="${W}" height="${H}"></canvas>`},
   mounted(bd){g.ctx=bd.querySelector('canvas').getContext('2d');bd.querySelector('canvas').addEventListener('click',e=>{e.stopPropagation();if(swiped())return;click();this.key('select')});render()},
   tick(dt){if(g.state==='play'){g.acc+=dt;const sp=Math.max(65,140-g.score*4);while(g.acc>=sp){g.acc-=sp;step();if(g.state!=='play')break}}render()},
   key(k){
    if(D[k]){if(g.state!=='over')turn(D[k]);return true}
    if(k==='select'||k==='enter'||k==='space'){if(g.state==='ready'||g.state==='paused')g.state='play';else if(g.state==='play')g.state='paused';else reset();render();return true}
    if(k==='back'||k==='menu'||k==='end'){if(g.state==='play')g.state='paused';return false}
    return true},
   menu(){return[{label:'Resume',fn:()=>{}},{label:'New game',fn:()=>{reset();render()}}]}};
}
function minesScreen(){
  const CW=10,CH=7,N=11;
  const g={};
  function reset(){g.cells=Array.from({length:CW*CH},()=>({m:0,o:0,f:0,n:0}));g.placed=false;g.state='play';g.t0=0;g.sel=33;g.boom=-1;g.lastSec=-1}
  const nb=i=>{const x=i%CW,y=Math.floor(i/CW),r=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<CW&&ny<CH)r.push(ny*CW+nx)}return r};
  function place(safe){const ban=new Set([safe,...nb(safe)]);let k=0;while(k<N){const i=rand(CW*CH);if(ban.has(i)||g.cells[i].m)continue;g.cells[i].m=1;k++}g.cells.forEach((c,i)=>c.n=nb(i).filter(j=>g.cells[j].m).length);g.placed=true;g.t0=now()}
  function open(i){const c=g.cells[i];if(c.o||c.f)return;c.o=1;if(!c.m&&c.n===0)nb(i).forEach(open)}
  function reveal(){
    if(g.state!=='play'){reset();return}
    if(!g.placed)place(g.sel);
    const c=g.cells[g.sel];if(c.f)return;
    if(c.o&&c.n){const fl=nb(g.sel).filter(j=>g.cells[j].f).length;if(fl===c.n){for(const j of nb(g.sel)){if(!g.cells[j].f&&g.cells[j].m){lose(j);return}open(j)}}}
    else{if(c.m){lose(g.sel);return}open(g.sel)}
    if(g.cells.every(c=>c.m||c.o)){g.state='won';g.time=Math.floor((now()-g.t0)/1000);chime();if(!scores.mines||g.time<scores.mines){scores.mines=g.time;save.sc()}}
  }
  function lose(i){g.state='lost';g.boom=i;g.time=Math.floor((now()-g.t0)/1000);g.cells.forEach(c=>{if(c.m)c.o=1});thud()}
  function flag(){const c=g.cells[g.sel];if(!c.o&&g.state==='play'){c.f=!c.f;blip()}}
  reset();
  const NC=['','#5ea0ff','#4cc46a','#ff6b5e','#b58cff','#ff9f5a','#3fd0d0','#ddd','#999'];
  return{
   get sel(){return g.sel},set sel(v){g.sel=v},
   html(){
    const flags=g.cells.filter(c=>c.f).length,t=g.state==='play'?(g.placed?Math.floor((now()-g.t0)/1000):0):g.time;
    const st=g.state==='won'?'Cleared! Click for new game':g.state==='lost'?'Boom. Click for new game':'Click digs · F flags';
    return `<div class="hdr">Mines ${N-flags}<span>${st} · ${t}s</span></div><div class="mg">${g.cells.map((c,i)=>`<div class="mc ${c.o?'op':''} ${i===g.sel?'cur':''} ${i===g.boom?'boom':''}" data-i="${i}" style="color:${NC[c.n]||'#eee'}">${c.o?(c.m?'●':(c.n||'')):(c.f?'<span style="color:#c2412f">⚑</span>':'')}</div>`).join('')}</div>`},
   prim:()=>({label:'Flag',fn:()=>{flag();draw()}}),
   tick(){if(g.state==='play'&&g.placed){const s=Math.floor((now()-g.t0)/1000);if(s!==g.lastSec){g.lastSec=s;draw()}}},
   key(k){
    const x=g.sel%CW,y=Math.floor(g.sel/CW);
    if(k==='left')g.sel=y*CW+(x+CW-1)%CW;else if(k==='right')g.sel=y*CW+(x+1)%CW;
    else if(k==='up')g.sel=((y+CH-1)%CH)*CW+x;else if(k==='down')g.sel=((y+1)%CH)*CW+x;
    else if(k==='select'||k==='enter')reveal();
    else if(k==='f'||k==='F'||k==='space')flag();
    else return false;
    draw();return true},
   menu(){return[{label:'Flag / unflag',fn:()=>{flag();draw()}},{label:'New game',fn:()=>{reset();draw()}}]}};
}

/* ---------- incoming events ---------- */
let events_fired=0;
function incoming(){
  const pool=contacts.filter(c=>top().cid!==c.id);if(!pool.length)return;
  const c=pick(pool);addMsg(c.id,false,pick(OPENERS));draw();
}
function incomingCall(){
  const t=top();if(t.cid==='call'||t.game)return;
  const c=pick(contacts);if(!c)return;push(callScreen(c.id,c.phone,true));
}
(function sched(){setTimeout(()=>{events_fired++;if(events_fired%4===3)incomingCall();else incoming();if(events_fired<10)sched()},45000+rand(40000))})();

/* ---------- input wiring ---------- */
scr.addEventListener('click',e=>{
  const m=e.target.closest('[data-m]');
  if(m&&menu){menu.sel=+m.dataset.m;dispatch('select');return}
  if(menu){click();menu=null;draw();return}
  const a=e.target.closest('[data-act]');
  if(a){const act=a.dataset.act;if(act==='primary'){click();const p=top().prim&&top().prim();p&&p.fn()}else if(act==='compose'){click();push(pickContact('Compose to',cid=>{stack.pop();push(threadScreen(cid))}))}else dispatch(act);return}
  const s=top();
  const day=e.target.closest('[data-day]');
  if(day&&s.d){const [y,mo,d]=day.dataset.day.split('-').map(Number);const nd=new Date(y,mo-1,d);if(dkey(nd)===dkey(s.d)){dispatch('select')}else{click();s.d=nd;draw()}return}
  const f=e.target.closest('[data-f]');
  if(f&&s.f!==undefined){click();s.f=+f.dataset.f;draw();return}
  const it=e.target.closest('[data-i]');
  if(it&&'sel' in s){s.sel=+it.dataset.i;dispatch('select');return}
});

const ROWS=[['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l','bksp'],['shift','z','x','c','v','b','n','m','.','enter'],['alt','0','space',',','?','@']];
const ALT={q:'#',w:'1',e:'2',r:'3',t:'(',y:')',u:'_',i:'-',o:'+',p:'@',a:'*',s:'4',d:'5',f:'6',g:'/',h:':',j:';',k:"'",l:'"',z:'7',x:'8',c:'9',v:'?',b:'!',n:',',m:'.','.':'$'};
const LBL={bksp:'⌫',enter:'↵',shift:'⇧',alt:'alt',space:'',};
const kb=document.getElementById('kb');
kb.innerHTML=ROWS.map(r=>`<div class="kr">${r.map(k=>`<button class="k ${k==='space'?'sp':''} ${['bksp','enter','shift','alt'].includes(k)?'fn':''}" data-k="${k}" aria-label="${k}">${ALT[k]?`<small>${esc(ALT[k])}</small>`:''}${esc(LBL[k]!==undefined?LBL[k]:k.toUpperCase())}</button>`).join('')}</div>`).join('');
let shiftOn=false,altOn=false;
function updMods(){kb.querySelector('[data-k=shift]').classList.toggle('mod-on',shiftOn);kb.querySelector('[data-k=alt]').classList.toggle('mod-on',altOn)}
function vkey(k){
  if(k==='shift'){shiftOn=!shiftOn;altOn=false;click();updMods();return}
  if(k==='alt'){altOn=!altOn;shiftOn=false;click();updMods();return}
  if(k.length===1){let c=k;if(altOn){c=ALT[k]||k;altOn=false}else if(shiftOn){c=k.toUpperCase();shiftOn=false}updMods();dispatch(c);return}
  dispatch(k);
}
document.querySelectorAll('[data-k]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{e.preventDefault()});
  b.addEventListener('click',()=>{const k=b.dataset.k;if(b.closest('#kb'))vkey(k);else dispatch(k)});
});
// trackpad
let sw=null,lastSwipe=0;const swiped=()=>now()-lastSwipe<300;
scr.addEventListener('pointerdown',e=>{if(top().game)sw={x:e.clientX,y:e.clientY}});
scr.addEventListener('pointerup',e=>{if(!sw)return;const dx=e.clientX-sw.x,dy=e.clientY-sw.y;sw=null;if(Math.max(Math.abs(dx),Math.abs(dy))>24&&top().game){lastSwipe=now();dispatch(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'),'swipe')}});
const pad=document.getElementById('pad');let ps=null,moved=false;if(pad){
pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);ps={x:e.clientX,y:e.clientY};moved=false;pad.classList.add('press')});
pad.addEventListener('pointermove',e=>{if(!ps)return;const dx=e.clientX-ps.x,dy=e.clientY-ps.y;if(Math.max(Math.abs(dx),Math.abs(dy))>12){moved=true;dispatch(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));ps={x:e.clientX,y:e.clientY}}});
const endPad=()=>{if(ps&&!moved)dispatch('select');ps=null;pad.classList.remove('press')};
pad.addEventListener('pointerup',endPad);pad.addEventListener('pointercancel',()=>{ps=null;pad.classList.remove('press')});
pad.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();dispatch('select')}});
pad.addEventListener('click',e=>e.preventDefault());}

const KMAP={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',Enter:'enter',Escape:'back',Backspace:'bksp',Tab:'menu',Home:'end',' ':'space'};
function flash(k){const b=document.querySelector(`[data-k="${CSS.escape(k)}"]`)||null;if(b){b.classList.add('press');setTimeout(()=>b.classList.remove('press'),110)}}
document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.target.closest&&e.target.closest('button')&&(e.key==='Enter'||e.key===' ')&&e.target!==document.body)return;
  let k=KMAP[e.key];if(!k&&e.key.length===1)k=e.key;if(!k)return;
  e.preventDefault();
  if(e.key==='ArrowLeft')held.left=1;if(e.key==='ArrowRight')held.right=1;
  flash(k.length===1?k.toLowerCase():k);dispatch(k,'kbd');
});
document.addEventListener('keyup',e=>{if(e.key==='ArrowLeft')held.left=0;if(e.key==='ArrowRight')held.right=0});

/* ---------- loop ---------- */
let last=performance.now();
function loop(t){const dt=Math.min(50,t-last);last=t;const s=top();if(!menu&&s&&s.tick)s.tick(dt);requestAnimationFrame(loop)}
requestAnimationFrame(loop);
setInterval(()=>{const s=top();if(s.live&&!menu)draw();else{const el=document.getElementById('sbt');if(el)el.textContent=fmtT(now())}},1000);

function fit(){const w=document.documentElement.clientWidth-32;phoneEl.style.zoom=w<340?Math.max(.7,w/340):1}
addEventListener('resize',fit);fit();

stack=[homeScreen()];draw();
})();
