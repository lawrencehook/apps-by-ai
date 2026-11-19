// [Cell within the column, relative pentatonic step]. Blank cells sustain.
const columns = [
    [[0,-1],[3,1],[5,1],[8,2],[11,1],[13,0]],
    [[0,1],[5,0],[8,1],[13,1]],
    [[0,0],[3,1],[5,2],[7,1],[8,0],[11,1],[13,0],[14,-1]],
    [[0,-1],[5,-2],[8,-1],[13,-1]],
    [[0,-1],[3,0],[5,0],[8,2],[11,1],[13,0],[14,-1]],
    [[0,-2],[5,-2],[8,-2],[13,-2]],
    [[0,-1],[3,0],[5,-2],[8,-1],[11,-2],[13,-3]]
];
const pitches = {
    '-3': ['下三', 'Three steps below', 60],
    '-2': ['下二', 'Two steps below', 62],
    '-1': ['下一', 'One step below', 64],
    0: ['宮', 'Central pitch', 67],
    1: ['上一', 'One step above', 69],
    2: ['上二', 'Two steps above', 72]
};
const notes = columns.flatMap((column, index) =>
    column.map(([cell, step]) => ({cell: index * 16 + cell, step}))
);
const cellCount = columns.length * 16;
const rightEdges = [50,81,111,143,172,202,232,261,291,321,352,383,414,445,475,505,536];
const leftEdges = [64,94,123,153,182,212,240,269,298,328,357,386,415,445,475,505,536];
const cellSeconds = 0.37;
const play = document.querySelector('#play');
const slider = document.querySelector('#position');
const cursor = document.querySelector('#cursor');
let audio, bus, frame, origin;
let position = 0;
let playing = false;
function display() {
    const cell = Math.min(cellCount - 1, Math.floor(position));
    const column = Math.floor(cell / 16);
    const row = cell % 16;
    const note = notes.filter(n => n.cell <= cell).pop();
    const [mark, name] = pitches[note.step];
    const edges = column < 3 ? rightEdges : leftEdges;
    cursor.ownerSVGElement.setAttribute('viewBox', column < 3 ? '405 36 378 514' : '23 36 378 514');
    cursor.setAttribute('x', [648,559,470,350,265,180,96][column]);
    cursor.setAttribute('y', edges[row]);
    cursor.setAttribute('height', edges[row+1] - edges[row]);
    slider.value = cell;
    document.querySelector('#readout').textContent = 'Column ' + (column+1) + ' of 7 · Cell ' + (row+1) + ' of 16';
    document.querySelector('#pitch').textContent = mark + ' · ' + name;
    slider.setAttribute('aria-valuetext', 'Column ' + (column+1) + ', cell ' + (row+1));
}
function pause() {
    if (!playing) return;
    position = Math.min(cellCount, Math.max(0, (audio.currentTime - origin) / cellSeconds));
    playing = false;
    cancelAnimationFrame(frame);
    bus.gain.setTargetAtTime(0, audio.currentTime, 0.006);
    const previousBus = bus;
    setTimeout(() => previousBus.disconnect(), 60);
    play.textContent = 'Play';
    display();
}
function start() {
    if (position >= cellCount) position = 0;
    playing = true;
    play.textContent = 'Pause';
    const now = audio.currentTime;
    origin = now - position * cellSeconds;
    bus = audio.createGain();
    bus.connect(audio.destination);
    notes.forEach((note, index) => {
        const endCell = notes[index+1]?.cell ?? cellCount;
        if (endCell <= position) return;
        const startTime = Math.max(now, origin + note.cell * cellSeconds);
        const endTime = origin + endCell * cellSeconds;
        const oscillator = audio.createOscillator();
        const envelope = audio.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 * 2 ** ((pitches[note.step][2]-69)/12);
        envelope.gain.setValueAtTime(0, startTime);
        envelope.gain.linearRampToValueAtTime(0.16, Math.min(startTime+0.035, (startTime+endTime)/2));
        envelope.gain.exponentialRampToValueAtTime(0.09, Math.max((startTime+endTime)/2, endTime-0.05));
        envelope.gain.linearRampToValueAtTime(0, endTime);
        oscillator.connect(envelope).connect(bus);
        oscillator.start(startTime);
        oscillator.stop(endTime);
    });
    function tick() {
        position = (audio.currentTime - origin) / cellSeconds;
        if (position >= cellCount) return pause();
        display();
        frame = requestAnimationFrame(tick);
    }
    tick();
}
play.addEventListener('click', async () => {
    if (playing) return pause();
    try {
        audio ??= new AudioContext();
        await audio.resume();
        if (!playing && !document.querySelector('#manuscript').hidden) start();
    } catch {
        document.querySelector('#error').textContent = 'Audio playback is unavailable in this browser.';
    }
});
function seek(cell) {
    const resume = playing;
    pause();
    position = cell;
    if (resume) start();
    else display();
}
slider.addEventListener('input', () => seek(Number(slider.value)));
document.querySelector('#restart').addEventListener('click', () => seek(0));
window.addEventListener('pagehide', pause);
display();
