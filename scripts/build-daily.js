#!/usr/bin/env node
/* Builds assets/daily.json, the question pool for the challenge of the day, from the
   questions already in the labs. Run it again after changing a lab's questions:
     node scripts/build-daily.js
   Source and school names (src, pid) are left out on purpose: students never see them. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');

/* Read `const NAME = [ ... ]` out of a lab page and evaluate just that literal. */
function grab(file, name) {
  var h = fs.readFileSync(path.join(ROOT, file), 'utf8');
  var at = h.search(new RegExp('const ' + name + '\\s*=\\s*\\['));
  if (at < 0) throw new Error(name + ' not found in ' + file);
  var s = h.indexOf('[', at), d = 0, q = null, j;
  for (j = s; j < h.length; j++) {
    var c = h[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '[') d++;
    else if (c === ']' && !--d) break;
  }
  return vm.runInNewContext('(' + h.slice(s, j + 1) + ')');
}

/* Small seeded shuffle so the pool is the same on every build. */
function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
function shuffle(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var k = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[k]; a[k] = t; } return a; }

var r = rng(20261005);

var echam = grab('echam.html', 'ITEMS')
  .filter(function (x) { return x.s.indexOf('___') > -1 && x.o.length === 4; })
  .map(function (x) { return { q: x.s, o: x.o, a: x.a, why: x.w }; });

var veerrumai = grab('veerrumai.html', 'ITEMS')
  .filter(function (x) { return x.sent.indexOf('___') > -1 && !/wait|reframe/i.test(x.explain); })
  .map(function (x) { return { q: x.sent, o: x.choices, a: x.ans, why: x.explain }; });

var oli = grab('oli.html', 'LIST')
  .filter(function (x) { return x.m && x.w.length === x.m.length && x.m.every(function (m) { return m && !/name|\(/i.test(m); }); })
  .map(function (x) {
    var k = Math.floor(r() * x.w.length);
    return { ask: 'Which word means “' + x.m[k] + '”?', o: x.w, a: k,
      why: x.w.map(function (w, i) { return w + ' = ' + x.m[i]; }).join(' · ') };
  });

var vocab = grab('sol.html', 'VOCAB').filter(function (x) { return x.w && x.e; });
var sol = vocab.map(function (x) {
  var others = shuffle(vocab.filter(function (y) { return y.e !== x.e; }), r).slice(0, 3).map(function (y) { return y.e; });
  var o = shuffle([x.e].concat(others), r);
  return { ask: 'What does ' + x.w + ' mean?', o: o, a: o.indexOf(x.e),
    why: x.w + ' = ' + x.e + (x.s && x.s.length ? ' (same as ' + x.s.join(', ') + ')' : '') };
});

var labs = [
  { id: 'oli', name: 'Sound pairs', href: 'oli', items: shuffle(oli, r) },
  { id: 'echam', name: 'Participles', href: 'echam', items: shuffle(echam, r) },
  { id: 'sol', name: 'Vocabulary', href: 'sol', items: shuffle(sol, r) },
  { id: 'veerrumai', name: 'Case markers', href: 'veerrumai', items: shuffle(veerrumai, r) }
];
fs.writeFileSync(path.join(ROOT, 'assets/daily.json'), JSON.stringify({ v: 1, labs: labs }) + '\n');
console.log('assets/daily.json: ' + labs.map(function (l) { return l.id + ' ' + l.items.length; }).join(', '));
