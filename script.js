/**
 * KOTOBA TRAINER — script.js (FIXED)
 * Fix: randomisasi benar, semua section bekerja, favorit & dipelajari berfungsi
 */
'use strict';

// ===== STORAGE KEYS =====
const KEYS = {
  stats:    'kt_stats',
  progress: 'kt_progress',
  favs:     'kt_favs',
  wrongs:   'kt_wrongs',
  settings: 'kt_settings',
};

// ===== STATE =====
let state = {
  mode:      'campur',   // default campur supaya random dari awal
  category:  'semua',
  pool:      [],
  queue:     [],
  current:   null,
  answering: true,
  progress:  {},
  favs:      new Set(),
  wrongs:    new Set(),
  stats: { correct: 0, wrong: 0, streak: 0, bestStreak: 0, total: 0 },
  section:   'train',
};

// ===== DOM =====
const $  = id => document.getElementById(id);
const dom = {
  progressCurrent: $('progressCurrent'),
  progressTotal:   $('progressTotal'),
  progressBar:     $('progressBar'),
  streakBadge:     $('streakBadge'),
  accuracyBadge:   $('accuracyBadge'),
  modeSelect:      $('modeSelect'),
  categorySelect:  $('categorySelect'),
  wordCard:        $('wordCard'),
  categoryTag:     $('categoryTag'),
  btnSpeak:        $('btnSpeak'),
  btnFav:          $('btnFav'),
  questionLabel:   $('questionLabel'),
  questionText:    $('questionText'),
  questionSub:     $('questionSub'),
  feedback:        $('feedback'),
  feedbackIcon:    $('feedbackIcon'),
  feedbackDetail:  $('feedbackDetail'),
  answerInput:     $('answerInput'),
  btnSubmit:       $('btnSubmit'),
  panelSearch:     $('panelSearch'),
  panelStats:      $('panelStats'),
  searchInput:     $('searchInput'),
  searchResults:   $('searchResults'),
  statCorrect:     $('statCorrect'),
  statWrong:       $('statWrong'),
  statAccuracy:    $('statAccuracy'),
  statStreak:      $('statStreak'),
  statTotal:       $('statTotal'),
  overlay:         $('overlay'),
  btnTrain:        $('btnTrain'),
  btnReviewWrong:  $('btnReviewWrong'),
  btnFavList:      $('btnFavList'),
  btnLearned:      $('btnLearned'),
  btnReset:        $('btnReset'),
  btnSearch:       $('btnSearch'),
  btnStats:        $('btnStats'),
  closeSearch:     $('closeSearch'),
  closeStats:      $('closeStats'),
  trainSection:    $('trainSection'),
  reviewSection:   $('reviewSection'),
  favsSection:     $('favsSection'),
  learnedSection:  $('learnedSection'),
};

// ===== STORAGE =====
function loadStorage() {
  try {
    const raw = localStorage.getItem(KEYS.stats);
    if (raw) Object.assign(state.stats, JSON.parse(raw));
    const prog = localStorage.getItem(KEYS.progress);
    if (prog) state.progress = JSON.parse(prog);
    const favsRaw = localStorage.getItem(KEYS.favs);
    if (favsRaw) state.favs = new Set(JSON.parse(favsRaw));
    const wrongsRaw = localStorage.getItem(KEYS.wrongs);
    if (wrongsRaw) state.wrongs = new Set(JSON.parse(wrongsRaw));
    const settings = localStorage.getItem(KEYS.settings);
    if (settings) {
      const s = JSON.parse(settings);
      if (s.mode)     state.mode     = s.mode;
      if (s.category) state.category = s.category;
    }
  } catch(e) { console.warn('loadStorage error', e); }
}

function saveStats()    { try { localStorage.setItem(KEYS.stats,    JSON.stringify(state.stats));           localStorage.setItem(KEYS.progress, JSON.stringify(state.progress)); } catch(e) {} }
function saveFavs()     { try { localStorage.setItem(KEYS.favs,     JSON.stringify([...state.favs]));   } catch(e) {} }
function saveWrongs()   { try { localStorage.setItem(KEYS.wrongs,   JSON.stringify([...state.wrongs])); } catch(e) {} }
function saveSettings() { try { localStorage.setItem(KEYS.settings, JSON.stringify({ mode: state.mode, category: state.category })); } catch(e) {} }

// ===== UTILS =====
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Fisher-Yates shuffle — BENAR-BENAR RANDOM
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== CATEGORY SELECT =====
function buildCategorySelect() {
  dom.categorySelect.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat === 'semua' ? '📚 Semua' : capitalize(cat);
    if (cat === state.category) opt.selected = true;
    dom.categorySelect.appendChild(opt);
  });
}

// ===== POOL & QUEUE =====
function buildPool() {
  if (state.section === 'review') {
    state.pool = VOCABULARY.filter(w => state.wrongs.has(w.jp));
    if (!state.pool.length) state.pool = [...VOCABULARY];
  } else if (state.section === 'favs') {
    state.pool = VOCABULARY.filter(w => state.favs.has(w.jp));
    if (!state.pool.length) state.pool = [...VOCABULARY];
  } else {
    state.pool = state.category === 'semua'
      ? [...VOCABULARY]
      : VOCABULARY.filter(w => w.category === state.category);
    if (!state.pool.length) state.pool = [...VOCABULARY];
  }
}

/**
 * Build queue dengan spaced repetition + shuffle beneran.
 * Kata yang sering salah → lebih sering muncul.
 * Kata yang sudah hafal → lebih jarang.
 * Tapi tetap random, tidak urut.
 */
function buildQueue() {
  buildPool();

  // Pisahkan kata belum pernah, perlu diulang, sudah hafal
  const unseen  = [];  // belum pernah dijawab
  const needRep = [];  // pernah salah / belum lancar
  const mastered = []; // sudah benar >= 5x dan lebih banyak benar dari salah

  state.pool.forEach(w => {
    const p = state.progress[w.jp];
    if (!p || (p.correct === 0 && p.wrong === 0)) {
      unseen.push(w);
    } else if (p.correct >= 5 && p.correct > p.wrong * 2) {
      mastered.push(w);
    } else {
      needRep.push(w);
    }
  });

  // Shuffle masing-masing grup
  const sUnseen   = shuffle(unseen);
  const sNeedRep  = shuffle(needRep);
  const sMastered = shuffle(mastered);

  // Gabung: prioritaskan needRep, lalu unseen, lalu mastered (muncul lebih jarang)
  // Mastered hanya masuk 1 dari setiap 4 slot
  const queue = [];
  let ni = 0, ri = 0, mi = 0;
  const total = state.pool.length;

  for (let i = 0; i < total; i++) {
    if (ri < sNeedRep.length && (i % 3 !== 2 || ni >= sUnseen.length)) {
      queue.push(sNeedRep[ri++]);
    } else if (ni < sUnseen.length) {
      queue.push(sUnseen[ni++]);
    } else if (ri < sNeedRep.length) {
      queue.push(sNeedRep[ri++]);
    } else if (mi < sMastered.length) {
      queue.push(sMastered[mi++]);
    }
  }

  // Kalau queue kosong (edge case), pakai shuffle biasa
  state.queue = queue.length ? queue : shuffle(state.pool);
}

// ===== QUESTION TYPES =====
const QUESTION_TYPES = ['jp-romaji', 'romaji-jp', 'jp-indo', 'indo-jp'];

function pickQuestionType() {
  if (state.mode === 'campur') {
    return QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
  }
  return state.mode;
}

function getQuestion(word, qType) {
  switch(qType) {
    case 'jp-romaji': return { label: 'Apa romaji-nya?',              question: word.jp,    answer: word.romaji, hint: '',                      isJP: true  };
    case 'romaji-jp': return { label: 'Tulis dalam hiragana/katakana!', question: word.romaji, answer: word.jp,    hint: '',                      isJP: false };
    case 'jp-indo':   return { label: 'Apa artinya dalam Indonesia?',  question: word.jp,    answer: word.indo,  hint: '(' + word.romaji + ')', isJP: true  };
    case 'indo-jp':   return { label: 'Tulis dalam huruf Jepang!',      question: word.indo,  answer: word.jp,    hint: '(' + word.romaji + ')', isJP: false };
  }
}

// ===== NEXT QUESTION =====
let currentQType = null;

function nextQuestion() {
  state.answering = true;
  clearFeedback();
  resetInputStyle();
  dom.wordCard.classList.remove('correct', 'wrong');

  if (!state.queue.length) buildQueue();
  const word = state.queue.shift();
  currentQType = pickQuestionType();
  const q = getQuestion(word, currentQType);
  state.current = { word, q };

  dom.categoryTag.textContent   = capitalize(word.category);
  dom.questionLabel.textContent = q.label;

  // Animasi ganti soal
  dom.questionText.style.opacity   = '0';
  dom.questionText.style.transform = 'translateY(10px)';
  setTimeout(() => {
    dom.questionText.textContent = q.question;
    dom.questionText.className   = 'question-text' + (q.isJP ? '' : ' latin');
    dom.questionText.style.opacity   = '';
    dom.questionText.style.transform = '';
  }, 90);

  dom.questionSub.textContent = q.hint;
  updateFavIcon(word.jp);

  dom.answerInput.value    = '';
  dom.answerInput.disabled = false;
  setTimeout(() => dom.answerInput.focus(), 130);

  updateProgressBar();
}

// ===== CHECK ANSWER =====
function normalize(s) {
  return s.trim().toLowerCase().replace(/[ー－]/g, '-').replace(/\s+/g, ' ');
}

function checkAnswer() {
  if (!state.answering || !state.current) return;
  const userAns = normalize(dom.answerInput.value);
  if (!userAns) return;

  const { word, q } = state.current;
  const acceptables = normalize(q.answer).split('/').map(s => s.trim());
  const isCorrect   = acceptables.some(a => userAns === a);

  if (!state.progress[word.jp]) state.progress[word.jp] = { correct: 0, wrong: 0 };

  if (isCorrect) {
    state.progress[word.jp].correct++;
    state.stats.correct++;
    state.stats.streak++;
    if (state.stats.streak > state.stats.bestStreak) state.stats.bestStreak = state.stats.streak;
    state.stats.total++;
    if (state.wrongs.has(word.jp)) { state.wrongs.delete(word.jp); saveWrongs(); }
    showCorrect();
  } else {
    state.progress[word.jp].wrong++;
    state.stats.wrong++;
    state.stats.streak = 0;
    state.stats.total++;
    state.wrongs.add(word.jp);
    saveWrongs();
    showWrong(word, q);
  }

  saveStats();
  updateHeader();
  state.answering        = false;
  dom.answerInput.disabled = true;

  setTimeout(() => nextQuestion(), isCorrect ? 700 : 1900);
}

// ===== FEEDBACK =====
function showCorrect() {
  dom.wordCard.classList.add('correct');
  dom.answerInput.classList.add('correct');
  dom.feedbackIcon.textContent = '✓';
  dom.feedbackDetail.innerHTML = '';
  dom.feedback.classList.add('visible');
  dom.wordCard.classList.add('pop');
  setTimeout(() => dom.wordCard.classList.remove('pop'), 260);
}

function showWrong(word, q) {
  dom.wordCard.classList.add('wrong');
  dom.answerInput.classList.add('wrong');
  dom.feedbackIcon.textContent = '✗';

  let detail = '<strong>Jawaban benar:</strong> ' + q.answer + '<br>';
  if      (currentQType === 'jp-romaji')  detail += '<strong>Arti:</strong> ' + word.indo;
  else if (currentQType === 'romaji-jp')  detail += '<strong>JP:</strong> ' + word.jp + ' &nbsp;|&nbsp; <strong>Arti:</strong> ' + word.indo;
  else if (currentQType === 'jp-indo')    detail += '<strong>JP:</strong> ' + word.jp + ' &nbsp;|&nbsp; <strong>Romaji:</strong> ' + word.romaji;
  else                                    detail += '<strong>JP:</strong> ' + word.jp + ' &nbsp;|&nbsp; <strong>Romaji:</strong> ' + word.romaji;

  dom.feedbackDetail.innerHTML = detail;
  dom.feedback.classList.add('visible');
  dom.wordCard.classList.add('shake');
  setTimeout(() => dom.wordCard.classList.remove('shake'), 360);
}

function clearFeedback() {
  dom.feedback.classList.remove('visible');
  dom.feedbackIcon.textContent = '';
  dom.feedbackDetail.innerHTML = '';
}

function resetInputStyle() {
  dom.answerInput.classList.remove('correct', 'wrong');
}

// ===== PROGRESS =====
function updateProgressBar() {
  const learned = VOCABULARY.filter(w => { const p = state.progress[w.jp]; return p && p.correct > 0; }).length;
  dom.progressCurrent.textContent = learned;
  dom.progressTotal.textContent   = VOCABULARY.length;
  dom.progressBar.style.width     = ((learned / VOCABULARY.length) * 100).toFixed(1) + '%';
}

function updateHeader() {
  dom.streakBadge.textContent   = '🔥 ' + state.stats.streak;
  const total = state.stats.correct + state.stats.wrong;
  const acc   = total > 0 ? Math.round((state.stats.correct / total) * 100) : 0;
  dom.accuracyBadge.textContent = '✓ ' + acc + '%';
}

// ===== FAVORIT =====
function updateFavIcon(jp) {
  if (state.favs.has(jp)) dom.btnFav.classList.add('faved');
  else                     dom.btnFav.classList.remove('faved');
}

dom.btnFav.addEventListener('click', () => {
  if (!state.current) return;
  const jp = state.current.word.jp;
  if (state.favs.has(jp)) { state.favs.delete(jp); dom.btnFav.classList.remove('faved'); }
  else                     { state.favs.add(jp);    dom.btnFav.classList.add('faved');    }
  saveFavs();
});

// ===== SPEECH =====
dom.btnSpeak.addEventListener('click', () => { if (state.current) speak(state.current.word.jp); });

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(text);
  utt.lang    = 'ja-JP';
  utt.rate    = 0.85;
  const voices  = window.speechSynthesis.getVoices();
  const jpVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jpVoice) utt.voice = jpVoice;
  window.speechSynthesis.speak(utt);
}
window.speechSynthesis && window.speechSynthesis.getVoices();

// ===== SUBMIT =====
dom.btnSubmit.addEventListener('click', checkAnswer);
dom.answerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  { e.preventDefault(); checkAnswer();   }
  if (e.key === 'Escape') { e.preventDefault(); skipQuestion(); }
});

function skipQuestion() {
  if (!state.answering) return;
  state.answering          = false;
  dom.answerInput.disabled = true;
  setTimeout(() => nextQuestion(), 300);
}

// ===== MODE & KATEGORI =====
dom.modeSelect.addEventListener('change', () => {
  state.mode = dom.modeSelect.value;
  saveSettings(); buildQueue(); nextQuestion();
});
dom.categorySelect.addEventListener('change', () => {
  state.category = dom.categorySelect.value;
  saveSettings(); buildQueue(); nextQuestion();
});

// ===== SEARCH PANEL =====
dom.btnSearch.addEventListener('click',  () => openPanel('search'));
dom.closeSearch.addEventListener('click', () => closePanel('search'));
dom.searchInput.addEventListener('input', () => renderSearch(dom.searchInput.value.trim().toLowerCase()));

function renderSearch(q) {
  if (!q) { dom.searchResults.innerHTML = '<div class="search-empty">Ketik untuk mencari kata…</div>'; return; }
  const res = VOCABULARY.filter(w =>
    w.jp.includes(q) || w.romaji.toLowerCase().includes(q) ||
    w.indo.toLowerCase().includes(q) || w.category.toLowerCase().includes(q)
  ).slice(0, 80);
  if (!res.length) { dom.searchResults.innerHTML = '<div class="search-empty">Tidak ditemukan 🔍</div>'; return; }
  dom.searchResults.innerHTML = res.map(w =>
    '<div class="search-item">' +
      '<div class="search-jp">' + w.jp + '</div>' +
      '<div class="search-info">' +
        '<span class="search-romaji">' + w.romaji + '</span>' +
        '<span class="search-indo">'   + w.indo   + '</span>' +
      '</div>' +
      '<span class="search-cat">' + capitalize(w.category) + '</span>' +
    '</div>'
  ).join('');
}

// ===== STATS PANEL =====
dom.btnStats.addEventListener('click',  () => { updateStatPanel(); openPanel('stats'); });
dom.closeStats.addEventListener('click', () => closePanel('stats'));

function updateStatPanel() {
  const { correct, wrong, bestStreak, total } = state.stats;
  dom.statCorrect.textContent  = correct;
  dom.statWrong.textContent    = wrong;
  dom.statStreak.textContent   = bestStreak;
  dom.statTotal.textContent    = total;
  dom.statAccuracy.textContent = (total > 0 ? Math.round((correct / total) * 100) : 0) + '%';
}

function openPanel(name) {
  (name === 'search' ? dom.panelSearch : dom.panelStats).classList.add('open');
  dom.overlay.classList.add('active');
  if (name === 'search') { renderSearch(''); setTimeout(() => dom.searchInput.focus(), 300); }
}

function closePanel(name) {
  (name === 'search' ? dom.panelSearch : dom.panelStats).classList.remove('open');
  dom.overlay.classList.remove('active');
  if (name === 'search') dom.searchInput.value = '';
}

dom.overlay.addEventListener('click', () => { closePanel('search'); closePanel('stats'); });

// ===== NAVIGASI SECTION =====
dom.btnTrain.addEventListener('click',       () => switchSection('train'));
dom.btnReviewWrong.addEventListener('click', () => switchSection('review'));
dom.btnFavList.addEventListener('click',     () => switchSection('favs'));
dom.btnLearned.addEventListener('click',     () => switchSection('learned'));
dom.btnReset.addEventListener('click', resetProgress);

const SECTIONS = {
  train:   dom.trainSection,
  review:  dom.reviewSection,
  favs:    dom.favsSection,
  learned: dom.learnedSection,
};

const NAV_BTNS = {
  train:   dom.btnTrain,
  review:  dom.btnReviewWrong,
  favs:    dom.btnFavList,
  learned: dom.btnLearned,
};

function switchSection(section) {
  state.section = section;

  // Sembunyikan semua section
  Object.values(SECTIONS).forEach(el => { el.style.display = 'none'; });
  // Hilangkan active dari semua nav
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Tampilkan section yang dipilih
  if (section === 'train') {
    dom.trainSection.style.display = '';   // flex dihandle CSS
    buildQueue();
    nextQuestion();
  } else if (section === 'review') {
    dom.reviewSection.style.display = 'flex';
    renderReviewList();
  } else if (section === 'favs') {
    dom.favsSection.style.display = 'flex';
    renderFavsList();
  } else if (section === 'learned') {
    dom.learnedSection.style.display = 'flex';
    renderLearnedList();
  }

  if (NAV_BTNS[section]) NAV_BTNS[section].classList.add('active');
}

// ===== RENDER: SOAL SALAH =====
function renderReviewList() {
  const el = dom.reviewSection;
  el.innerHTML = '';

  const wrongWords = VOCABULARY.filter(w => state.wrongs.has(w.jp));

  const header = document.createElement('div');
  header.className   = 'list-header';
  header.textContent = 'Soal Salah (' + wrongWords.length + ' kata)';
  el.appendChild(header);

  const scroll = document.createElement('div');
  scroll.className = 'list-scroll';

  if (!wrongWords.length) {
    scroll.innerHTML = '<div class="list-empty">✨ Belum ada kata yang salah!<br>Terus semangat belajar!</div>';
  } else {
    // Tombol latihan semua
    const btnAll = document.createElement('button');
    btnAll.className   = 'submit-btn';
    btnAll.style.cssText = 'width:100%;margin-bottom:10px;';
    btnAll.textContent = '▶ Latihan Semua Soal Salah (' + wrongWords.length + ')';
    btnAll.addEventListener('click', () => {
      state.pool = [...wrongWords];
      buildQueue();
      switchSection('train');
    });
    scroll.appendChild(btnAll);

    wrongWords.forEach(w => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML =
        '<div class="list-item-main">' +
          '<div class="list-item-jp">'  + w.jp   + '</div>' +
          '<div class="list-item-info">' +
            '<span class="list-item-romaji">' + w.romaji + '</span>' +
            '<span class="list-item-indo">'   + w.indo   + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="list-item-actions">' +
          '<button class="list-practice-btn" data-jp="' + w.jp + '">Latih</button>' +
        '</div>';
      item.querySelector('.list-practice-btn').addEventListener('click', () => {
        switchSection('train');
        state.queue = [w, w, w, ...shuffle(state.queue)];
        nextQuestion();
      });
      scroll.appendChild(item);
    });
  }

  el.appendChild(scroll);
}

// ===== RENDER: FAVORIT =====
function renderFavsList() {
  const el = dom.favsSection;
  el.innerHTML = '';

  const favWords = VOCABULARY.filter(w => state.favs.has(w.jp));

  const header = document.createElement('div');
  header.className   = 'list-header';
  header.textContent = 'Favorit (' + favWords.length + ' kata)';
  el.appendChild(header);

  const scroll = document.createElement('div');
  scroll.className = 'list-scroll';

  if (!favWords.length) {
    scroll.innerHTML = '<div class="list-empty">⭐ Belum ada favorit.<br>Tekan ikon bintang di kartu soal!</div>';
  } else {
    // Tombol latihan favorit
    const btnAll = document.createElement('button');
    btnAll.className     = 'submit-btn';
    btnAll.style.cssText = 'width:100%;margin-bottom:10px;';
    btnAll.textContent   = '▶ Latihan Kata Favorit (' + favWords.length + ')';
    btnAll.addEventListener('click', () => {
      state.pool = [...favWords];
      buildQueue();
      switchSection('train');
    });
    scroll.appendChild(btnAll);

    favWords.forEach(w => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML =
        '<div class="list-item-main">' +
          '<div class="list-item-jp">'  + w.jp   + '</div>' +
          '<div class="list-item-info">' +
            '<span class="list-item-romaji">' + w.romaji + '</span>' +
            '<span class="list-item-indo">'   + w.indo   + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="list-item-actions">' +
          '<button class="icon-btn small remove-fav" data-jp="' + w.jp + '" title="Hapus favorit">' +
            '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#e3b341" stroke="#e3b341"/></svg>' +
          '</button>' +
        '</div>';

      item.querySelector('.remove-fav').addEventListener('click', () => {
        state.favs.delete(w.jp); saveFavs();
        item.remove();
        header.textContent = 'Favorit (' + state.favs.size + ' kata)';
        btnAll.textContent = '▶ Latihan Kata Favorit (' + state.favs.size + ')';
        if (!state.favs.size) scroll.innerHTML = '<div class="list-empty">⭐ Belum ada favorit.</div>';
      });

      scroll.appendChild(item);
    });
  }

  el.appendChild(scroll);
}

// ===== RENDER: SUDAH DIPELAJARI =====
function renderLearnedList() {
  const el = dom.learnedSection;
  el.innerHTML = '';

  const learnedWords = VOCABULARY
    .filter(w => { const p = state.progress[w.jp]; return p && p.correct > 0; })
    .sort((a, b) => {
      const pa = state.progress[a.jp] || { correct: 0 };
      const pb = state.progress[b.jp] || { correct: 0 };
      return pb.correct - pa.correct;
    });

  // Header
  const header = document.createElement('div');
  header.className   = 'list-header';
  header.textContent = 'Sudah Dipelajari — ' + learnedWords.length + ' / ' + VOCABULARY.length + ' kata';
  el.appendChild(header);

  // Search filter
  const filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'padding:8px 16px 4px;flex-shrink:0;';
  filterWrap.innerHTML = '<input type="text" id="learnedFilter" placeholder="🔍 Cari kata…" autocomplete="off" style="width:100%;background:var(--card2);color:var(--text);border:1.5px solid var(--border);border-radius:10px;padding:9px 12px;font-size:0.85rem;font-family:inherit;outline:none;" />';
  el.appendChild(filterWrap);

  // Grid kartu
  const grid = document.createElement('div');
  grid.className = 'learned-scroll';
  el.appendChild(grid);

  if (!learnedWords.length) {
    grid.style.display = 'block';
    grid.innerHTML = '<div class="list-empty">📖 Belum ada kata yang dipelajari.<br><br>Jawab soal dengan benar untuk mengisi halaman ini!</div>';
    return;
  }

  renderLearnedCards(grid, learnedWords);

  // Filter realtime
  const fi = document.getElementById('learnedFilter');
  fi.addEventListener('input', () => {
    const q = fi.value.trim().toLowerCase();
    renderLearnedCards(grid, q
      ? learnedWords.filter(w =>
          w.jp.includes(q) || w.romaji.toLowerCase().includes(q) ||
          w.indo.toLowerCase().includes(q) || w.category.toLowerCase().includes(q))
      : learnedWords
    );
  });
  fi.addEventListener('focus', () => { fi.style.borderColor = 'var(--accent)'; });
  fi.addEventListener('blur',  () => { fi.style.borderColor = 'var(--border)'; });
}

function renderLearnedCards(container, words) {
  if (!words.length) {
    container.innerHTML = '<div class="list-empty" style="grid-column:1/-1">Tidak ditemukan 🔍</div>';
    return;
  }

  container.innerHTML = words.map(w => {
    const p = state.progress[w.jp] || { correct: 0, wrong: 0 };
    const isFav   = state.favs.has(w.jp);
    const isHafal = p.correct >= 5 && p.correct >= p.wrong * 2;

    const badgeBg  = isHafal ? 'rgba(63,185,80,0.15)'  : 'rgba(88,166,255,0.12)';
    const badgeClr = isHafal ? 'var(--green)' : 'var(--accent)';

    return (
      '<div class="learned-card">' +
        '<div class="learned-card-top">' +
          (isFav   ? '<span title="Favorit" style="font-size:0.7rem;line-height:1">⭐</span>' : '<span></span>') +
          (isHafal ? '<span style="font-size:0.6rem;font-weight:700;color:var(--green);letter-spacing:0.04em">HAFAL</span>' : '<span></span>') +
        '</div>' +
        '<div class="learned-jp">'     + w.jp     + '</div>' +
        '<div class="learned-romaji">' + w.romaji + '</div>' +
        '<div class="learned-indo">'   + w.indo   + '</div>' +
        '<div class="learned-cat">'    + capitalize(w.category) + '</div>' +
        '<div class="learned-count-badge" style="background:' + badgeBg + ';color:' + badgeClr + '">' +
          '✓ ' + p.correct + 'x &nbsp; ✗ ' + p.wrong + 'x' +
        '</div>' +
        '<button class="learned-speak-btn" data-text="' + w.jp + '" title="Dengarkan">🔊</button>' +
      '</div>'
    );
  }).join('');

  container.querySelectorAll('.learned-speak-btn').forEach(btn => {
    btn.addEventListener('click', () => speak(btn.dataset.text));
  });
}

// ===== RESET =====
function resetProgress() {
  if (!confirm('Reset semua progress, statistik, dan soal salah?\n(Favorit tetap tersimpan)')) return;
  state.stats    = { correct: 0, wrong: 0, streak: 0, bestStreak: 0, total: 0 };
  state.progress = {};
  state.wrongs.clear();
  saveStats(); saveWrongs();
  updateHeader(); updateProgressBar();
  buildQueue(); switchSection('train');
}

// ===== KEYBOARD =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (dom.panelSearch.classList.contains('open')) { closePanel('search'); return; }
    if (dom.panelStats.classList.contains('open'))  { closePanel('stats');  return; }
  }
});

// ===== INIT =====
function init() {
  loadStorage();
  dom.modeSelect.value = state.mode;
  buildCategorySelect();

  // Sembunyikan semua section non-train
  dom.reviewSection.style.display  = 'none';
  dom.favsSection.style.display    = 'none';
  dom.learnedSection.style.display = 'none';
  dom.trainSection.style.display   = '';

  updateHeader();
  buildQueue();
  nextQuestion();
}

init();

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(r => console.log('SW ok', r.scope))
      .catch(e => console.warn('SW err', e));
  });
}