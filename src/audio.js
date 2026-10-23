// Settings (saved per device), sound effects and two chiptune music tracks, all made with Web Audio.
const KEY = 'farmlife.settings';
export const DAY_SPEEDS = [{ label: 'Relaxed', ms: 10000 }, { label: 'Normal', ms: 7000 }, { label: 'Fast', ms: 5000 }];
export const settings = { music: 5, sfx: 7, speed: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY))); } catch {}
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  if (ctx) volumes();
}

let ctx, musicBus, sfxBus;
function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(ctx.destination); sfxBus.connect(ctx.destination);
    volumes();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function volumes() { musicBus.gain.value = (settings.music / 10) ** 2 * 0.5; sfxBus.gain.value = (settings.sfx / 10) ** 2 * 0.6; }

const hz = n => 440 * 2 ** ((n - 69) / 12);
function note(bus, type, n, at, len, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = hz(n);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  o.connect(g).connect(bus); o.start(at); o.stop(at + len + 0.02);
}

// Short blips: each is a list of [midi note, seconds].
const SFX = {
  click: [[84, 0.05]], plant: [[64, 0.07], [71, 0.09]], water: [[76, 0.05], [79, 0.05], [83, 0.08]],
  harvest: [[72, 0.06], [76, 0.06], [79, 0.06], [84, 0.12]], coin: [[88, 0.05], [93, 0.12]], dig: [[48, 0.08], [45, 0.1]],
  nope: [[52, 0.08], [48, 0.12]], sleep: [[72, 0.2], [67, 0.2], [64, 0.2], [60, 0.4]],
};
export function sfx(name) {
  if (!settings.sfx || !ensure()) return;
  let t = ctx.currentTime;
  for (const [n, len] of SFX[name]) { note(sfxBus, 'square', n, t, len, 0.25); t += len * 0.8; }
}

// Tracks: 32 eighth-note steps; melody/bass are midi notes, 0 = rest.
const TRACKS = [
  { name: 'Morning Meadow', bpm: 100,
    melody: [72, 0, 76, 0, 79, 0, 76, 74, 72, 0, 74, 76, 74, 0, 0, 0, 71, 0, 74, 0, 77, 0, 76, 74, 72, 0, 71, 72, 67, 0, 0, 0],
    bass: [48, 0, 55, 0, 52, 0, 55, 0, 53, 0, 57, 0, 55, 0, 59, 0, 50, 0, 57, 0, 53, 0, 57, 0, 48, 0, 55, 0, 43, 0, 47, 0] },
  { name: 'Sunny Rows', bpm: 116,
    melody: [79, 81, 83, 0, 86, 0, 83, 0, 81, 79, 81, 0, 76, 0, 0, 0, 79, 81, 83, 0, 86, 0, 88, 86, 83, 0, 81, 0, 79, 0, 0, 0],
    bass: [43, 0, 50, 0, 47, 0, 50, 0, 48, 0, 52, 0, 45, 0, 52, 0, 43, 0, 50, 0, 47, 0, 50, 0, 50, 0, 54, 0, 43, 0, 50, 0] },
];
// Songs that only play for a reason (not picked at random): the wandering minstrel's.
const SONGS = {
  minstrel: { name: "The Minstrel's Song", bpm: 132,
    melody: [76, 0, 76, 79, 81, 0, 79, 76, 74, 0, 72, 74, 76, 0, 0, 0, 77, 0, 77, 76, 74, 0, 72, 74, 76, 79, 76, 74, 72, 0, 0, 0],
    bass: [48, 55, 52, 55, 45, 52, 48, 52, 41, 48, 45, 48, 43, 50, 47, 50, 41, 48, 45, 48, 43, 50, 47, 50, 48, 55, 52, 55, 48, 0, 43, 0] },
};
let timer = null, step = 0, nextAt = 0, track = null;
// Start a song: by name from SONGS, or one of the region tracks at random.
export function playMusic(song) {
  stopMusic();
  if (!ensure()) return;
  track = SONGS[song] ?? TRACKS[Math.floor(Math.random() * TRACKS.length)];
  step = 0; nextAt = ctx.currentTime + 0.1;
  const len = 60 / track.bpm / 2;
  timer = setInterval(() => {
    while (nextAt < ctx.currentTime + 0.25) {
      const m = track.melody[step % 32], b = track.bass[step % 32];
      if (m) note(musicBus, 'square', m, nextAt, len * 1.6, 0.12);
      if (b) note(musicBus, 'triangle', b, nextAt, len * 1.8, 0.3);
      step++; nextAt += len;
    }
  }, 100);
}
export function stopMusic() { clearInterval(timer); timer = null; }
export const musicName = () => track?.name ?? '';
export const songPlaying = song => !!track && track === SONGS[song];
