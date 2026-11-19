// [Cell within the column, relative pentatonic step]. Blank cells sustain.
const columns = [
    [[0,-1],[3,1],[5,1],[8,2],[11,1],[13,0]],
    [[0,1],[5,0],[8,1],[13,1]],
    [[0,0],[3,1],[5,2],[7,1],[8,0],[11,1],[13,0],[14,-1]]
];
const pitches = {
    '-1': ['下一', 'One step below', 64],
    0: ['宮', 'Central pitch', 67],
    1: ['上一', 'One step above', 69],
    2: ['上二', 'Two steps above', 72]
};
const notes = columns.flatMap((column, index) =>
    column.map(([cell, step]) => ({cell: index * 16 + cell, step}))
);
const edges = [50,81,111,143,172,202,232,261,291,321,352,383,414,445,475,505,536];
const cellSeconds = 0.37;
const play = document.querySelector('#play');
const slider = document.querySelector('#position');
const cursor = document.querySelector('#cursor');
let audio, bus, frame, origin;
let position = 0;
let playing = false;
function display() {
    const cell = Math.min(47, Math.floor(position));
    const column = Math.floor(cell / 16);
    const row = cell % 16;
    const note = notes.filter(n => n.cell <= cell).pop();
    const [mark, name] = pitches[note.step];
    cursor.setAttribute('x', [648,559,470][column]);
    cursor.setAttribute('y', edges[row]);
    cursor.setAttribute('height', edges[row+1] - edges[row]);
    slider.value = cell;
    document.querySelector('#readout').textContent = 'Column ' + (column+1) + ' of 3 · Cell ' + (row+1) + ' of 16';
    document.querySelector('#pitch').textContent = mark + ' · ' + name;
    slider.setAttribute('aria-valuetext', 'Column ' + (column+1) + ', cell ' + (row+1));
}
function pause() {
    if (!playing) return;
    position = Math.min(48, Math.max(0, (audio.currentTime - origin) / cellSeconds));
    playing = false;
    cancelAnimationFrame(frame);
    bus.gain.setTargetAtTime(0, audio.currentTime, 0.006);
    const previousBus = bus;
    setTimeout(() => previousBus.disconnect(), 60);
    play.textContent = 'Play';
    display();
}
function start() {
    if (position >= 48) position = 0;
    playing = true;
    play.textContent = 'Pause';
    const now = audio.currentTime;
    origin = now - position * cellSeconds;
    bus = audio.createGain();
    bus.connect(audio.destination);
    notes.forEach((note, index) => {
        const endCell = notes[index+1]?.cell ?? 48;
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
        if (position >= 48) return pause();
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
        if (!playing) start();
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
