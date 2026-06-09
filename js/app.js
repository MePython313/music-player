(function(){
'use strict';

/* ── State ── */
const state = {
  songs: [],
  filtered: [],
  current: -1,
  sortMode: 0
};

const sortLabels = ['Name', 'Size', 'Random', 'Rating'];

/* ── Themes ── */
const themes = [
  ['#0b1020','#6ea8ff'],
  ['#180016','#ff00ff'],
  ['#00161a','#00e5ff'],
  ['#1a1400','#ffb300']
];

let themeIndex = HyperPlayerStorage.getTheme();

/* ── DOM refs ── */
const $ = id => document.getElementById(id);
const picker    = $('picker');
const songsDiv  = $('songs');
const search    = $('search');
const playBtn   = $('play');
const nextBtn   = $('next');
const prevBtn   = $('prev');
const shuffleBtn= $('shuffle');
const sortBtn   = $('sortBtn');
const sortLabel = $('sortLabel');
const themeBtn  = $('themeBtn');
const title     = $('title');
const subtitle  = $('subtitle');
const cover     = $('cover');
const totalF    = $('totalFiles');
const totalS    = $('totalSize');
const songNum   = $('songNum');
const songSize  = $('songSize');
const curTime   = $('currentTime');
const totTime   = $('totalTime');
const progBar   = $('progressBar');
const progFill  = $('progressFill');
const progThumb = $('progressThumb');
const volSlider = $('volumeSlider');
const muteBtn   = $('muteBtn');
const stars     = [...document.querySelectorAll('#stars span')];
const visMode   = $('visualizerMode');
const toastCtn  = $('toast-container');

/* ── Helper ── */
function fmtTime(s){
  if(!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

/* ── Theme ── */
function applyTheme(){
  const [bg, accent] = themes[themeIndex];
  document.documentElement.style.setProperty('--bg', bg);
  document.documentElement.style.setProperty('--accent', accent);
  document.body.style.background = `linear-gradient(135deg,${bg},#16213e,${accent})`;
}
applyTheme();

themeBtn.addEventListener('click', () => {
  themeIndex = (themeIndex + 1) % themes.length;
  applyTheme();
  HyperPlayerStorage.setTheme(themeIndex);
});

/* ── Player init ── */
HyperPlayerPlayer.init('audio');

HyperPlayerPlayer.onTrackChange = (file) => {
  title.textContent = file.name;
  subtitle.textContent = 'Now Playing';
  songNum.textContent = state.current + 1;
  songSize.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  cover.classList.add('playing');
  loadRating();
  render();
  showToast('Now Playing: ' + file.name);
};

HyperPlayerPlayer.onTimeUpdate = () => {
  const ct = HyperPlayerPlayer.getCurrentTime();
  const dur = HyperPlayerPlayer.getDuration();
  curTime.textContent = fmtTime(ct);
  totTime.textContent = fmtTime(dur);
  if (dur > 0) {
    const pct = (ct / dur) * 100;
    progFill.style.width = pct + '%';
    progThumb.style.left = pct + '%';
  }
};

HyperPlayerPlayer.onEnded = () => {
  if (state.current >= 0 && state.filtered.length) {
    playSongAt((state.current + 1) % state.filtered.length);
  }
};

HyperPlayerPlayer.onPlayStateChange = (playing) => {
  playBtn.textContent = playing ? '⏸' : '▶';
  if (!playing) cover.classList.remove('playing');
};

/* ── File loading ── */
async function loadSongsFromFiles(files){
  state.current = -1;
  title.textContent = 'HyperPlayer X';
  subtitle.textContent = 'Loading...';
  songNum.textContent = '-';
  songSize.textContent = '-';
  curTime.textContent = '0:00';
  totTime.textContent = '0:00';
  progFill.style.width = '0%';
  progThumb.style.left = '0%';
  cover.classList.remove('playing');

  state.songs = files.filter(f =>
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name)
  );
  state.filtered = [...state.songs];
  updateStats();
  render();
  if (state.filtered.length) {
    await playSongAt(0);
  } else {
    subtitle.textContent = 'No audio files found';
    showToast('No audio files found in folder');
  }
}

async function readDirRecursive(dirHandle){
  const files = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      files.push(await entry.getFile());
    } else if (entry.kind === 'directory') {
      files.push(...(await readDirRecursive(entry)));
    }
  }
  return files;
}

async function openFolder(){
  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      subtitle.textContent = 'Reading folder...';
      const files = await readDirRecursive(dirHandle);
      await HyperPlayerStorage.saveDirHandle(dirHandle);
      await loadSongsFromFiles(files);
      if (state.songs.length) showToast('Loaded ' + state.songs.length + ' songs');
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        picker.click();
      }
      return;
    }
  }
  picker.click();
}

async function restoreSavedFolder(){
  if (!window.showDirectoryPicker) return;
  try {
    const dirHandle = await HyperPlayerStorage.loadDirHandle();
    if (!dirHandle) return;
    const perm = await dirHandle.requestPermission({ mode: 'read' });
    if (perm !== 'granted') {
      HyperPlayerStorage.clearDirHandle();
      return;
    }
    subtitle.textContent = 'Restoring folder...';
    const files = await readDirRecursive(dirHandle);
    await loadSongsFromFiles(files);
    if (state.songs.length) showToast('Restored ' + state.songs.length + ' songs');
  } catch (err) {
    console.error(err);
    HyperPlayerStorage.clearDirHandle();
  }
}

/* ── File picker ── */
$('openBtn').addEventListener('click', openFolder);

picker.addEventListener('change', async e => {
  await loadSongsFromFiles([...e.target.files]);
});

/* ── Stats ── */
function updateStats(){
  totalF.textContent = state.songs.length;
  const size = state.songs.reduce((a, b) => a + b.size, 0);
  totalS.textContent = (size / 1024 / 1024).toFixed(1) + ' MB';
}

/* ── Render ── */
function render(){
  songsDiv.innerHTML = '';
  state.filtered.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'song' + (i === state.current ? ' active' : '');
    d.textContent = (i + 1) + '. ' + s.name;
    d.addEventListener('click', () => playSongAt(i));
    d.setAttribute('role', 'option');
    d.setAttribute('aria-selected', i === state.current ? 'true' : 'false');
    songsDiv.appendChild(d);
  });
}

/* ── Play song at index ── */
async function playSongAt(i){
  if (i < 0 || i >= state.filtered.length) return;
  state.current = i;
  const file = state.filtered[i];
  await HyperPlayerPlayer.load(file);
}

/* ── Playback controls ── */
playBtn.addEventListener('click', () => HyperPlayerPlayer.togglePlay());

nextBtn.addEventListener('click', () => {
  if (state.filtered.length) playSongAt((state.current + 1) % state.filtered.length);
});

prevBtn.addEventListener('click', () => {
  if (state.filtered.length) {
    playSongAt((state.current - 1 + state.filtered.length) % state.filtered.length);
  }
});

shuffleBtn.addEventListener('click', () => {
  if (state.filtered.length) {
    playSongAt(Math.floor(Math.random() * state.filtered.length));
  }
});

/* ── Sort ── */
sortBtn.addEventListener('click', () => {
  state.sortMode = (state.sortMode + 1) % 4;
  sortLabel.textContent = sortLabels[state.sortMode];
  if (state.sortMode === 0) state.filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.sortMode === 1) state.filtered.sort((a, b) => b.size - a.size);
  else if (state.sortMode === 2) state.filtered.sort(() => Math.random() - 0.5);
  else state.filtered.sort((a, b) => HyperPlayerStorage.getRating(b.name) - HyperPlayerStorage.getRating(a.name));
  render();
});

/* ── Search ── */
search.addEventListener('input', () => {
  const q = search.value.toLowerCase();
  state.filtered = state.songs.filter(x => x.name.toLowerCase().includes(q));
  if (state.current >= 0 && !state.filtered.some(s => s === state.songs[state.current])) {
    state.current = -1;
    title.textContent = 'HyperPlayer X';
    subtitle.textContent = 'Load a music folder';
    songNum.textContent = '-';
    songSize.textContent = '-';
    cover.classList.remove('playing');
    curTime.textContent = '0:00';
    totTime.textContent = '0:00';
    progFill.style.width = '0%';
    progThumb.style.left = '0%';
    HyperPlayerPlayer.destroy();
  }
  render();
});

/* ── Seek bar ── */
let isDragging = false;

progBar.addEventListener('mousedown', e => {
  isDragging = true;
  updateSeek(e);
});

document.addEventListener('mousemove', e => {
  if (isDragging) updateSeek(e);
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
  }
});

function updateSeek(e){
  const rect = progBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  progFill.style.width = (pct * 100) + '%';
  progThumb.style.left = (pct * 100) + '%';
  HyperPlayerPlayer.seek(pct);
}

/* ── Volume ── */
volSlider.value = HyperPlayerStorage.getVolume();
HyperPlayerPlayer.setVolume(volSlider.value);

volSlider.addEventListener('input', () => {
  HyperPlayerPlayer.setVolume(volSlider.value);
  muteBtn.textContent = volSlider.value == 0 ? '🔇' : volSlider.value < 0.5 ? '🔉' : '🔊';
});

muteBtn.addEventListener('click', () => {
  if (HyperPlayerPlayer.getVolume() > 0) {
    muteBtn.dataset.prevVol = volSlider.value;
    volSlider.value = 0;
    HyperPlayerPlayer.setVolume(0);
    muteBtn.textContent = '🔇';
  } else {
    volSlider.value = muteBtn.dataset.prevVol || '0.7';
    HyperPlayerPlayer.setVolume(volSlider.value);
    muteBtn.textContent = volSlider.value < 0.5 ? '🔉' : '🔊';
  }
});

/* ── Stars / Rating ── */
function loadRating(){
  if (state.current < 0) return;
  const key = state.filtered[state.current].name;
  const r = HyperPlayerStorage.getRating(key);
  stars.forEach((s, i) => {
    s.classList.toggle('gold', i < r);
  });
}

stars.forEach(st => {
  st.addEventListener('click', () => {
    if (state.current < 0) return;
    const key = state.filtered[state.current].name;
    HyperPlayerStorage.setRating(key, st.dataset.v);
    loadRating();
  });
});

/* ── Visualizer mode ── */
visMode.addEventListener('click', () => {
  HyperPlayerVisualizer.toggleMode();
  visMode.textContent = HyperPlayerVisualizer.mode === 'bars' ? 'Wave' : 'Bars';
});

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; // ignore when typing in search

  switch (e.key) {
    case ' ':
      e.preventDefault();
      HyperPlayerPlayer.togglePlay();
      break;
    case 'ArrowRight':
      if (e.shiftKey) HyperPlayerPlayer.seekBy(5);
      else if (state.filtered.length) playSongAt((state.current + 1) % state.filtered.length);
      break;
    case 'ArrowLeft':
      if (e.shiftKey) HyperPlayerPlayer.seekBy(-5);
      else if (state.filtered.length) playSongAt((state.current - 1 + state.filtered.length) % state.filtered.length);
      break;
    case 'ArrowUp':
      e.preventDefault();
      volSlider.value = Math.min(1, parseFloat(volSlider.value) + 0.05);
      HyperPlayerPlayer.setVolume(volSlider.value);
      break;
    case 'ArrowDown':
      e.preventDefault();
      volSlider.value = Math.max(0, parseFloat(volSlider.value) - 0.05);
      HyperPlayerPlayer.setVolume(volSlider.value);
      break;
    case 's':
    case 'S':
      if (state.filtered.length) playSongAt(Math.floor(Math.random() * state.filtered.length));
      break;
    case 'm':
    case 'M':
      muteBtn.click();
      break;
  }
});

/* ── Drag & Drop ── */
let dragCounter = 0;

document.addEventListener('dragenter', e => {
  e.preventDefault();
  dragCounter++;
});

document.addEventListener('dragleave', e => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    document.body.style.borderColor = '';
  }
});

document.addEventListener('dragover', e => {
  e.preventDefault();
  document.body.style.borderColor = 'var(--accent)';
});

document.addEventListener('drop', e => {
  e.preventDefault();
  dragCounter = 0;
  document.body.style.borderColor = '';
  const files = [...e.dataTransfer.files].filter(f =>
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name)
  );
  if (files.length) {
    const oldLen = state.songs.length;
    state.songs = state.songs.concat(files);
    state.filtered = [...state.songs];
    updateStats();
    render();
    if (oldLen === 0 && state.filtered.length) {
      playSongAt(0);
    }
    showToast('Added ' + files.length + ' file' + (files.length > 1 ? 's' : ''));
  }
});

/* ── Toast ── */
function showToast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  toastCtn.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = '0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

/* ── Init visualizer ── */
HyperPlayerVisualizer.init('visualizer');

/* ── Restore saved folder ── */
restoreSavedFolder();

})();
