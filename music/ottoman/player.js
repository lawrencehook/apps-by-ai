const $ = id => document.getElementById(id);
const svg = document.querySelector('svg');
const clock = s => Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const fold = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ı','i');
const defaultWork = scores.find(w => w.id.startsWith('huseyni--') && w.composer==='Tatyos Efendi');
let work, starts, ends, low, high, duration, cursor, page, position = 0;
let context, bus, timer, frame, origin, next, playbackRate, pending = 0, playing = false;
const rate = () => Number($('speed').value);
const total = w => w.notes.reduce((sum,n) => sum+n[1],0)/1000;
const cards = scores.map(w => {
  const row = document.createElement('li'), link = document.createElement('a');
  const label = document.createElement('div'), title = document.createElement('strong');
  const author = document.createElement('small'), length = document.createElement('time');
  title.textContent = w.makam;
  author.textContent = w.composer;
  length.textContent = clock(total(w));
  link.href = '#'+w.id;
  link.addEventListener('click',()=> $('player').scrollIntoView());
  label.append(title,author); link.append(label,length); row.append(link); $('list').append(row);
  return {row,link,w,text:fold([w.makam,w.composer,w.title].join(' '))};
});
$('find').oninput = () => {
  const query = fold($('find').value.trim());
  for (const card of cards) card.row.hidden = !card.text.includes(query);
  $('empty').hidden = cards.some(card => !card.row.hidden);
};
function shape(tag, attrs, text) {
  const el = document.createElementNS(svg.namespaceURI,tag);
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,v);
  if (text) el.textContent=text;
  svg.append(el);
  return el;
}
// Index of the first endpoint strictly later than the requested position.
function after(array, value) {
  let a=0, b=array.length;
  while(a<b) {
    const m=(a+b)>>>1;
    if(array[m]<=value) a=m+1; else b=m;
  }
  return a;
}
function draw(first) {
  page=first;
  svg.replaceChildren();
  const count=Math.ceil(ends.at(-1));
  for(let cycle=first;cycle<Math.min(first+4,count);cycle++) {
    const y=(cycle-first)*74+5;
    const index=Math.min(after(ends,cycle),ends.length-1);
    const meter=work.meters.filter(m=>m[0]<=index).at(-1);
    const beats=meter[1];
    shape('text',{x:3,y:y+40,fill:'#bdc7b9','font-size':14},String(cycle+1));
    for(let beat=0;beat<=beats;beat++) {
      const x=38+beat*612/beats;
      shape('line',{x1:x,x2:x,y1:y,y2:y+69,stroke:beat===0||beat===beats?'#738078':'#33403c'});
    }
    for(let i=index;i<ends.length && (ends[i-1]||0)<cycle+1;i++){
      const pitch=work.notes[i][0];
      if(pitch<=0) continue;
      const x=38+612*(Math.max(cycle,ends[i-1]||0)-cycle);
      const right=38+612*(Math.min(cycle+1,ends[i])-cycle);
      const height=y+7+(high-pitch)*54/(high-low||1);
      shape('line',{x1:x,x2:Math.max(x+.4,right-1),y1:height,y2:height,stroke:'#e4c988','stroke-width':3});
    }
  }
  cursor=shape('line',{stroke:'#fff8dc','stroke-width':2});
}
function display() {
  const i=Math.min(work.notes.length-1,after(starts,position)-1);
  const prev=ends[i-1]||0;
  const cycle=Math.min(ends.at(-1)-.000001,prev+(ends[i]-prev)*(position-starts[i])/(work.notes[i][1]/1000));
  const first=Math.floor(cycle/4)*4;
  if(first!==page) draw(first);
  const y=(Math.floor(cycle)-first)*74+5, x=38+612*(cycle%1);
  for(const [k,v] of Object.entries({x1:x,x2:x,y1:y,y2:y+69})) cursor.setAttribute(k,v);
  const meter=work.meters.filter(m=>m[0]<=i).at(-1);
  $('caption').textContent='Cycles '+(first+1)+'–'+Math.min(first+4,Math.ceil(ends.at(-1)))+' · '+meter[3]+' ('+meter[1]+'/'+meter[2]+')';
  $('section').value=String(work.sections.filter(s=>s[0]<=i).at(-1)?.[0]||0);
  $('seek').value=position;
  $('time').textContent=clock(position)+' / '+clock(duration);
}
function pause() {
  pending++;
  if(playing) position=Math.max(0,Math.min(duration,(context.currentTime-origin)*playbackRate));
  playing=false;
  clearInterval(timer);cancelAnimationFrame(frame);
  if(bus) {
    const old=bus;
    old.gain.setTargetAtTime(0,context.currentTime,.008);
    setTimeout(()=>old.disconnect(),60);
    bus=null;
  }
  $('play').textContent='Play';
}
function pluck(pitch,start,length) {
  const osc=context.createOscillator(), gain=context.createGain();
  osc.type='triangle'; osc.frequency.value=440*2**((pitch-305)/53);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(.16,start+Math.min(.009,length/3));
  gain.gain.exponentialRampToValueAtTime(.035,start+length);
  gain.gain.exponentialRampToValueAtTime(.0001,start+length+.05);
  osc.connect(gain).connect(bus);osc.start(start);osc.stop(start+length+.055);
}
async function start() {
  const token=++pending;
  $('play').textContent='Pause';
  try {
    context ||= new AudioContext();
    await context.resume();
    if(token!==pending) return;
    if(position>=duration-.001) position=0;
    playing=true;bus=context.createGain();bus.connect(context.destination);
    const speed=rate();
    playbackRate=speed;
    origin=context.currentTime+.025-position/speed;
    next=Math.max(0,after(starts,position)-1);
    function schedule() {
      const now=context.currentTime;
      while(next<starts.length && origin+starts[next]/speed<now+.20) {
        const [pitch,ms]=work.notes[next];
        const onset=origin+starts[next++]/speed;
        const begin=Math.max(now,onset), length=onset+ms/1000/speed-begin;
        if(pitch>0 && length>.001) pluck(pitch,begin,length);
      }
    }
    function tick() {
      position=Math.min(duration,Math.max(0,(context.currentTime-origin)*speed));
      display();
      if(position>=duration) {pause();return;}
      frame=requestAnimationFrame(tick);
    }
    schedule();timer=setInterval(schedule,65);tick();
  }catch {pause();$('error').textContent='Audio playback is unavailable in this browser.';}
}
function seek(to) {
  const resume=$('play').textContent==='Pause';
  pause();position=to;display();
  if(resume) start();
}
function load(w) {
  pause();work=w;page=-1;position=0;duration=0;
  starts=[];ends=[];low=Infinity;high=-Infinity;
  for(const [pitch,ms,end] of w.notes) {
    starts.push(duration);ends.push(end/100000);duration+=ms/1000;
    if(pitch>0){low=Math.min(low,pitch);high=Math.max(high,pitch);}
  }
  $('work').textContent=w.title;$('composer').textContent=w.composer;
  $('source').href='https://github.com/MTG/SymbTr/blob/246bbe362ef17cf9d200b5296e06473f29768be3/txt/'+w.id+'.txt';
  $('pdf').href='notation/'+w.id+'.pdf';
  $('seek').max=duration;$('error').textContent='';
  $('section').replaceChildren();
  if(w.sections[0]?.[0]!==0) $('section').add(new Option('Opening',0));
  for(const [index,name] of w.sections) $('section').add(new Option(name+' · '+clock(starts[index]),index));
  for(const card of cards) {
    if(card.w===w) card.link.setAttribute('aria-current','true');else card.link.removeAttribute('aria-current');
  }
  display();
}
$('play').onclick=()=>{if($('play').textContent==='Pause'){pause();display();}else start();};
$('seek').oninput=()=>seek(Number($('seek').value));
$('section').onchange=()=>seek(starts[Number($('section').value)]);
$('speed').onchange=()=>{if(playing){pause();start();}};
window.addEventListener('pagehide',pause);
function route() {
  const w=scores.find(s=>s.id===location.hash.slice(1));
  if(w && w!==work) load(w);
  else if(!work) load(defaultWork);
}
window.addEventListener('hashchange',route);route();
