/**
 * api/lib/accesso.js — MARLA è riservata ai soci di info.nodes
 *
 * MARLA non ha login proprio: si entra dall'Area soci del sito info.nodes. Il
 * sito verifica le credenziali e consegna un LASCIAPASSARE firmato (valido un
 * minuto, intestato a questo strumento); /entra (api/entra.js) lo controlla e
 * apre qui una sessione di 7 giorni in un cookie firmato.
 *
 * La firma usa STRUMENTI_SECRET, che deve essere IDENTICO su questo progetto e
 * sul sito. Il formato (dati.firma in base64url, HMAC-SHA256) è quello di
 * lib/passaggio.ts nel repo infonodes-new-website, e lo stesso di
 * lib/accesso.ts in foia.nodes: se cambia là, va cambiato anche qui.
 *
 * Il segreto non sta nel repository (che è pubblico): solo su Vercel.
 */

const crypto = require('crypto');

const COOKIE_SOCIO = 'soci_strumento';
const DURATA_SESSIONE_SEC = 60 * 60 * 24 * 7; // 7 giorni

// Dove si entra. Dopo il cambio di dominio basta cambiare la variabile
// d'ambiente SITO_SOCI_URL su Vercel.
function sitoSoci() {
  return (process.env.SITO_SOCI_URL || 'https://infonodes-new-website.vercel.app')
    .trim()
    .replace(/\/+$/, '');
}

// Senza un segreto robusto nessuno entra: meglio chiuso a tutti che aperto
// con una firma debole.
function segreto() {
  const s = String(process.env.STRUMENTI_SECRET || '').trim();
  return s.length >= 32 ? s : null;
}

function firma(payload, chiave) {
  return crypto.createHmac('sha256', chiave).update(payload).digest('base64url');
}

function uguali(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Controlla firma, tipo e scadenza. Restituisce i dati o null.
function leggi(valore, tipo) {
  const chiave = segreto();
  if (!chiave || !valore) return null;
  const [payload, sig] = String(valore).split('.');
  if (!payload || !sig || !uguali(firma(payload, chiave), sig)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (d.tipo !== tipo || typeof d.exp !== 'number' || d.exp < Date.now()) return null;
    return d;
  } catch (e) {
    return null;
  }
}

function socioDa(d) {
  return { nome: String(d.nome || ''), email: String(d.email || ''), role: String(d.role || 'member') };
}

// Il lasciapassare consegnato dal sito. Vale solo se era intestato proprio a
// questo indirizzo: uno rilasciato per un altro strumento qui non apre.
function verificaPassaggio(token, origine) {
  const d = leggi(token, 'passaggio');
  if (!d || !d.aud) return null;
  try {
    if (new URL(d.aud).origin !== new URL(origine).origin) return null;
  } catch (e) {
    return null;
  }
  return socioDa(d);
}

function creaSessione(socio) {
  const chiave = segreto();
  if (!chiave) return null;
  const dati = { tipo: 'sessione', ...socio, exp: Date.now() + DURATA_SESSIONE_SEC * 1000 };
  const payload = Buffer.from(JSON.stringify(dati)).toString('base64url');
  return `${payload}.${firma(payload, chiave)}`;
}

function leggiCookie(req, nome) {
  const riga = String((req.headers && req.headers.cookie) || '');
  for (const pezzo of riga.split(';')) {
    const i = pezzo.indexOf('=');
    if (i > 0 && pezzo.slice(0, i).trim() === nome) return decodeURIComponent(pezzo.slice(i + 1).trim());
  }
  return null;
}

// Il socio che fa la richiesta, o null.
function socioCorrente(req) {
  const d = leggi(leggiCookie(req, COOKIE_SOCIO), 'sessione');
  return d ? socioDa(d) : null;
}

// L'indirizzo pubblico di questo deploy, ricavato dalla richiesta.
function origineDi(req) {
  const h = req.headers || {};
  const host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  const locale = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = String(h['x-forwarded-proto'] || (locale ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${host}`;
}

// Un percorso interno dove tornare dopo l'ingresso: deve iniziare con una
// barra e mai con due ("//altrove.it" sarebbe un indirizzo esterno).
function percorsoSicuro(p) {
  const s = String(p || '').trim();
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return '';
  return s.length <= 2000 ? s : '';
}

// Dove mandare chi non è entrato: alla porta del sito, che se il socio ha già
// fatto il login lo rimanda subito qui col lasciapassare.
function indirizzoIngresso(origine, percorso) {
  const u = new URL('/area-soci/vai', sitoSoci());
  u.searchParams.set('a', new URL(origine).origin);
  const p = percorsoSicuro(percorso);
  if (p && p !== '/') u.searchParams.set('p', p);
  return u.toString();
}

// Per le API: se chi chiama non è un socio risponde 401 e restituisce null.
function richiediSocio(req, res) {
  const socio = socioCorrente(req);
  if (socio) return socio;
  res.status(401).json({
    error: 'MARLA è riservata ai soci di info.nodes: entra dall’Area soci.',
    ingresso: indirizzoIngresso(origineDi(req), '/'),
  });
  return null;
}

module.exports = {
  COOKIE_SOCIO,
  DURATA_SESSIONE_SEC,
  sitoSoci,
  segretoPresente: () => segreto() !== null,
  verificaPassaggio,
  creaSessione,
  socioCorrente,
  origineDi,
  percorsoSicuro,
  indirizzoIngresso,
  richiediSocio,
};
