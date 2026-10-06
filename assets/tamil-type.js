/* Tamil typing help for children with only an English keyboard.
   1. English-letter typing: "veedu" becomes வீடு in the box as they type (a phonetic scheme like
      Google's: aa ஆ, ee/ii ஈ, oo/uu ஊ, E ஏ, O ஓ, ai ஐ, zh ழ, L ள, N ண, R ற, n ந/ன by position).
      Word suggestions underneath come from the page's own word and phrase lists, so "amma" offers அம்மா.
   2. A small on-screen Tamil keyboard: vowels, consonants, then the 12 forms of the consonant tapped.
   Everything runs on the device. Letters typed with a real Tamil keyboard are never touched.
   Use: TamilType.init({fields, on, vocab}) — see katturai.html. */
(function () {
'use strict';

/* ---------- English letters → Tamil ---------- */
var V = { /* vowel: [independent, sign] */
  a: ['அ', ''], aa: ['ஆ', 'ா'], A: ['ஆ', 'ா'], i: ['இ', 'ி'], ii: ['ஈ', 'ீ'], ee: ['ஈ', 'ீ'], I: ['ஈ', 'ீ'],
  u: ['உ', 'ு'], uu: ['ஊ', 'ூ'], oo: ['ஊ', 'ூ'], U: ['ஊ', 'ூ'], e: ['எ', 'ெ'], E: ['ஏ', 'ே'],
  ai: ['ஐ', 'ை'], o: ['ஒ', 'ொ'], O: ['ஓ', 'ோ'], au: ['ஔ', 'ௌ'], ou: ['ஔ', 'ௌ']
};
var C = { /* letters → consonants; the last one takes the vowel that follows */
  k: 'க', g: 'க', ng: 'ஙக', nk: 'ஙக', c: 'ச', ch: 'ச', s: 'ச', S: 'ஸ', j: 'ஜ', nj: 'ஞச', nch: 'ஞச',
  t: 'ட', T: 'ட', d: 'ட', D: 'ட', nt: 'ணட', nd: 'ணட', N: 'ண', th: 'த', dh: 'த', tth: 'தத', nth: 'நத', ndh: 'நத',
  p: 'ப', b: 'ப', f: 'ஃப', m: 'ம', y: 'ய', r: 'ர', R: 'ற', tr: 'றற', nr: 'னற', ndr: 'னற', l: 'ல', L: 'ள', zh: 'ழ', z: 'ழ',
  v: 'வ', w: 'வ', n: 'ன', nn: 'னன', sh: 'ஷ', Sh: 'ஷ', h: 'ஹ', x: 'கஸ', ksh: 'கஷ', q: 'ஃ'
};
var PULLI = '்';
var TOK = Object.keys(V).concat(Object.keys(C)).sort(function (a, b) { return b.length - a.length; });

function tamil(src) {
  var out = '', pend = '', i = 0;
  while (i < src.length) {
    var t = null;
    for (var j = 0; j < TOK.length; j++) if (src.substr(i, TOK[j].length) === TOK[j]) { t = TOK[j]; break; }
    if (!t) { out += pend ? pend + PULLI : ''; pend = ''; out += src[i]; i++; continue; }
    if (V[t]) { out += pend ? pend + V[t][1] : V[t][0]; pend = ''; }
    else if (t === 'q') { out += (pend ? pend + PULLI : '') + 'ஃ'; pend = ''; }
    else {
      var cs = C[t];
      if (i === 0 && t === 'n') cs = 'ந';            /* நான், நன்றி: ந starts a word, ன elsewhere */
      if (i === 0 && t === 'tr') cs = 'டர';
      if (i === 0 && t === 'nn') cs = 'நன';
      if (cs === 'ஃப') { out += (pend ? pend + PULLI : '') + 'ஃ'; pend = 'ப'; i += t.length; continue; }
      if (pend) out += pend + PULLI;
      var a = Array.from(cs);
      for (var k = 0; k < a.length - 1; k++) out += a[k] + PULLI;
      pend = a[a.length - 1];
    }
    i += t.length;
  }
  return out + (pend ? pend + PULLI : '');
}

/* ---------- loose sound keys, so "amma", "ammaa" and அம்மா all meet ---------- */
var KC = { 'க': 'k', 'ங': 'n', 'ச': 's', 'ஞ': 'n', 'ட': 't', 'ண': 'n', 'த': 't', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y',
  'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'l', 'ள': 'l', 'ற': 'r', 'ன': 'n', 'ஜ': 's', 'ஷ': 's', 'ஸ': 's', 'ஹ': 'h' };
var KV = { 'அ': 'a', 'ஆ': 'a', 'இ': 'i', 'ஈ': 'i', 'உ': 'u', 'ஊ': 'u', 'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au',
  'ா': 'a', 'ி': 'i', 'ீ': 'i', 'ு': 'u', 'ூ': 'u', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au', 'ௗ': '' };
var SIGN = /[\u0BBE-\u0BCD\u0BD7]/;
var squash = function (s) { return s.replace(/(.)\1+/g, '$1'); };
/* e/i and o/u are merged too: children write ஓ as "oo" and ஏ as "ee" as often as ஊ and ஈ */
var loose = function (s) { return squash(squash(s).replace(/ai/g, 'Y').replace(/au/g, 'W').replace(/e/g, 'i').replace(/o/g, 'u')); };
function keyTa(w) {
  var s = '', a = Array.from(w);
  for (var i = 0; i < a.length; i++) {
    var ch = a[i], nx = a[i + 1];
    if (KC[ch]) { s += KC[ch]; if (nx === PULLI) i++; else if (!nx || !SIGN.test(nx)) s += 'a'; }
    else if (ch in KV) s += KV[ch];
  }
  return loose(s);
}
function keyEn(w) {
  return loose(w.toLowerCase().replace(/ndr/g, 'nr').replace(/(\w)tr/g, '$1r').replace(/ksh/g, 'ks').replace(/nch/g, 'ns').replace(/nj/g, 'ns')
    .replace(/ng/g, 'nk').replace(/[td]h/g, 't').replace(/zh/g, 'l').replace(/[cs]h/g, 's').replace(/ee/g, 'i').replace(/oo/g, 'u')
    .replace(/ou/g, 'au').replace(/[cj]/g, 's').replace(/z/g, 'l').replace(/g/g, 'k').replace(/d/g, 't').replace(/[bf]/g, 'p')
    .replace(/w/g, 'v').replace(/x/g, 'ks').replace(/q/g, '').replace(/[^a-z]/g, ''));
}

/* ---------- on-screen keyboard data ---------- */
var VOWELS = 'அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ ஃ'.split(' ');
var CONS = 'க ங ச ஞ ட ண த ந ப ம ய ர ல வ ழ ள ற ன ஜ ஷ ஸ ஹ'.split(' ');
var SIGNS = ['', 'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ', PULLI];
var LATIN = /^[A-Za-z]+$/;
var TA = /[஀-௿]/;

var cfg, bar, kb, field = null, st = null, snap = null, busy = false, kbCons = 'க', kbLast = null, pref = {};
try { pref = JSON.parse(localStorage.getItem('tamil-type') || '{}'); } catch (e) {}
var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
var group = function (el) { return (el.dataset.k || el.id || '').split('.')[0]; };
var isOn = function (el) { var g = group(el); return g in pref ? pref[g] : cfg.on(el); };

function setAttrs(el) {
  var on = isOn(el);
  ['autocapitalize', 'autocorrect', 'spellcheck', 'autocomplete'].forEach(function (a) {
    if (on) { if (!el.hasAttribute('data-tt-' + a)) el.setAttribute('data-tt-' + a, el.getAttribute(a) || ''); el.setAttribute(a, a === 'spellcheck' ? 'false' : 'off'); }
    else if (el.hasAttribute('data-tt-' + a)) { var v = el.getAttribute('data-tt-' + a); v ? el.setAttribute(a, v) : el.removeAttribute(a); el.removeAttribute('data-tt-' + a); }
  });
}

/* replace [a,b) of the field with text, put the caret at the end of it, and tell the page */
function put(el, a, b, text) {
  busy = true;
  el.setRangeText(text, a, b, 'end');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  busy = false;
}

/* Latin letters just typed at [a,c): carry on the word in progress, or start a new one */
function convert(el, a, c) {
  var v = el.value, add = v.slice(a, c), start = a, src = add;
  if (st && st.el === el && st.end === a && v.slice(st.start, st.end) === st.ta) { start = st.start; src = st.src + add; }
  var ta = tamil(src);
  put(el, start, c, ta);
  st = { el: el, start: start, end: start + ta.length, src: src, ta: ta };
}

function onBefore(e) {
  if (!field || e.target !== field) return;
  snap = { v: field.value, s: field.selectionStart, e: field.selectionEnd };
}

function onInput(e) {
  var el = e.target;
  if (busy || el !== field) return;
  if (!isOn(el)) { st = null; return; }
  var t = e.inputType || '', c = el.selectionStart;
  if (e.isComposing) { suggest(latinBefore(el)); return; } /* Android: convert when the word is committed */
  if (t === 'insertText' && e.data) {
    var m = /^([A-Za-z]+)([^A-Za-z]*)$/.exec(e.data);
    if (m) { var end = c - m[2].length; if (el.value.slice(end - m[1].length, end) === m[1]) {
      convert(el, end - m[1].length, end);
      if (m[2]) { el.setSelectionRange(st.end + m[2].length, st.end + m[2].length); st = null; }
      suggest(st && st.src); return;
    } }
  }
  if (t === 'deleteContentBackward' && st && st.el === el && snap && snap.s === snap.e && snap.s === st.end &&
      snap.v.slice(st.start, st.end) === st.ta) { /* backspace takes off the last English letter */
    var src = st.src.slice(0, -1), ta = tamil(src);
    busy = true; el.value = snap.v; busy = false;
    put(el, st.start, st.end, ta);
    st = src ? { el: el, start: st.start, end: st.start + ta.length, src: src, ta: ta } : null;
    suggest(st && st.src); return;
  }
  st = null; suggest('');
}

function onCompEnd(e) {
  var el = e.target;
  if (el !== field || !isOn(el) || !e.data) return;
  setTimeout(function () { /* after the browser has committed the text */
    var c = el.selectionStart, m = /^([A-Za-z]+)([^A-Za-z]*)$/.exec(e.data);
    if (!m) { st = null; suggest(''); return; }
    var end = c - m[2].length;
    if (el.value.slice(end - m[1].length, end) !== m[1]) return;
    convert(el, end - m[1].length, end);
    if (m[2]) { el.setSelectionRange(st.end + m[2].length, st.end + m[2].length); st = null; }
    suggest(st && st.src);
  }, 0);
}

function latinBefore(el) { var m = /[A-Za-z]+$/.exec(el.value.slice(0, el.selectionStart)); return m ? m[0] : ''; }

/* ---------- suggestions ---------- */
var vocab = null;
function words() {
  if (!vocab) {
    vocab = [];
    var seen = {};
    cfg.vocab().forEach(function (w) {
      w = String(w || '').replace(/[.,!?;:"“”‘’'()\-]+/g, ' ').trim();
      if (!w || !TA.test(w) || seen[w]) return;
      seen[w] = 1; vocab.push({ t: w, k: keyTa(w) });
    });
  }
  return vocab;
}
function matches(src) {
  if (!src || src.length < 2) return [];
  var k = keyEn(src), lo = src.toLowerCase(), out = [], seen = {}, cur = st && st.ta;
  if (k.length < 2) return [];
  var pri = (cfg.priority ? cfg.priority() : []).map(function (w) { return { t: w, k: keyTa(w), p: 0 }; });
  pri.concat(words().map(function (w) { return { t: w.t, k: w.k, p: 1 }; })).forEach(function (w) {
    if (seen[w.t] || w.t === cur || w.k.indexOf(k) !== 0) return;
    seen[w.t] = 1; out.push({ t: w.t, s: (w.k === k ? 0 : 2) + w.p + w.k.length / 100 });
  });
  if (lo.length >= 3 && cfg.meanings) cfg.meanings().forEach(function (x) {
    if (seen[x.t] || !x.e.toLowerCase().split(/\s*,\s*/).some(function (m) { return m.indexOf(lo) === 0; })) return;
    seen[x.t] = 1; out.push({ t: x.t, e: x.e, s: 1.5 });
  });
  return out.sort(function (a, b) { return a.s - b.s; }).slice(0, 6);
}
function suggest(src) {
  var box = bar && bar.querySelector('.tt-sug');
  if (!box) return;
  var composing = field && src && field.value.slice(0, field.selectionStart).slice(-src.length) === src && !(st && st.src === src);
  var M = matches(src), html = '';
  if (composing) html += '<button type="button" class="tt-w now" data-tts="' + esc(tamil(src)) + '" data-ttn="' + src.length + '">' + esc(tamil(src)) + '</button>';
  html += M.map(function (m) { return '<button type="button" class="tt-w" data-tts="' + esc(m.t) + '"' + (composing ? ' data-ttn="' + src.length + '"' : '') + '>' + esc(m.t) + (m.e ? '<small>' + esc(m.e.split(',')[0]) + '</small>' : '') + '</button>'; }).join('');
  box.innerHTML = html;
  box.hidden = !html;
}
function pick(b) {
  var el = field; if (!el) return;
  var w = b.dataset.tts, c = el.selectionStart, a;
  if (b.dataset.ttn) a = c - +b.dataset.ttn;
  else if (st && st.el === el && st.end === c) a = st.start;
  else a = c - latinBefore(el).length;
  var after = el.value.slice(c, c + 1);
  st = null;
  put(el, a, c, w + (after && /\s/.test(after) ? '' : ' '));
  el.focus(); suggest('');
}

/* ---------- the bar under the field ---------- */
function barHtml(el) {
  var on = isOn(el), kbOpen = kb && !kb.hidden;
  return '<div class="tt-row">' +
    '<button type="button" class="tt-mode" data-tt="mode" aria-pressed="' + on + '">' + (on ? 'அ English → Tamil: on' : 'A English → Tamil: off') + '</button>' +
    '<button type="button" class="tt-kbb" data-tt="kb" aria-pressed="' + kbOpen + '">⌨ தமிழ் keyboard</button></div>' +
    '<p class="tt-hint">' + (on ? 'Type the sounds in English: <b>veedu</b> → வீடு, <b>ammaa</b> → அம்மா. Double a vowel to make it long. Tap a word below to use it.'
      : 'Letters stay as you type them. Tap the button to type Tamil with English letters.') + '</p>' +
    '<div class="tt-sug" hidden></div>';
}
function place(el) {
  if (!bar) { bar = document.createElement('div'); bar.className = 'tt-bar noprint'; bar.addEventListener('mousedown', keep); }
  bar.innerHTML = barHtml(el);
  var at = el.parentElement && el.parentElement.classList.contains('row') ? el.parentElement : el;
  if (bar.previousElementSibling !== at || !bar.isConnected) at.insertAdjacentElement('afterend', bar);
  setAttrs(el);
}
function keep(e) { if (e.target.closest('button')) e.preventDefault(); } /* tapping a key keeps the caret in the box */

/* ---------- on-screen Tamil keyboard ---------- */
function kbHtml() {
  var key = function (t, attr, cls) { return '<button type="button" class="tt-k' + (cls ? ' ' + cls : '') + '" ' + attr + '>' + t + '</button>'; };
  return '<div class="tt-kbhead"><span>தமிழ் keyboard <small>tap a letter, then its shape</small></span>' + key('ABC ✕', 'data-tt="close"', 'tt-close') + '</div>' +
    '<div class="tt-forms" aria-label="Shapes of ' + kbCons + '">' + SIGNS.map(function (s) { return key(kbCons + s, 'data-ttf="' + kbCons + s + '"', 'tt-f'); }).join('') + '</div>' +
    '<div class="tt-keys">' + VOWELS.map(function (x) { return key(x, 'data-ttk="' + x + '"', 'tt-v'); }).join('') +
    CONS.map(function (x) { return key(x, 'data-ttc="' + x + '"', x === kbCons ? 'tt-c on' : 'tt-c'); }).join('') + '</div>' +
    '<div class="tt-keys tt-bot">' + key('⌫', 'data-tt="bs" aria-label="Delete"') + key('space', 'data-ttk=" "', 'tt-sp') + key('.', 'data-ttk="."') + key(',', 'data-ttk=","') +
    (field && field.tagName === 'TEXTAREA' ? key('↵', 'data-ttk="\n" aria-label="New line"') : '') + '</div>';
}
function kbShow(open) {
  if (!kb) { kb = document.createElement('div'); kb.className = 'tt-kb noprint'; kb.setAttribute('role', 'group'); kb.setAttribute('aria-label', 'Tamil keyboard');
    kb.addEventListener('mousedown', keep); document.body.appendChild(kb); }
  kb.hidden = !open; kbLast = null;
  document.body.classList.toggle('tt-kbopen', open);
  if (field) { if (open) field.setAttribute('inputmode', 'none'); else field.removeAttribute('inputmode'); }
  if (open) { kb.innerHTML = kbHtml(); if (field) { field.focus(); field.scrollIntoView({ block: 'center' }); } }
  if (field) place(field);
}
function kbType(text, replaceLast) {
  var el = field; if (!el) return;
  var c = el.selectionStart, a = c;
  if (replaceLast && kbLast && kbLast.end === c && el.value.slice(kbLast.start, kbLast.end) === kbLast.t) a = kbLast.start;
  st = null; put(el, a, el.selectionEnd, text);
  kbLast = { start: a, end: a + text.length, t: text };
  el.focus();
}

document.addEventListener('click', function (e) {
  var b = e.target.closest('.tt-bar button, .tt-kb button');
  if (!b) return;
  if (b.dataset.tt === 'mode' && field) { var g = group(field); pref[g] = !isOn(field); try { localStorage.setItem('tamil-type', JSON.stringify(pref)); } catch (x) {}
    st = null; place(field); field.focus(); return; }
  if (b.dataset.tt === 'kb') { kbShow(!kb || kb.hidden); return; }
  if (b.dataset.tt === 'close') { kbShow(false); if (field) field.focus(); return; }
  if (b.dataset.tts !== undefined) { pick(b); return; }
  if (b.dataset.ttc) { kbCons = b.dataset.ttc; kbType(kbCons); var last = kbLast; kb.innerHTML = kbHtml(); kbLast = last; return; }
  if (b.dataset.ttf) { kbType(b.dataset.ttf, true); return; }
  if (b.dataset.ttk !== undefined) { kbType(b.dataset.ttk); kbLast = null; return; }
  if (b.dataset.tt === 'bs' && field) { var el = field, c = el.selectionStart, s = el.selectionEnd;
    if (c !== s) put(el, c, s, ''); else if (c > 0) { var pre = Array.from(el.value.slice(0, c)); pre.pop(); put(el, pre.join('').length, c, ''); }
    kbLast = null; st = null; el.focus(); return; }
});

document.addEventListener('focusin', function (e) {
  var el = e.target;
  if (!el.matches || !el.matches(cfg.fields)) return;
  if (field && field !== el) { field.removeAttribute('inputmode'); st = null; }
  field = el; place(el);
  if (kb && !kb.hidden) { el.setAttribute('inputmode', 'none'); kb.innerHTML = kbHtml(); }
});

function init(o) {
  cfg = o;
  document.addEventListener('beforeinput', onBefore, true);
  document.addEventListener('input', onInput, true); /* capture: runs before the page saves the box */
  document.addEventListener('compositionend', onCompEnd, true);
  var css = document.createElement('style');
  css.textContent =
    '.tt-bar{display:flex;flex-direction:column;gap:6px;margin-top:6px;font:400 14px var(--body,sans-serif)}' +
    '.tt-row{display:flex;gap:6px;flex-wrap:wrap}' +
    '.tt-bar button{font:600 13px var(--display,sans-serif);padding:5px 10px;border-radius:99px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}' +
    '.tt-bar .tt-mode[aria-pressed="true"],.tt-bar .tt-kbb[aria-pressed="true"]{background:var(--teal-soft);border-color:var(--teal);color:var(--teal)}' +
    '.tt-hint{margin:0;font-size:13px;color:var(--muted)}.tt-hint b{color:var(--ink);font-family:var(--mono,monospace);font-weight:600}' +
    '.tt-sug{display:flex;gap:6px;flex-wrap:wrap}' +
    '.tt-bar .tt-w{font:600 16px var(--body,sans-serif);padding:5px 12px;border-color:var(--teal)}' +
    '.tt-bar .tt-w.now{background:var(--teal);color:var(--bg)}' +
    '.tt-w small{font:500 11px var(--mono,monospace);color:var(--muted);margin-left:6px}' +
    '.tt-kb{position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--sunk);border-top:1px solid var(--line);box-shadow:0 -8px 24px rgba(0,0,0,.12);padding:8px max(8px,calc((100vw - 640px)/2)) calc(8px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px}' +
    '.tt-kbhead{display:flex;justify-content:space-between;align-items:center;font:600 14px var(--display,sans-serif);color:var(--ink)}' +
    '.tt-kbhead small{font:400 12px var(--body,sans-serif);color:var(--muted);margin-left:6px}' +
    '.tt-forms{display:grid;grid-template-columns:repeat(13,1fr);gap:3px;padding-bottom:6px;border-bottom:1px dashed var(--line)}' +
    '.tt-keys{display:grid;grid-template-columns:repeat(9,1fr);gap:4px}' +
    '.tt-k{font:600 18px var(--body,sans-serif);min-height:38px;padding:0;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer;touch-action:manipulation}' +
    '.tt-k.tt-v{background:var(--accent-soft)}.tt-k.tt-c.on{background:var(--teal);border-color:var(--teal);color:var(--bg)}' +
    '.tt-k.tt-f{font-size:16px;min-height:40px;background:var(--teal-soft);border-color:var(--teal)}' +
    '.tt-k.tt-close{font:600 13px var(--display,sans-serif);min-height:32px;padding:0 12px}' +
    '.tt-bot{grid-template-columns:1fr 3fr 1fr 1fr 1fr}.tt-k.tt-sp{font:500 14px var(--display,sans-serif)}' +
    'body.tt-kbopen{padding-bottom:340px}body.tt-kbopen .dock{display:none}' +
    '@media (max-width:560px){.tt-forms{grid-template-columns:repeat(7,1fr)}.tt-k{font-size:17px;min-height:36px}}' +
    '@media print{.tt-bar,.tt-kb{display:none!important}}';
  document.head.appendChild(css);
}

window.TamilType = { init: init, tamil: tamil, key: keyEn, keyTa: keyTa };
})();
