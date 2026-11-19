(() => {
  const get = id => document.getElementById(id);
  const recording = get('recording');
  let selected, chapters, firstCycle, visibleChapter, highlighted, frame;

  function draw(chapterIndex, first) {
    visibleChapter = chapterIndex;
    firstCycle = first;
    const ch = chapters[chapterIndex], grid = get('notation');
    grid.replaceChildren();
    const groups = new Set([0]);
    let end = 0;
    for (const group of ch.measure) { end += group; groups.add(end); }
    for (let cycle=first; cycle < first+4; cycle++) {
      if (cycle*ch.length-ch.padding >= ch.cells.length) break;
      const column = document.createElement('div');
      column.className = 'cycle';
      const number = document.createElement('small');
      number.textContent = cycle+1;
      column.append(number);
      for (let row=0; row<ch.length; row++) {
        const index=cycle*ch.length+row-ch.padding;
        if (index>=ch.cells.length) break;
        if (index<0) {
          const gap=document.createElement('button');
          gap.className='beat';gap.style.visibility='hidden';gap.disabled=true;
          column.append(gap);continue;
        }
        const cell=document.createElement('button');
        const rows=ch.cells[index].split('\n');
        cell.className='beat'+(groups.has(row)?' group':'')+(rows.length>1 || ch.cells[index].includes(' ')?' dense':'');
        cell.dataset.index=index;
        cell.setAttribute('aria-label','Cycle '+(cycle+1)+', cell '+(row+1)+', '+ch.cells[index]);
        for (const line of rows) {
          const subdivision=document.createElement('span');
          for (const token of line.split(' ')) {
            const sign=document.createElement('i');
            sign.textContent=token.replace(':','');
            subdivision.append(sign);
          }
          cell.append(subdivision);
        }
        cell.onclick=()=>{recording.currentTime=ch.start+index*ch.beat;refresh();recording.play().catch(()=>{get('editionStatus').textContent='Use the audio controls to start playback.';});};
        column.append(cell);
      }
      grid.append(column);
    }
  }
  function refresh() {
    if (!selected) return;
    const t=recording.currentTime;
    const part=Math.max(0,chapters.findLastIndex(ch=>ch.start<=t+.00001));
    const ch=chapters[part];
    const index=Math.min(ch.cells.length-1,Math.max(0,Math.floor((t-ch.start+.00001)/ch.beat)));
    const cycle=Math.floor((index+ch.padding)/ch.length);
    const first=4*Math.floor(cycle/4);
    if (visibleChapter!==part || firstCycle!==first) draw(part,first);
    const cell=get('notation').querySelector('[data-index="'+index+'"]');
    if (cell!==highlighted) {
      highlighted?.classList.remove('active');cell?.classList.add('active');highlighted=cell;
      get('location').textContent='Cycle '+(cycle+1)+' · Cell '+((index+ch.padding)%ch.length+1)+' of '+ch.length;
    }
    get('chapter').value=part;
  }
  function select() {
    const work=editions.find(w=>w.id===location.hash.slice(1));
    pause();recording.pause();
    selected=work;
    get('selection').value=work?.id || 'cheongsan';
    get('manuscript').hidden=!!work;get('chamber').hidden=!work;
    if (!work) return;
    recording.src='editions/'+work.id+'.m4a';
    recording.load();
    get('editionStatus').textContent='';
    get('editionTitle').textContent=work.title;
    get('original').href='editions/'+work.file;
    let time=0;
    chapters=work.chapters.map(ch=>{
      const start=time, beat=60/ch.tempo;
      time+=beat*ch.cells.length;
      return {...ch,start,beat,length:ch.measure.reduce((a,b)=>a+b,0)};
    });
    get('editionMeta').textContent=work.korean+' · '+Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');
    get('chapter').replaceChildren(...chapters.map((ch,i)=>new Option((i+1)+' · '+(ch.name||'Continuation'),i)));
    firstCycle=visibleChapter=-1;highlighted=null;
    refresh();
  }
  get('selection').onchange=e=>{location.hash=e.target.value;};
  get('chapter').onchange=e=>{recording.currentTime=chapters[Number(e.target.value)].start;refresh();};
  for (const event of ['loadedmetadata','seeked','timeupdate','ended']) recording.addEventListener(event,refresh);
  function sync(){refresh();if(!recording.paused)frame=requestAnimationFrame(sync);}
  recording.onplay=()=>{cancelAnimationFrame(frame);sync();};
  recording.onpause=()=>cancelAnimationFrame(frame);
  window.addEventListener('hashchange',select);
  window.addEventListener('pagehide',()=>recording.pause());
  select();
})();
