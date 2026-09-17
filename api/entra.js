/**
 * api/entra.js — la porta d'ingresso di MARLA (pubblicata come /entra)
 *
 * /entra?t=<lasciapassare>&p=<percorso>
 *
 * Ci arriva il socio mandato dall'Area soci del sito, con il lasciapassare
 * firmato. Se è valido si apre la sessione e si entra. Vedi api/lib/accesso.js.
 *
 * Se il lasciapassare non va, NON rimandiamo automaticamente al sito: se il
 * segreto fosse diverso fra i due progetti si creerebbe un giro infinito di
 * rimbalzi. Mostriamo invece una pagina che spiega e offre il link.
 */

const accesso = require('./lib/accesso');

function pagina(res, titolo, testo, stato) {
  const area = `${accesso.sitoSoci()}/area-soci`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(stato).send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titolo} — MARLA</title>
<style>body{font-family:'Courier New',monospace;background:#0a0a0a;color:#33ff66;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem}
main{max-width:32rem}h1{font-size:1.4rem;margin:0 0 .8rem}p{line-height:1.55;margin:0 0 1.2rem}
a{display:inline-block;border:1px solid #ff2e88;color:#ff2e88;text-decoration:none;padding:.7em 1.2em}</style>
</head><body><main><h1>${titolo}</h1><p>${testo}</p><a href="${area}">Vai all’Area soci di info.nodes</a></main></body></html>`);
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito' });

  if (!accesso.segretoPresente()) {
    return pagina(res, 'Accesso non ancora configurato',
      'MARLA è riservata ai soci di info.nodes, ma il collegamento con l’Area soci non è ancora attivo. Riprova fra poco.', 503);
  }

  const q = req.query || {};
  const origine = accesso.origineDi(req);
  const socio = accesso.verificaPassaggio(String(q.t || ''), origine);
  const valore = socio ? accesso.creaSessione(socio) : null;

  if (!socio || !valore) {
    return pagina(res, 'Accesso non riuscito',
      'Il collegamento per entrare è scaduto o non è valido. Riapri MARLA dall’Area soci di info.nodes.', 401);
  }

  const cookie = [
    `${accesso.COOKIE_SOCIO}=${valore}`,
    'Path=/',
    `Max-Age=${accesso.DURATA_SESSIONE_SEC}`,
    'HttpOnly',
    'SameSite=Lax',
    origine.startsWith('https:') ? 'Secure' : null,
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', cookie);
  res.setHeader('Cache-Control', 'no-store');
  // il lasciapassare sta nell'indirizzo di questa richiesta: non va passato oltre
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Location', accesso.percorsoSicuro(q.p) || '/');
  return res.status(303).end();
};
