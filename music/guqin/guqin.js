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

let audio;
let timers = [];
let run = 0;
let playing = false;
let voices = new Set();
const normal = 'The first two signs specify the plucks. The next two call for a short rest and three repetitions of the pair.';

function pluck(stopped) {
  // A short, filtered noise burst recirculates in a delay line tuned to D3.
  const pitch = 146.832;
  const delay = audio.createDelay();
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = stopped ? 2300 : 3700;
  filter.Q.value = 0.4;
  delay.delayTime.value = 1 / pitch - 0.0001;
  const feedback = audio.createGain();
  feedback.gain.value = stopped ? 0.974 : 0.983;
  const output = audio.createGain();
  output.gain.value = 0.45;
  delay.connect(filter).connect(feedback).connect(delay);
  filter.connect(output).connect(audio.destination);
  const size = Math.ceil(audio.sampleRate / pitch);
  const buf = audio.createBuffer(1, size, audio.sampleRate);
  const samples = buf.getChannelData(0);
  for (let i = 0; i < size; i++) samples[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / size);
  const burst = audio.createBufferSource();
  burst.buffer = buf;
  burst.connect(delay);
  burst.start();
  const nodes = [burst, delay, filter, feedback, output];
  const release = () => {
    nodes.forEach(n => n.disconnect());
    voices.delete(release);
  };
  voices.add(release);
  setTimeout(release, 2300);
}

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
  pluck(stopped);
}

function stop() {
  run++;
  playing = false;
  timers.forEach(clearTimeout);
  timers = [];
  voices.forEach(release => release());
  byId('sequence').textContent = 'Play opening';
  byId('indicator').replaceChildren();
  byId('status').textContent = normal;
}

async function play(sequence) {
  const wasPlaying = playing;
  stop();
  if (!sequence && wasPlaying) return;
  const current = run;
  try {
    audio ??= new AudioContext();
    await audio.resume();
  } catch {
    byId('status').textContent = 'Audio is unavailable in this browser.';
    return;
  }
  if (current !== run) return;
  if (sequence) {
    show(sequence);
    return;
  }
  playing = true;
  byId('sequence').textContent = 'Stop';
  const beats = [0, 650, 2000, 2500, 3000, 3500, 4000, 4500];
  beats.forEach((ms, i) => timers.push(setTimeout(() => show(1 + i % 2), ms)));
  timers.push(setTimeout(() => {
    byId('status').textContent = 'Short rest.';
    byId('indicator').replaceChildren();
  }, 1220));
  timers.push(setTimeout(stop, 6200));
}

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
