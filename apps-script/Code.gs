/**
 * Kaizen Site Visit - MULTI USER backend (Google Sheet + Apps Script)
 *
 * Setup (sirf ek dafa):
 *  1. Apni master Google Sheet kholein > Extensions > Apps Script > purana code hata kar ye paste karein.
 *  2. Upar function list me se  setup  chalayen (Run) aur permissions Allow karein.
 *  3. Deploy > New deployment > Web app:  Execute as = Me,  Who has access = Anyone.
 *     (Pehle se deploy hai to: Deploy > Manage deployments > Edit > Version: New version > Deploy. URL wohi rehta hai.)
 *  4. Web App URL ko www/config.js me paste kar dein.
 *
 * Is sheet me:  "Data"   = sab users ka live data (Email column se alag alag)
 *               "Backup" = har save / edit / delete ka permanent record (user delete kare tab bhi yahan rehta hai)
 * Ye sheet kisi ke saath share na karein. Users sirf app ke zariye apna hi data dekh sakte hain.
 */

// Khali rakhein = koi bhi apni email se login kar sakta hai.
// Limit karni ho to:  ['ali@gmail.com', 'ahmed@gmail.com']
const ALLOWED_EMAILS = [];
const SESSION_DAYS = 180;

const HEAD = ['ID', 'Email', 'User Name', 'Date', 'City', 'Owner Name', 'Owner Mob', 'Site Size', 'Site Type',
  'Meet with / Name', 'Mobile', 'Site Address', 'Site condition for estimated time for paint', 'Ticket No', 'Updated'];
const NC = HEAD.length;

/* ---------- sheets ---------- */
function sheet_(name, headers, hidden) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, s.getMaxRows(), headers.length).setNumberFormat('@');
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    s.setFrozenRows(1);
    if (hidden) s.hideSheet();
  }
  return s;
}
const SH = {
  data: function () { return sheet_('Data', HEAD, false); },
  backup: function () { return sheet_('Backup', ['Logged At', 'Action'].concat(HEAD), false); },
  users: function () { return sheet_('_Users', ['Email', 'Name', 'Created'], true); },
  sess: function () { return sheet_('_Sessions', ['Token Hash', 'Email', 'Created'], true); }
};
function setup() { SH.data(); SH.backup(); SH.users(); SH.sess(); }

function put_(s, row, arr) {            // text format force, taake phone ka leading 0 na ude
  const r = s.getRange(row, 1, 1, arr.length);
  r.setNumberFormat('@');
  r.setValues([arr]);
}
function append_(s, arr) { put_(s, s.getLastRow() + 1, arr); }

/* ---------- helpers ---------- */
function str_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 300); }
function normEmail_(e) { e = str_(e, 120).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ''; }
function allowed_(e) { return !ALLOWED_EMAILS.length || ALLOWED_EMAILS.map(function (x) { return String(x).toLowerCase(); }).indexOf(e) >= 0; }
function nowStr_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function hash_(t) {
  return 'h_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { try { lock.releaseLock(); } catch (x) {} }
}

/* ---------- login (email code) ---------- */
function sendOtp_(d) {
  const email = normEmail_(d.email);
  if (!email) return { ok: false, error: 'Email sahi likhein' };
  if (!allowed_(email)) return { ok: false, error: 'Ye email allowed nahi hai' };
  const c = CacheService.getScriptCache();
  if (c.get('cool:' + email)) return { ok: false, error: '1 minute baad dobara code mangwayen' };
  const code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 900000 + 100000);
  c.put('otp:' + email, code, 600);
  c.put('cool:' + email, '1', 60);
  c.remove('try:' + email);
  MailApp.sendEmail({
    to: email, name: 'Kaizen', subject: 'Kaizen login code: ' + code,
    body: 'Aap ka Kaizen login code: ' + code + '\n\nYe code 10 minute tak chalega. Agar aap ne nahi mangwaya to is email ko ignore karein.'
  });
  return { ok: true };
}

function userName_(email) {
  const s = SH.users(), last = s.getLastRow();
  if (last < 2) return '';
  const v = s.getRange(2, 1, last - 1, 2).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]) === email) return String(v[i][1]);
  return '';
}
function setName_(email, name) {
  name = str_(name, 60);
  if (!name) return { ok: false, error: 'Naam likhein' };
  const s = SH.users(), last = s.getLastRow();
  const v = last >= 2 ? s.getRange(2, 1, last - 1, 2).getValues() : [];
  for (let i = 0; i < v.length; i++) if (String(v[i][0]) === email) { put_(s, i + 2, [email, name, String(v[i][2] || '')]); return { ok: true, name: name }; }
  append_(s, [email, name, new Date().toISOString()]);
  return { ok: true, name: name };
}

function verifyOtp_(d) {
  const email = normEmail_(d.email);
  if (!email) return { ok: false, error: 'Email sahi likhein' };
  const c = CacheService.getScriptCache();
  const tries = Number(c.get('try:' + email) || 0);
  if (tries >= 5) return { ok: false, error: 'Bohat ghalat koshish. Naya code mangwayen' };
  const real = c.get('otp:' + email);
  if (!real || real !== str_(d.code, 10)) { c.put('try:' + email, String(tries + 1), 600); return { ok: false, error: 'Code ghalat ya expire ho gaya' }; }
  c.remove('otp:' + email);
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  append_(SH.sess(), [hash_(token), email, new Date().toISOString()]);
  return { ok: true, token: token, email: email, name: userName_(email) };
}

function emailFor_(token) {
  token = str_(token, 200);
  if (!token) return '';
  const h = hash_(token), cache = CacheService.getScriptCache();
  const hit = cache.get('s:' + h);
  if (hit) return allowed_(hit) ? hit : '';
  const s = SH.sess(), last = s.getLastRow();
  if (last < 2) return '';
  const v = s.getRange(2, 1, last - 1, 3).getValues();
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]) !== h) continue;
    const age = (Date.now() - new Date(String(v[i][2])).getTime()) / 86400000;
    const email = String(v[i][1]);
    if (!(age <= SESSION_DAYS) || !allowed_(email)) return '';
    cache.put('s:' + h, email, 21600);
    return email;
  }
  return '';
}
function logout_(token) {
  token = str_(token, 200);
  if (!token) return;
  const h = hash_(token), s = SH.sess(), last = s.getLastRow();
  CacheService.getScriptCache().remove('s:' + h);
  if (last < 2) return;
  const v = s.getRange(2, 1, last - 1, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === h) s.deleteRow(i + 2);
}

/* ---------- data ---------- */
function rowFrom_(id, email, name, r, stamp) {
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(str_(r.date, 10)) ? str_(r.date, 10) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return [id, email, name, dt, str_(r.city, 80), str_(r.ownerName), str_(r.ownerMob, 40), str_(r.size, 60), str_(r.type),
    str_(r.meetName), str_(r.meetMob, 40), str_(r.address, 500), str_(r.condition, 80), str_(r.ticket, 80), stamp];
}

// [id, date, city, ownerName, ownerMob, size, type, meetName, meetMob, address, condition, ticket]
function list_(email) {
  const s = SH.data(), last = s.getLastRow(), out = [];
  if (last < 2) return out;
  const v = s.getRange(2, 1, last - 1, NC).getValues();
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (String(r[1]).toLowerCase() !== email) continue;      // sirf apni rows
    out.push([cell_(r[0]), cell_(r[3]), cell_(r[4]), cell_(r[5]), cell_(r[6]), cell_(r[7]), cell_(r[8]),
      cell_(r[9]), cell_(r[10]), cell_(r[11]), cell_(r[12]), cell_(r[13])]);
  }
  return out;
}

// ops: [{op:'save', rec:{id,...}}, {op:'del', ids:[...]}]   (id se upsert, dobara bhejne par duplicate nahi banta)
function batch_(email, d) {
  const ops = Array.isArray(d.ops) ? d.ops : [];
  if (ops.length > 500) return { ok: false, error: 'Bohat zyada changes ek saath' };
  const s = SH.data(), last = s.getLastRow(), idx = {};
  if (last >= 2) {
    const v = s.getRange(2, 1, last - 1, 2).getValues();
    for (let i = 0; i < v.length; i++) idx[String(v[i][0])] = { row: i + 2, email: String(v[i][1]).toLowerCase() };
  }
  const name = userName_(email), stamp = nowStr_();
  const upd = {}, add = {}, order = [], del = {};

  ops.forEach(function (op) {
    if (!op) return;
    if (op.op === 'save') {
      const r = op.rec || {}, id = str_(r.id, 40);
      if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return;
      const hit = idx[id];
      if (hit && hit.email !== email) return;                // kisi aur ka record - haath nahi lagana
      const row = rowFrom_(id, email, name, r, stamp);
      if (hit) { upd[hit.row] = row; delete del[hit.row]; }
      else { if (!add[id]) order.push(id); add[id] = row; }
    } else if (op.op === 'del') {
      (Array.isArray(op.ids) ? op.ids : []).forEach(function (x) {
        const id = str_(x, 40);
        delete add[id];
        const hit = idx[id];
        if (hit && hit.email === email) { del[hit.row] = true; delete upd[hit.row]; }
      });
    }
  });

  const log = [], t = stamp;
  Object.keys(upd).forEach(function (r) { put_(s, Number(r), upd[r]); log.push([t, 'EDIT'].concat(upd[r])); });
  const fresh = order.filter(function (id) { return add[id]; }).map(function (id) { return add[id]; });
  if (fresh.length) {
    const rg = s.getRange(s.getLastRow() + 1, 1, fresh.length, NC);
    rg.setNumberFormat('@');
    rg.setValues(fresh);
    fresh.forEach(function (r) { log.push([t, 'ADD'].concat(r)); });
  }
  const dr = Object.keys(del).map(Number).sort(function (a, b) { return b - a; });
  dr.forEach(function (r) {
    const old = s.getRange(r, 1, 1, NC).getValues()[0].map(cell_);
    log.push([t, 'DELETE'].concat(old));
    s.deleteRow(r);
  });
  if (log.length) {
    const b = SH.backup(), rg = b.getRange(b.getLastRow() + 1, 1, log.length, NC + 2);
    rg.setNumberFormat('@');
    rg.setValues(log);
  }
  return { ok: true };
}

/* ---------- web app ---------- */
function doGet() { return out_({ ok: true, app: 'kaizen' }); }

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad request' }); }
  const act = String(d.action || '');
  try {
    if (act === 'sendOtp') return out_(sendOtp_(d));
    if (act === 'verifyOtp') return out_(withLock_(function () { return verifyOtp_(d); }));
    if (act === 'logout') { withLock_(function () { logout_(d.token); }); return out_({ ok: true }); }

    const email = emailFor_(d.token);
    if (!email) return out_({ ok: false, auth: false, error: 'Dobara login karein' });

    if (act === 'list') return out_({ ok: true, name: userName_(email), rows: list_(email) });
    if (act === 'setName') return out_(withLock_(function () { return setName_(email, d.name); }));
    if (act === 'batch') return out_(withLock_(function () { return batch_(email, d); }));
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

/**
 * Purani "Sheet1" ka data naye system me laane ke liye (sirf ek dafa, optional).
 * Neeche apni email likhein, phir ye function Run karein. Sara purana data us email ke naam par chala jayega.
 */
function importOldSheet() {
  const OWNER_EMAIL = 'apni-email@gmail.com';
  const email = normEmail_(OWNER_EMAIL);
  if (!email) throw new Error('OWNER_EMAIL set karein');
  const old = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  if (!old || old.getLastRow() < 2) throw new Error('Sheet1 me data nahi mila');
  const n = old.getLastRow() - 1, tz = Session.getScriptTimeZone();
  const disp = old.getRange(2, 1, n, 10).getDisplayValues(), dv = old.getRange(2, 1, n, 1).getValues();
  const name = userName_(email), stamp = nowStr_(), rows = [];
  for (let i = 0; i < n; i++) {
    const r = disp[i];
    if (r.join('').trim() === '') continue;
    const date = (dv[i][0] instanceof Date) ? Utilities.formatDate(dv[i][0], tz, 'yyyy-MM-dd') : String(r[0]);
    rows.push(rowFrom_(Utilities.getUuid().replace(/-/g, '').slice(0, 20), email, name,
      { date: date, city: '', ownerName: r[1], ownerMob: r[2], size: r[3], type: r[4], meetName: r[5], meetMob: r[6], address: r[7], condition: r[8], ticket: r[9] }, stamp));
  }
  const s = SH.data(), rg = s.getRange(s.getLastRow() + 1, 1, rows.length, NC);
  rg.setNumberFormat('@');
  rg.setValues(rows);
  return rows.length + ' records import ho gaye';
}
