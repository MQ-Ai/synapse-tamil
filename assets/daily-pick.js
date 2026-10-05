/* Picks the challenge of the day from assets/daily.json. Shared by daily.html and
   api/push.js, so the reminder teases the same question the student will see.
   A day is a Singapore calendar day. Each day takes three questions from three
   different labs, rotating through the labs and walking through each lab's list. */
(function (root) {
  'use strict';
  var PER_DAY = 3;
  function dayNum(t) { return Math.floor(((t == null ? Date.now() : t) + 8 * 3600e3) / 864e5); }
  function pick(pool, day) {
    var labs = pool.labs, n = labs.length, out = [], i;
    for (i = 0; i < PER_DAY; i++) {
      var slot = day * PER_DAY + i, lab = labs[slot % n];
      var item = lab.items[Math.floor(slot / n) % lab.items.length];
      out.push({ lab: lab.id, labName: lab.name, href: lab.href, item: item });
    }
    return out;
  }
  var api = { dayNum: dayNum, pick: pick, PER_DAY: PER_DAY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.synDaily = api;
})(this);
