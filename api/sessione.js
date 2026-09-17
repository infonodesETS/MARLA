/**
 * api/sessione.js — chi sta usando MARLA
 *
 * La pagina lo chiede all'apertura: 200 con il nome se la sessione del socio è
 * valida, altrimenti 401 con l'indirizzo dell'Area soci dove entrare.
 * Vedi api/lib/accesso.js.
 */

const accesso = require('./lib/accesso');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito' });
  const socio = accesso.richiediSocio(req, res);
  if (!socio) return;
  return res.status(200).json({ nome: socio.nome });
};
