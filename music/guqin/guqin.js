const byId = id => document.getElementById(id);
const bridge = 750;
const scale = bridge - 92;
const hui = [1/8, 1/6, 1/5, 1/4, 1/3, 2/5, 1/2, 3/5, 2/3, 3/4, 4/5, 5/6, 7/8];
const stringY = n => 49 + (n - 1) * 15;

function shape(parent, tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  parent.append(el);
  return el;
}

hui.forEach((fraction, i) => {
  shape(byId('markers'), 'circle', {cx: bridge - scale * fraction, cy:34, r:i === 6 ? 3.9 : 3, fill:'#ded4ae'});
});
for (let n = 1; n <= 7; n++) {
  shape(byId('wires'), 'line', {x1:92, x2:bridge, y1:stringY(n), y2:stringY(n), stroke:'#cfbd9e', 'stroke-width':2.6 - n * 0.19});
}

const audio = new Audio();
const volume = byId('volume');
audio.volume = Number(volume.value);
volume.oninput = () => { audio.volume = Number(volume.value); };
let frame;
let request = 0;
const normal = 'The first two signs specify the plucks. The next two call for a short rest and three repetitions of the pair.';

function show(which) {
  const stopped = which === 2;
  const y = stringY(stopped ? 4 : 7);
  const indicator = byId('indicator');
  indicator.replaceChildren();
  const end = stopped ? bridge - scale * hui[8] : 92;
  shape(indicator, 'line', {x1:end, x2:bridge, y1:y, y2:y, stroke:'#f7dc86', 'stroke-width':3});
  shape(indicator, 'circle', {cx:704, cy:y, r:7, fill:'#1c2b26', stroke:'#f7dc86', 'stroke-width':3});
  if (stopped) {
    shape(indicator,'line',{x1:end,x2:end,y1:39,y2:y,stroke:'#b7decb','stroke-dasharray':'3 3'});
    shape(indicator,'circle',{cx:end,cy:y,r:7,fill:'#b7decb'});
  }
  byId('status').textContent = stopped ? '2 · Press string four at hui nine with the left thumb. Hook the string inward with the right middle finger.' : '1 · Leave string seven open. Pluck outward with the right index finger.';

}

function stop() {
  request++;
  audio.pause();
  cancelAnimationFrame(frame);
  byId('sequence').textContent = 'Play opening';
  byId('indicator').replaceChildren();
  byId('status').textContent = normal;
}

const opening = [[0,1],[0.65,2],[1.22,0],[2,1],[2.5,2],[3,1],[3.5,2],[4,1],[4.5,2]];
async function play(gesture) {
  const toggle = !gesture && byId('sequence').textContent === 'Stop';
  stop();
  if (toggle) return;
  const pending = request;
  audio.src = ['opening.wav','seventh.wav','damped.wav'][gesture];
  if (!gesture) byId('sequence').textContent = 'Stop';
  try {
    await audio.play();
  } catch {
    if (pending === request) {
      stop();
      byId('status').textContent = 'Audio playback is unavailable.';
    }
    return;
  }
  if (pending !== request) return;
  if (gesture) { show(gesture); return; }
  let index = -1;
  function sync() {
    while (index+1 < opening.length && opening[index+1][0] <= audio.currentTime) {
      const sign = opening[++index][1];
      if (sign) show(sign);
      else {
        byId('status').textContent = 'Short rest.';
        byId('indicator').replaceChildren();
      }
    }
    frame = requestAnimationFrame(sync);
  }
  sync();
}
audio.addEventListener('ended',stop);

byId('sequence').addEventListener('click', () => play(0));
byId('first').addEventListener('click', () => play(1));
byId('second').addEventListener('click', () => play(2));
window.addEventListener('pagehide', stop);

const folios = [...document.querySelectorAll('details')];
let initialOpen;
byId('filter').addEventListener('input', event => {
  const query = event.target.value.toLowerCase().trim();
  if (!initialOpen && query) initialOpen = folios.map(f => f.open);
  let matches = 0;
  folios.forEach((folio, index) => {
    let group = 0;
    for (const entry of folio.querySelectorAll('li')) {
      entry.hidden = !entry.textContent.toLowerCase().includes(query);
      if (!entry.hidden) group++;
    }
    matches += group;
    folio.hidden = group === 0;
    if (query) folio.open = true;
    else if (initialOpen) folio.open = initialOpen[index];
  });
  if (!query) initialOpen = null;
  byId('count').textContent = query ? ' · ' + matches + (matches === 1 ? ' title' : ' titles') : '';
});
