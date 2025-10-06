'use strict';

// Configuration
const LIBRARY_STORAGE_KEY = 'pokescan.library.v1';
const POKEMON_TCG_API_URL = 'https://api.pokemontcg.io/v2/cards';
// Optional: set an API key here if you have one. It's okay to leave null.
const POKEMON_TCG_API_KEY = null; // e.g. 'your-api-key'

// State
const appState = {
  library: { version: 1, cards: [] },
  cameraStream: null,
  capturedDataUrl: null,
  lastOcrText: '',
  lastQuery: '',
  lastResults: [],
};

// DOM refs
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindGlobalEvents();
  loadLibrary();
  renderLibrary();
});

function cacheElements() {
  elements = {
    // Header / toolbar
    openScanBtn: $('#open-scan-btn'),
    emptyScanBtn: $('#empty-scan-btn'),
    toolbarScanBtn: $('#toolbar-scan-btn'),
    filterInput: $('#filter-input'),

    // Sections
    emptyState: $('#empty-state'),
    librarySection: $('#library-section'),
    libraryGrid: $('#library-grid'),

    // Scanner modal
    scannerModal: $('#scanner-modal'),
    cameraVideo: $('#camera-video'),
    captureCanvas: $('#capture-canvas'),
    captureBtn: $('#capture-btn'),
    retakeBtn: $('#retake-btn'),
    ocrBtn: $('#ocr-btn'),
    ocrProgress: $('#ocr-progress'),
    ocrProgressBar: $('#ocr-progress .progress-bar'),
    ocrProgressText: $('#ocr-progress .progress-text'),

    // Results modal
    resultsModal: $('#results-modal'),
    resultsQuery: $('#results-query'),
    resultsSearchBtn: $('#results-search-btn'),
    resultsList: $('#results-list'),

    // Details modal
    detailsModal: $('#details-modal'),
    detailsBody: $('#details-body'),

    // Toast
    toast: $('#toast'),
  };
}

function bindGlobalEvents() {
  // Scan buttons
  [elements.openScanBtn, elements.emptyScanBtn, elements.toolbarScanBtn].forEach((btn) => {
    btn?.addEventListener('click', openScanner);
  });

  // Filter in library
  elements.filterInput?.addEventListener('input', () => {
    renderLibrary(elements.filterInput.value.trim());
  });

  // Modal close buttons
  $$('[data-close]')?.forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('data-close');
      if (target === 'scanner') closeScanner();
      if (target === 'results') closeResults();
      if (target === 'details') closeDetails();
    });
  });

  // Scanner actions
  elements.captureBtn?.addEventListener('click', onCaptureFrame);
  elements.retakeBtn?.addEventListener('click', onRetake);
  elements.ocrBtn?.addEventListener('click', onRunOcr);

  // Search results actions
  elements.resultsSearchBtn?.addEventListener('click', () => runSearch(elements.resultsQuery.value.trim()));
  elements.resultsQuery?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch(elements.resultsQuery.value.trim());
  });
}

// Library persistence
function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.cards)) {
        appState.library = parsed;
      }
    }
  } catch (err) { /* ignore broken storage */ }
}

function saveLibrary() {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(appState.library));
}

function renderLibrary(filterQuery = '') {
  const cards = appState.library.cards;
  const hasCards = cards.length > 0;

  elements.emptyState.hidden = hasCards;
  elements.librarySection.hidden = !hasCards;

  if (!hasCards) return;

  const normalizedQuery = filterQuery.toLowerCase();
  const filtered = normalizedQuery
    ? cards.filter((c) =>
        c.name.toLowerCase().includes(normalizedQuery) ||
        c.setName?.toLowerCase().includes(normalizedQuery) ||
        c.number?.toLowerCase().includes(normalizedQuery)
      )
    : cards;

  elements.libraryGrid.innerHTML = '';
  for (const card of filtered) {
    const tile = createLibraryTile(card);
    elements.libraryGrid.appendChild(tile);
  }
}

function createLibraryTile(card) {
  const root = document.createElement('div');
  root.className = 'card';

  const media = document.createElement('div');
  media.className = 'media';
  const img = document.createElement('img');
  img.src = card.imageSmallUrl || card.imageLargeUrl;
  img.alt = `${card.name} (${card.setName} #${card.number})`;
  media.appendChild(img);

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = formatPrice(getDisplayPrice(card));
  media.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'body';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = card.name;

  const subtitle = document.createElement('div');
  subtitle.className = 'subtle';
  subtitle.textContent = `${card.setName} • #${card.number}`;

  const row = document.createElement('div');
  row.className = 'row';

  const qty = document.createElement('div');
  qty.className = 'qty-controls';
  const dec = document.createElement('button');
  dec.textContent = '−';
  const qv = document.createElement('span');
  qv.textContent = String(card.quantity ?? 1);
  const inc = document.createElement('button');
  inc.textContent = '+';
  qty.append(dec, qv, inc);

  const more = document.createElement('button');
  more.className = 'btn';
  more.textContent = 'Details';

  row.append(qty, more);
  body.append(title, subtitle, row);

  root.append(media, body);

  // Events
  dec.addEventListener('click', (e) => {
    e.stopPropagation();
    setCardQuantity(card.id, Math.max(0, (card.quantity ?? 1) - 1));
    qv.textContent = String(card.quantity ?? 1);
    if ((card.quantity ?? 1) === 0) {
      removeCardFromLibrary(card.id);
      renderLibrary(elements.filterInput?.value.trim() || '');
    } else {
      media.querySelector('.badge').textContent = formatPrice(getDisplayPrice(card));
    }
  });
  inc.addEventListener('click', (e) => {
    e.stopPropagation();
    setCardQuantity(card.id, (card.quantity ?? 1) + 1);
    qv.textContent = String(card.quantity ?? 1);
  });
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    openDetails(card);
  });

  root.addEventListener('click', () => openDetails(card));

  return root;
}

function setCardQuantity(cardId, quantity) {
  const card = appState.library.cards.find((c) => c.id === cardId);
  if (!card) return;
  card.quantity = quantity;
  saveLibrary();
}

function removeCardFromLibrary(cardId) {
  appState.library.cards = appState.library.cards.filter((c) => c.id !== cardId);
  saveLibrary();
}

// Scanner / OCR
async function openScanner() {
  showModal(elements.scannerModal);
  elements.captureCanvas.hidden = true;
  elements.ocrBtn.hidden = true;
  elements.retakeBtn.hidden = true;
  elements.captureBtn.hidden = false;
  elements.ocrProgress.hidden = true;
  elements.cameraVideo.hidden = false;
  appState.capturedDataUrl = null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    appState.cameraStream = stream;
    elements.cameraVideo.srcObject = stream;
    await elements.cameraVideo.play();
  } catch (err) {
    toast('Camera access denied. You can still search by name.');
    closeScanner();
    openResults('');
  }
}

function closeScanner() {
  hideModal(elements.scannerModal);
  if (appState.cameraStream) {
    for (const track of appState.cameraStream.getTracks()) track.stop();
    appState.cameraStream = null;
  }
}

function onCaptureFrame() {
  if (!elements.cameraVideo.videoWidth) return;
  const canvas = elements.captureCanvas;
  const video = elements.cameraVideo;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const targetWidth = video.videoWidth;
  const targetHeight = video.videoHeight;
  canvas.width = targetWidth; canvas.height = targetHeight;
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  appState.capturedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  elements.captureCanvas.hidden = false;
  elements.cameraVideo.hidden = true;
  elements.ocrBtn.hidden = false;
  elements.retakeBtn.hidden = false;
  elements.captureBtn.hidden = true;
}

function onRetake() {
  elements.captureCanvas.hidden = true;
  elements.ocrBtn.hidden = true;
  elements.retakeBtn.hidden = true;
  elements.captureBtn.hidden = false;
  elements.cameraVideo.hidden = false;
  elements.ocrProgress.hidden = true;
  elements.ocrProgressBar.style.width = '0%';
  elements.ocrProgressText.textContent = 'Analyzing image…';
  appState.capturedDataUrl = null;
}

async function onRunOcr() {
  if (!appState.capturedDataUrl) return;
  elements.ocrProgress.hidden = false;
  elements.ocrProgressBar.style.width = '0%';
  elements.ocrProgressText.textContent = 'Analyzing image…';

  try {
    const { data } = await Tesseract.recognize(appState.capturedDataUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress) {
          elements.ocrProgressBar.style.width = `${Math.round(m.progress * 100)}%`;
          elements.ocrProgressText.textContent = `Analyzing image… ${Math.round(m.progress * 100)}%`;
        }
      },
    });
    appState.lastOcrText = data?.text ?? '';
    const guess = guessCardNameFromText(appState.lastOcrText);
    closeScanner();
    openResults(guess);
    if (!guess) toast('OCR complete. Please type the card name.');
  } catch (err) {
    console.error(err);
    toast('OCR failed. Please try again or type the card name.');
    closeScanner();
    openResults('');
  }
}

function guessCardNameFromText(text) {
  if (!text) return '';
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2 && /[A-Za-z]/.test(l));

  const banned = new Set(['BASIC','STAGE 1','STAGE 2','VSTAR','V-UNION','TRAINER','SUPPORTER','ITEM','STADIUM','ENERGY','HP','ABILITY','ATTACK','RAPID STRIKE','SINGLE STRIKE','FUSION STRIKE']);

  // Prefer first line that looks like a proper name (letters/spaces, few digits)
  for (const line of lines) {
    const upper = line.toUpperCase();
    if ([...banned].some((b) => upper.includes(b))) continue;
    const hasTooManyDigits = (line.match(/\d/g) || []).length > 2;
    if (hasTooManyDigits) continue;
    const tooLong = line.length > 32;
    if (tooLong) continue;
    // Likely candidate
    return line.replace(/[^A-Za-z0-9'\-\s]/g, '').trim();
  }
  return '';
}

// Search / results
function openResults(initialQuery) {
  elements.resultsQuery.value = initialQuery || '';
  elements.resultsList.innerHTML = '';
  showModal(elements.resultsModal);
  if (initialQuery && initialQuery.length >= 2) {
    runSearch(initialQuery);
  }
}

function closeResults() {
  hideModal(elements.resultsModal);
}

async function runSearch(query) {
  const q = (query || '').trim();
  if (!q) {
    elements.resultsList.innerHTML = '<div class="subtle">Type a name to search the market…</div>';
    return;
  }
  appState.lastQuery = q;
  elements.resultsList.innerHTML = '<div class="subtle">Searching…</div>';
  try {
    // Prefer exact quoted name, then fallback to unquoted
    let results = await searchCardsByName(q, true);
    if (results.length === 0) results = await searchCardsByName(q, false);
    appState.lastResults = results;
    if (results.length === 0) {
      elements.resultsList.innerHTML = '<div class="subtle">No results. Try fewer words or a different name.</div>';
      return;
    }
    renderResults(results);
  } catch (err) {
    console.error(err);
    elements.resultsList.innerHTML = '<div class="subtle">Search failed. Please try again.</div>';
  }
}

async function searchCardsByName(name, exact = false) {
  const headers = { 'Accept': 'application/json' };
  if (POKEMON_TCG_API_KEY) headers['X-Api-Key'] = POKEMON_TCG_API_KEY;
  const quoted = exact ? `"${name.replace(/\"/g, '')}"` : name;
  const params = new URLSearchParams({
    q: `name:${quoted}`,
    orderBy: '-set.releaseDate',
    select: [
      'id','name','number','rarity','supertype','subtypes',
      'set','images','tcgplayer','cardmarket'
    ].join(',')
  });
  const resp = await fetch(`${POKEMON_TCG_API_URL}?${params.toString()}`, { headers });
  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  const data = await resp.json();
  return data?.data || [];
}

function renderResults(results) {
  elements.resultsList.innerHTML = '';
  for (const card of results) {
    const item = document.createElement('div');
    item.className = 'result-card';

    const img = document.createElement('img');
    img.src = card.images?.small || card.images?.large;
    img.alt = card.name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = card.name;

    const sub = document.createElement('div');
    sub.className = 'muted';
    sub.textContent = `${card.set?.name || 'Unknown set'} • #${card.number || '?'}${card.rarity ? ' • ' + card.rarity : ''}`;

    const prices = document.createElement('div');
    prices.className = 'muted';
    const priceInfo = getBestPrices(card);
    prices.textContent = priceInfo.summary;

    const actions = document.createElement('div');
    actions.className = 'result-actions';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = 'Add to library';

    addBtn.addEventListener('click', () => {
      addCardToLibraryFromApi(card, priceInfo.preferredKey);
      closeResults();
      toast('Card added to your library');
      renderLibrary(elements.filterInput?.value.trim() || '');
    });

    meta.append(name, sub, prices, actions);
    actions.append(addBtn);
    item.append(img, meta);
    elements.resultsList.appendChild(item);
  }
}

function addCardToLibraryFromApi(card, selectedPriceKey = null) {
  const existing = appState.library.cards.find((c) => c.id === card.id);
  if (existing) {
    existing.quantity = (existing.quantity ?? 1) + 1;
    saveLibrary();
    return;
  }
  const entry = {
    id: card.id,
    name: card.name,
    number: card.number || '',
    setId: card.set?.id || '',
    setName: card.set?.name || '',
    rarity: card.rarity || '',
    imageSmallUrl: card.images?.small || '',
    imageLargeUrl: card.images?.large || '',
    tcgplayerPrices: card.tcgplayer?.prices || null,
    cardmarketPrices: card.cardmarket?.prices || null,
    selectedPriceKey: selectedPriceKey,
    quantity: 1,
    dateAdded: new Date().toISOString(),
  };
  appState.library.cards.unshift(entry);
  saveLibrary();
}

function getBestPrices(apiCard) {
  const prices = apiCard.tcgplayer?.prices || null;
  const variants = ['normal','holofoil','reverseHolofoil','1stEdition','1stEditionHolofoil'];
  let bestKey = null; let best = null; const parts = [];
  for (const key of variants) {
    const p = prices?.[key];
    if (!p) continue;
    const val = p.market ?? p.mid ?? p.low ?? null;
    if (val != null) {
      parts.push(`${labelForVariant(key)} ${formatPrice(val)}`);
      if (best == null || val > best) { best = val; bestKey = key; }
    }
  }
  if (parts.length === 0 && apiCard.cardmarket?.prices?.averageSellPrice) {
    parts.push(`Cardmarket ${formatPrice(apiCard.cardmarket.prices.averageSellPrice)}`);
  }
  return { summary: parts.join(' • ') || 'No price data', preferredKey: bestKey };
}

function labelForVariant(key) {
  switch (key) {
    case 'normal': return 'Normal';
    case 'holofoil': return 'Holo';
    case 'reverseHolofoil': return 'Reverse Holo';
    case '1stEdition': return '1st Ed.';
    case '1stEditionHolofoil': return '1st Ed. Holo';
    default: return key;
  }
}

function getDisplayPrice(card) {
  const prices = card.tcgplayerPrices || null;
  if (!prices) return null;
  const preferred = card.selectedPriceKey && prices[card.selectedPriceKey];
  const variant = preferred || prices.normal || prices.holofoil || prices.reverseHolofoil;
  if (!variant) return null;
  return variant.market ?? variant.mid ?? variant.low ?? null;
}

function formatPrice(num) {
  if (num == null) return '—';
  return `$${Number(num).toFixed(2)}`;
}

// Details modal
function openDetails(card) {
  elements.detailsBody.innerHTML = '';

  const header = document.createElement('div');
  header.style.display = 'grid';
  header.style.gridTemplateColumns = '140px 1fr auto';
  header.style.gap = '12px';

  const img = document.createElement('img');
  img.src = card.imageSmallUrl || card.imageLargeUrl;
  img.alt = card.name;
  img.style.width = '140px';
  img.style.borderRadius = '12px';

  const meta = document.createElement('div');
  const name = document.createElement('div');
  name.style.fontWeight = '700';
  name.style.fontSize = '18px';
  name.textContent = card.name;
  const sub = document.createElement('div');
  sub.className = 'subtle';
  sub.textContent = `${card.setName} • #${card.number}${card.rarity ? ' • ' + card.rarity : ''}`;

  const priceRow = document.createElement('div');
  priceRow.style.display = 'flex';
  priceRow.style.flexWrap = 'wrap';
  priceRow.style.gap = '8px';

  const pills = buildPricePills(card);
  pills.forEach((p) => priceRow.appendChild(p));

  meta.append(name, sub, priceRow);

  const actions = document.createElement('div');
  actions.style.display = 'grid';
  actions.style.justifyItems = 'end';
  const del = document.createElement('button');
  del.className = 'btn';
  del.style.borderColor = 'var(--danger)';
  del.textContent = 'Remove';
  del.addEventListener('click', () => {
    removeCardFromLibrary(card.id);
    closeDetails();
    renderLibrary(elements.filterInput?.value.trim() || '');
    toast('Removed from library');
  });
  actions.appendChild(del);

  header.append(img, meta, actions);
  elements.detailsBody.appendChild(header);

  showModal(elements.detailsModal);
}

function closeDetails() { hideModal(elements.detailsModal); }

function buildPricePills(card) {
  const pills = [];
  const map = card.tcgplayerPrices || {};
  const keys = Object.keys(map);
  for (const key of keys) {
    const p = map[key];
    const val = p.market ?? p.mid ?? p.low ?? null;
    if (val == null) continue;
    const pill = document.createElement('button');
    pill.className = 'price-pill';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = labelForVariant(key);
    const value = document.createElement('span');
    value.textContent = formatPrice(val);
    pill.append(label, value);
    pill.addEventListener('click', () => {
      const target = appState.library.cards.find((c) => c.id === card.id);
      if (!target) return;
      target.selectedPriceKey = key;
      saveLibrary();
      toast(`Using ${labelForVariant(key)} price for display`);
      renderLibrary(elements.filterInput?.value.trim() || '');
    });
    pills.push(pill);
  }
  if (pills.length === 0 && card.cardmarketPrices?.averageSellPrice) {
    const pill = document.createElement('div');
    pill.className = 'price-pill';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Cardmarket';
    const value = document.createElement('span');
    value.textContent = formatPrice(card.cardmarketPrices.averageSellPrice);
    pill.append(label, value);
    pills.push(pill);
  }
  return pills;
}

// Modal helpers
function showModal(el) {
  el.hidden = false; el.setAttribute('aria-hidden', 'false');
}
function hideModal(el) {
  el.hidden = true; el.setAttribute('aria-hidden', 'true');
}

// Toast helper
let toastTimer = null;
function toast(message, timeoutMs = 1800) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, timeoutMs);
}
