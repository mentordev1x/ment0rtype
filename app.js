'use strict';

const $ = id => document.getElementById(id);

const state = {
  lang: 'tr',
  mode: 'time',
  timeOpt: 30,
  wordOpt: 25,
  wordList: 'basic',
  minLen: 1,
  maxLen: 15,
  capitals: false,
  punct: false,
  numbers: false,
  showAob: true,
  cursorBlink: true,
  fontSize: 22,

  words: [],
  wordIdx: 0,
  buf: '',
  started: false,
  done: false,
  startTime: null,
  timer: null,
  history: [],
  correctChars: 0,
  wrongChars: 0,
  extraChars: 0,
  keystrokes: 0,
  tabHeld: false,
};

const els = {
  words: $('words'),
  inp: $('inp'),
  hint: $('hint'),
  testArea: $('test-area'),
  liveWpm: $('live-wpm'),
  liveTimer: $('live-timer'),
  liveStats: $('live-stats'),
  modeBar: $('mode-bar'),
  modeOpts: $('mode-opts'),
  actionBar: $('action-bar'),
  results: $('results'),
  rWpm: $('r-wpm'), rAcc: $('r-acc'), rRaw: $('r-raw'), rCons: $('r-cons'),
  rTime: $('r-time'), rChars: $('r-chars'), rLang: $('r-lang'), rMode: $('r-mode'),
  chart: $('chart'),
  settingsPanel: $('settings-panel'),
  settingsOverlay: $('settings-overlay'),
  langTr: $('lang-tr'), langEn: $('lang-en'),
  minLen: $('min-len'), minLenVal: $('min-len-val'),
  maxLen: $('max-len'), maxLenVal: $('max-len-val'),
  fontSize: $('font-size'), fontSizeVal: $('font-size-val'),
  chkCapitals: $('chk-capitals'),
  chkCursor: $('chk-cursor'),
  toasts: $('toasts'),
};

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pool() {
  const list = WORD_LISTS[state.lang][state.wordList];
  const filtered = list.filter(w => w.length >= state.minLen && w.length <= state.maxLen);
  return filtered.length ? filtered : list;
}

function genWords(n = 70) {
  if (state.mode === 'quote') {
    const quotes = state.lang === 'tr' ? QUOTES_TR : QUOTES_EN;
    return rand(quotes).split(/\s+/);
  }
  const p = shuffle(pool());
  const puncts = [',', '.', '!', '?', ';'];
  const out = [];
  while (out.length < n) {
    let w = p[out.length % p.length];
    if (state.capitals && Math.random() < 0.15) w = w[0].toUpperCase() + w.slice(1);
    if (state.punct && Math.random() < 0.2) w += rand(puncts);
    if (state.numbers && Math.random() < 0.12) out.push(String(Math.floor(Math.random() * 1000)));
    out.push(w);
  }
  return out;
}

function wpm(chars, secs) {
  return secs <= 0 ? 0 : Math.round((chars / 5) / (secs / 60));
}

function accuracy() {
  const t = state.correctChars + state.wrongChars;
  return t === 0 ? 100 : Math.round((state.correctChars / t) * 1000) / 10;
}

function consistency() {
  if (state.history.length < 3) return 100;
  const wpms = state.history.map(h => h.wpm);
  const avg = wpms.reduce((a, b) => a + b, 0) / wpms.length;
  const cv = avg > 0 ? Math.sqrt(wpms.reduce((s, v) => s + (v - avg) ** 2, 0) / wpms.length) / avg * 100 : 0;
  return Math.max(0, Math.round(100 - cv));
}

function buildWords() {
  els.words.innerHTML = '';
  state.words.forEach((word, wi) => {
    const span = document.createElement('span');
    span.className = 'word' + (wi === 0 ? ' current' : '');
    span.dataset.i = wi;
    [...word].forEach((ch, li) => {
      const l = document.createElement('span');
      l.className = 'letter' + (wi === 0 && li === 0 ? ' cur' : '');
      l.textContent = ch;
      span.appendChild(l);
    });
    els.words.appendChild(span);
  });
  els.words.style.transform = 'translateY(0)';
}

function updateDisplay() {
  const wordEls = els.words.querySelectorAll('.word');
  els.words.querySelectorAll('.cur, .cur-end').forEach(e => e.classList.remove('cur', 'cur-end'));

  wordEls.forEach((wEl, wi) => {
    const word = state.words[wi];
    wEl.classList.remove('current', 'correct', 'wrong');

    if (wi < state.wordIdx) {
      wEl.classList.add('correct');
      return;
    }

    if (wi !== state.wordIdx) return;
    wEl.classList.add('current');

    const letters = wEl.querySelectorAll('.letter');
    letters.forEach((lEl, li) => {
      lEl.classList.remove('correct', 'wrong', 'extra');
      const typed = state.buf[li];
      if (typed === undefined) {
        lEl.textContent = word[li] || '';
      } else if (typed === word[li]) {
        lEl.classList.add('correct');
      } else {
        lEl.classList.add('wrong');
        lEl.textContent = word[li] || typed;
      }
    });

    wEl.querySelectorAll('.extra').forEach(e => e.remove());
    if (state.buf.length > word.length) {
      for (let i = word.length; i < state.buf.length; i++) {
        const e = document.createElement('span');
        e.className = 'letter extra';
        e.textContent = state.buf[i];
        wEl.appendChild(e);
      }
    }

    const allL = wEl.querySelectorAll('.letter');
    if (state.buf.length >= allL.length) {
      allL[allL.length - 1].classList.add('cur-end');
    } else {
      allL[state.buf.length].classList.add('cur');
    }
  });

  scrollWords();
}

function scrollWords() {
  const allWordEls = els.words.querySelectorAll('.word');
  const active = allWordEls[state.wordIdx];
  if (!active) return;

  const lh = parseFloat(getComputedStyle(els.words).lineHeight);

  // Get current translateY from the applied transform
  const matrix = new DOMMatrix(getComputedStyle(els.words).transform);
  const currentShift = Math.abs(matrix.m42);

  // offsetTop is relative to offsetParent (probably #test-area)
  // els.words.offsetTop gives the words container's top within that same parent
  // So subtracting gives position relative to #words itself
  const relTop = active.offsetTop - els.words.offsetTop;

  // Which line is this word on (0-indexed)
  const line = Math.round(relTop / lh);

  // We want to keep the active word always on line 1 (second visible line)
  // so scroll = (line - 1) * lineHeight, but only move forward
  const targetShift = Math.max(0, (line - 1) * lh);

  if (targetShift > currentShift) {
    els.words.style.transform = `translateY(-${targetShift}px)`;
  }
}

function appendWords(newWords) {
  const startIdx = state.words.length - newWords.length;
  newWords.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.dataset.i = startIdx + i;
    [...word].forEach(ch => {
      const l = document.createElement('span');
      l.className = 'letter';
      l.textContent = ch;
      span.appendChild(l);
    });
    els.words.appendChild(span);
  });
}

function startTimer() {
  if (state.timer) return;
  state.startTime = Date.now();

  if (state.mode === 'time') {
    state.timer = setInterval(() => {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const left = Math.max(0, state.timeOpt - Math.floor(elapsed));
      els.liveTimer.textContent = left + 's';
      els.liveTimer.className = left <= 10 ? 'danger' : left <= 20 ? 'warn' : '';
      const cur = wpm(state.correctChars, elapsed);
      state.history.push({ time: Math.floor(elapsed), wpm: cur });
      if (state.showAob) els.liveWpm.textContent = cur;
      if (left === 0) finish();
    }, 500);
  } else {
    state.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      els.liveTimer.textContent = elapsed + 's';
      const cur = wpm(state.correctChars, (Date.now() - state.startTime) / 1000);
      state.history.push({ time: elapsed, wpm: cur });
      if (state.showAob) els.liveWpm.textContent = cur;
    }, 500);
  }
}

function stopTimer() {
  clearInterval(state.timer);
  state.timer = null;
}

function onInput() {
  if (state.done) return;
  const val = els.inp.value;

  els.hint.classList.add('gone');
  els.testArea.classList.add('typing');

  if (!state.started && val.length > 0) {
    state.started = true;
    startTimer();
  }

  if (val.endsWith(' ')) {
    state.keystrokes++;
    const typed = val.trimEnd();
    const word = state.words[state.wordIdx];
    for (let i = 0; i < Math.max(typed.length, word.length); i++) {
      typed[i] === word[i] ? state.correctChars++ : state.wrongChars++;
    }
    if (typed.length > word.length) state.extraChars += typed.length - word.length;

    state.wordIdx++;
    state.buf = '';
    els.inp.value = '';

    if (state.mode !== 'time' && state.wordIdx >= state.words.length) {
      finish();
      return;
    }

    if (state.mode === 'time' && state.wordIdx >= state.words.length - 40) {
      const extra = genWords(60);
      state.words.push(...extra);
      appendWords(extra);
    }

    updateDisplay();
    return;
  }

  state.buf = val;
  state.keystrokes++;
  updateDisplay();
}

function onKeyDown(e) {
  if (e.key === 'Tab') { e.preventDefault(); state.tabHeld = true; return; }
  if (e.key === 'Enter' && state.tabHeld) { e.preventDefault(); state.tabHeld = false; reset(); return; }
  if (e.key !== 'Tab') state.tabHeld = false;
  if (e.key === 'Escape') reset();
}

function reset() {
  stopTimer();
  Object.assign(state, {
    wordIdx: 0, buf: '', started: false, done: false, startTime: null,
    history: [], correctChars: 0, wrongChars: 0, extraChars: 0, keystrokes: 0,
  });

  const count = state.mode === 'time' ? 150 : (state.mode === 'quote' ? 999 : state.wordOpt);
  state.words = genWords(count);

  els.liveWpm.textContent = '0';
  els.liveTimer.textContent = state.mode === 'time' ? state.timeOpt + 's' : '';
  els.liveTimer.className = '';
  els.inp.value = '';
  els.hint.classList.remove('gone');
  els.testArea.classList.remove('typing');

  els.results.classList.add('hidden');
  els.testArea.style.display = '';
  els.modeBar.style.display = '';
  els.actionBar.style.display = '';

  buildWords();
  updateDisplay();
}

function finish() {
  if (state.done) return;
  state.done = true;
  stopTimer();

  const secs = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
  const w = wpm(state.correctChars, secs);
  const rw = wpm(state.keystrokes, secs);
  const acc = accuracy();
  const cons = consistency();

  els.testArea.style.display = 'none';
  els.modeBar.style.display = 'none';
  els.actionBar.style.display = 'none';
  els.results.classList.remove('hidden');

  countUp(els.rWpm, w, 750);
  countUp(els.rRaw, rw, 750);
  els.rAcc.textContent = acc + '%';
  els.rCons.textContent = cons + '%';
  els.rTime.textContent = Math.round(secs) + 's';
  els.rChars.textContent = `${state.correctChars}/${state.wrongChars}/${state.extraChars}/0`;
  els.rLang.textContent = state.lang.toUpperCase();
  els.rMode.textContent = state.mode === 'time' ? `süre ${state.timeOpt}s` : state.mode === 'words' ? `kelime ${state.wordOpt}` : 'alıntı';

  drawChart();
}

function countUp(el, target, ms) {
  const t0 = performance.now();
  const tick = ts => {
    const p = Math.min((ts - t0) / ms, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function drawChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 680;
  const H = 170;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  if (state.history.length < 2) {
    ctx.fillStyle = 'rgba(139,92,246,0.25)';
    ctx.font = '13px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('yeterli veri yok', W / 2, H / 2);
    return;
  }

  const pad = { t: 16, r: 16, b: 32, l: 44 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const maxW = Math.max(...state.history.map(h => h.wpm), 10);
  const maxT = Math.max(...state.history.map(h => h.time), 1);

  const px = t => pad.l + (t / maxT) * cW;
  const py = w => pad.t + cH - (w / (maxW * 1.1)) * cH;

  ctx.strokeStyle = 'rgba(139,92,246,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (cH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(152,152,184,0.5)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxW * 1.1 * (1 - i / 4)), pad.l - 5, y + 3);
  }

  const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
  g.addColorStop(0, 'rgba(139,92,246,0.38)');
  g.addColorStop(1, 'rgba(139,92,246,0.02)');

  ctx.beginPath();
  ctx.moveTo(px(state.history[0].time), py(state.history[0].wpm));
  state.history.forEach(h => ctx.lineTo(px(h.time), py(h.wpm)));
  ctx.lineTo(px(maxT), pad.t + cH);
  ctx.lineTo(pad.l, pad.t + cH);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  state.history.forEach((h, i) => i ? ctx.lineTo(px(h.time), py(h.wpm)) : ctx.moveTo(px(h.time), py(h.wpm)));
  ctx.stroke();

  state.history.forEach((h, i) => {
    if (i % Math.max(1, Math.floor(state.history.length / 8)) === 0) {
      ctx.beginPath();
      ctx.arc(px(h.time), py(h.wpm), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#c4b5fd';
      ctx.fill();
    }
  });

  ctx.fillStyle = 'rgba(152,152,184,0.5)';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) {
    ctx.fillText(Math.round((maxT / 4) * i) + 's', px((maxT / 4) * i), H - 6);
  }
}

function setLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  $('lang-btn').textContent = lang.toUpperCase();
  document.querySelectorAll('[data-tr][data-en]').forEach(el => el.textContent = el.dataset[lang]);
  els.langTr.classList.toggle('active', lang === 'tr');
  els.langEn.classList.toggle('active', lang === 'en');
  reset();
  toast(lang === 'tr' ? '🇹🇷 Türkçe seçildi' : '🇺🇸 English selected', 'ok');
}

function openSettings() {
  els.settingsPanel.classList.remove('hidden');
  els.settingsOverlay.classList.remove('hidden');
}

function closeSettings() {
  els.settingsPanel.classList.add('hidden');
  els.settingsOverlay.classList.add('hidden');
}

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  els.toasts.appendChild(t);
  setTimeout(() => { t.style.animation = 'toast-out 0.25s ease forwards'; setTimeout(() => t.remove(), 250); }, 1800);
}

function buildModeOpts() {
  els.modeOpts.innerHTML = '';
  const opts = state.mode === 'time' ? [15, 30, 60, 120] : state.mode === 'words' ? [10, 25, 50, 100] : [];
  opts.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn' + ((state.mode === 'time' ? state.timeOpt : state.wordOpt) === v ? ' active' : '');
    btn.textContent = state.mode === 'time' ? v + 's' : v;
    btn.addEventListener('click', () => {
      if (state.mode === 'time') state.timeOpt = v;
      else state.wordOpt = v;
      buildModeOpts();
      reset();
    });
    els.modeOpts.appendChild(btn);
  });
}

function initParticles() {
  const bg = $('bg');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    const s = Math.random() * 2.5 + 0.8;
    const dur = Math.random() * 20 + 12;
    p.style.cssText = `position:absolute;width:${s}px;height:${s}px;border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;background:rgba(139,92,246,${Math.random()*0.3+0.05});animation:pf ${dur}s ease-in-out ${Math.random()*-20}s infinite alternate;pointer-events:none;`;
    bg.appendChild(p);
  }
  const st = document.createElement('style');
  const dx = (Math.random()*60-30).toFixed(0), dy = (Math.random()*60-30).toFixed(0);
  st.textContent = `@keyframes pf{0%{transform:translate(0,0);opacity:0.1}50%{transform:translate(${dx}px,${dy}px)}100%{transform:translate(0,0);opacity:0.28}}`;
  document.head.appendChild(st);
}

function init() {
  initParticles();

  els.testArea.addEventListener('click', () => els.inp.focus());
  document.addEventListener('keydown', e => {
    if (['INPUT','BUTTON','TEXTAREA'].includes(e.target.tagName) && e.target !== els.inp) return;
    if (!['Tab','Escape'].includes(e.key)) els.inp.focus();
  });

  els.inp.addEventListener('input', onInput);
  els.inp.addEventListener('keydown', onKeyDown);

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildModeOpts();
      reset();
    });
  });

  $('toggle-punct').addEventListener('click', function() {
    state.punct = !state.punct;
    this.classList.toggle('active', state.punct);
    reset();
  });

  $('toggle-numbers').addEventListener('click', function() {
    state.numbers = !state.numbers;
    this.classList.toggle('active', state.numbers);
    reset();
  });

  $('toggle-aob').addEventListener('click', function() {
    state.showAob = !state.showAob;
    this.classList.toggle('active', state.showAob);
    els.liveStats.style.opacity = state.showAob ? '1' : '0';
    toast(state.showAob ? (state.lang === 'tr' ? 'Canlı AOB görünür' : 'Live WPM visible') : (state.lang === 'tr' ? 'Canlı AOB gizli' : 'Live WPM hidden'), state.showAob ? 'ok' : '');
  });

  $('restart-btn').addEventListener('click', reset);
  $('next-btn').addEventListener('click', reset);
  $('redo-btn').addEventListener('click', reset);
  $('logo-btn').addEventListener('click', e => { e.preventDefault(); reset(); });

  $('nav-settings').addEventListener('click', openSettings);
  $('settings-close').addEventListener('click', closeSettings);
  $('settings-overlay').addEventListener('click', closeSettings);

  $('lang-btn').addEventListener('click', () => setLang(state.lang === 'tr' ? 'en' : 'tr'));
  els.langTr.addEventListener('click', () => setLang('tr'));
  els.langEn.addEventListener('click', () => setLang('en'));

  els.minLen.addEventListener('input', function() {
    state.minLen = +this.value;
    if (state.minLen >= state.maxLen) { state.maxLen = state.minLen + 1; els.maxLen.value = state.maxLen; els.maxLenVal.textContent = state.maxLen; }
    els.minLenVal.textContent = state.minLen;
    reset();
  });

  els.maxLen.addEventListener('input', function() {
    state.maxLen = +this.value;
    if (state.maxLen <= state.minLen) { state.minLen = Math.max(1, state.maxLen - 1); els.minLen.value = state.minLen; els.minLenVal.textContent = state.minLen; }
    els.maxLenVal.textContent = state.maxLen;
    reset();
  });

  document.querySelectorAll('[data-wl]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.wordList = btn.dataset.wl;
      document.querySelectorAll('[data-wl]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reset();
      toast(state.lang === 'tr' ? 'Kelime listesi güncellendi' : 'Word list updated', 'ok');
    });
  });

  els.fontSize.addEventListener('input', function() {
    state.fontSize = +this.value;
    els.fontSizeVal.textContent = state.fontSize + 'px';
    els.words.style.fontSize = state.fontSize + 'px';
  });

  els.chkCapitals.addEventListener('change', function() {
    state.capitals = this.checked;
    reset();
  });

  els.chkCursor.addEventListener('change', function() {
    state.cursorBlink = this.checked;
    els.words.classList.toggle('no-blink', !this.checked);
  });

  buildModeOpts();
  setLang('tr');
  els.inp.focus();
}

document.addEventListener('DOMContentLoaded', init);
