/* Synapse Tamil tracking settings. Same receiver as Synapse Econs.
   endpoint: the Google Apps Script web app URL (ends in /exec). Leave empty to
             switch sign-up and tracking off completely.
   contact:  optional email shown in the sign-up form for questions or deletion. */
window.SYNAPSE_TRACK = {
  endpoint: 'https://script.google.com/macros/s/AKfycbz1Aqae1AKvq8H6Aqer6UNB8m8zMmyaYU5Ns7arloVjIZdnj80jDha6nz1e6mpHLWKhKw/exec',
  contact: 'sage.synapse@gmail.com'
};

/* Synapse passes (assets/pay.js). Paste each Stripe Payment Link (https://buy.stripe.com/...)
   into `link`. While both links are empty, everything stays free after sign-in.
   The prices here are only what the pay screen shows: the amount charged is set in
   Stripe, and must match PASSES in docs/tracking/apps-script.gs.
   covers: 'every round and every exam paper in all six labs, including the composition guide',
  short: 'Every lab and exam paper',
  parent: true shows "Ask a parent to pay" with a WhatsApp share link. */
window.SYNAPSE_PAY = {
  app: 'synapse-tamil',
  year: { link: '', price: 'S$49', until: '31 Dec 2027' },
  month: { link: '', price: 'S$12' },
  covers: 'every round and every exam paper in all six labs, including the composition guide',
  short: 'Every lab and exam paper',
  parent: true
};
