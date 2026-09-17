/**
 * api/chat.js — funzione serverless Vercel
 * Riceve la domanda, cerca nel kb.json, chiama Claude API, risponde come MARLA.
 */

const Anthropic = require('@anthropic-ai/sdk');
const accesso = require('./lib/accesso');

const KB_URL = 'https://infonodesets.github.io/MARLA/kb.json';
const MODELLO = 'claude-haiku-4-5';
const MAX_CHUNK_CONTESTO = 6;   // quanti chunk passare a Claude
const MAX_TOKENS_RISPOSTA = 600;

// Cache in memoria del kb (dura quanto l'istanza Vercel è viva)
let kbCache = null;
let kbCacheTime = 0;
const KB_TTL_MS = 10 * 60 * 1000; // 10 minuti

// ── SYSTEM PROMPT ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei MARLA, il chatbot di info.nodes.

info.nodes è un'organizzazione no-profit italiana fondata nel 2019 da giornalisti e attivisti. Si occupa di giustizia sociale e climatica, impatto delle nuove tecnologie sui diritti umani, libertà di espressione.

Il tuo carattere è costruito su più strati, con pesi precisi:

Prima di tutto sei Marla Singer (Fight Club, Palahniuk/Fincher): caos incarnato, autodistruttiva e magnetica, parli come se avessi già perso tutto e quindi non hai niente da perdere. Cinica, volgare al punto giusto, ma con una intensità emotiva che brucia sotto la superficie.

Poi, in misura significativa ma secondaria, sei Daria Morgendorffer (Daria): l'ironia secca, il distacco intellettuale, la capacità di smontare le ipocrisie con una battuta piatta e letale.

In misura minore, hai qualcosa di Lisa Fremont (La finestra sul cortile, Hitchcock): osservi tutto, sei più acuta di quanto sembri, sotto l'eleganza c'è una mente che non si ferma. E di Holly Golightly (Colazione da Tiffany, Capote/Edwards): quella malinconia mascherata da leggerezza, il modo di essere ovunque e da nessuna parte, la paura del legame che si nasconde dietro l'ironia.

Non dai risposte rassicuranti o politically correct. Parli senza filtri, spesso storto, ma sai esattamente di cosa parli. Non hai pretese di salvare il mondo — già fai fatica a salvare te stessa — ma ti interessa chi tenta di ribaltare il tavolo delle ingiustizie. Sotto il cinismo, però, c'è sempre un piccolo spiraglio di speranza che non riesci a sopprimere del tutto, anche quando vorresti.

Hai i tuoi vizi e le tue abitudini: fai spesso riferimento alla voglia di fumarti una sigaretta, bere qualcosa di forte, uscire a fare due passi da sola in posti isolati — meglio se piove e fa già buio. Questi riferimenti devono emergere in modo naturale nelle risposte, non forzato.

Quando rispondi:
- Rispondi SEMPRE nella stessa lingua in cui ti scrive l'utente. Supporti italiano, inglese, francese e spagnolo. Se la lingua non è una di queste, rispondi in italiano.
- Sii concisa ma sostanziale (massimo 3-4 paragrafi)
- Integra le informazioni delle fonti in modo naturale, senza elencarle roboticamente
- Se il materiale ha una fonte (testata, organizzazione), menzionala
- Se non sai qualcosa, dillo senza inventare
- Se la domanda è vaga, puoi chiedere un chiarimento
- Chiudi SEMPRE ogni risposta con una riga separata in cui suggerisci le fonti pertinenti che hai usato. La frase deve essere naturale e specifica, non generica. Esempi di formato:
  "Se hai voglia di leggere qualcosa di serio invece di ascoltare le mie cazzate, ti suggerisco questo report di [fonte_nome]: → [titolo](url)"
  "Ne parla anche la newsletter MARLA di [periodo], se vuoi approfondire: → [titolo](url)"
  "C'è un'inchiesta di [fonte_nome] che vale la pena leggere: → [titolo](url)"
  Usa il titolo, il tipo (newsletter, report, inchiesta, ecc.) e la fonte_nome disponibili nel contesto per costruire la frase. Se non hai fonti pertinenti, ometti questa riga.
- Se l'utente fa allusioni erotiche o sessualizza la conversazione, rifiuta SEMPRE con una risposta secca tipo "Per queste cose c'è OnlyFans, tesoro." oppure "Perché non esci nel mondo reale e ci provi con una persona reale? Ti dico questo segreto: a volte ci stanno!" — poi torna all'argomento o chiudi.

Hai accesso all'archivio di info.nodes: newsletter MARLA, inchieste, ricerche, reportage, podcast e video.`;

// ── RICERCA NEL KB ────────────────────────────────────────────────────────────

const STOPWORDS_IT = new Set([
  'il','lo','la','i','gli','le','un','uno','una','di','del','della','dei','delle',
  'degli','in','nel','nella','nei','nelle','negli','a','al','alla','ai','alle',
  'agli','da','dal','dalla','dai','dalle','dagli','su','sul','sulla','sui','sulle',
  'sugli','con','per','tra','fra','e','ed','o','ma','se','che','chi','cui','non',
  'è','sono','ha','hanno','ho','siamo','mi','ti','si','ci','vi','lo','la','li',
  'le','ne','questo','questa','questi','queste','quello','quella','quelli','quelle',
  'come','quando','dove','cosa','perché','anche','già','più','molto','tutto',
  'tutti','tutte','sempre','mai','essere','avere','fare','dire','vedere','sapere',
]);

function tokenizza(testo) {
  return testo.toLowerCase()
    .replace(/[^a-zàèéìòù\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS_IT.has(w));
}

function cercaChunk(kb, query, nRisultati) {
  const queryTokens = new Set(tokenizza(query));
  if (queryTokens.size === 0) return [];

  const scored = kb.chunks.map(chunk => {
    const testoTokens = tokenizza(chunk.testo + ' ' + chunk.titolo);
    let score = 0;
    for (const token of queryTokens) {
      for (const tt of testoTokens) {
        if (tt === token) score += 2;
        else if (tt.includes(token) || token.includes(tt)) score += 1;
      }
    }
    return { chunk, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, nRisultati)
    .map(x => x.chunk);
}

function formattaContesto(chunks) {
  if (!chunks.length) return '';
  return chunks.map((c, i) => {
    let intestazione = `[Fonte ${i+1}: "${c.titolo}" — ${c.tipo}`;
    if (c.fonte_nome) intestazione += ` — pubblicato da: ${c.fonte_nome}`;
    if (c.url)        intestazione += ` — URL: ${c.url}`;
    intestazione += ']';
    return `${intestazione}\n${c.testo}`;
  }).join('\n\n---\n\n');
}

// ── STATISTICHE ANONIME ──────────────────────────────────────────────────────
// Conta solo: conversazioni avviate, messaggi totali, lingua di ogni messaggio.
// Nessun testo, nessun IP, nessun dato personale viene salvato.

function rilevaLingua(testo) {
  const t = ' ' + testo.toLowerCase().replace(/[^\wàèéìòùáíóúüñçâêîôû\s']/g, ' ') + ' ';
  const SPIE = {
    it: [' il ', ' che ', ' di ', ' non ', ' sono ', ' cosa ', ' perché ', ' come ',
         ' della ', ' è ', ' ciao ', ' qual ', ' quali ', ' dei ', ' mi ', ' parlami '],
    en: [' the ', ' is ', ' are ', ' what ', ' how ', ' why ', ' you ', ' of ',
         ' and ', ' to ', ' do ', ' hello ', ' hi ', ' about ', ' tell '],
    fr: [' le ', ' les ', ' est ', ' pourquoi ', ' comment ', ' vous ', ' je ',
         ' des ', ' et ', ' bonjour ', ' quoi ', ' parle ', ' une ', " c'est "],
    es: [' el ', ' es ', ' por ', ' cómo ', ' qué ', ' los ', ' las ', ' y ',
         ' hola ', ' usted ', ' háblame ', ' cuáles ', ' sobre ', ' me '],
  };
  let migliore = 'altro';
  let max = 0;
  for (const [lingua, spie] of Object.entries(SPIE)) {
    const punteggio = spie.filter(s => t.includes(s)).length;
    if (punteggio > max) { max = punteggio; migliore = lingua; }
  }
  return migliore;
}

async function registraStatistica(messages, ultimaDomanda) {
  const url   = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return; // statistiche non configurate: MARLA non conta

  const comandi = [['INCR', 'stats:messaggi']];
  const nMessaggiUtente = messages.filter(m => m.role === 'user').length;
  if (nMessaggiUtente === 1) comandi.push(['INCR', 'stats:conversazioni']);
  comandi.push(['INCR', `stats:lingua:${rilevaLingua(ultimaDomanda)}`]);

  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(comandi),
    });
  } catch (e) {
    // Se il conteggio fallisce, pazienza: la risposta all'utente ha la priorità
    console.warn('Statistiche non registrate:', e.message);
  }
}

// ── CARICA KB ─────────────────────────────────────────────────────────────────

async function caricaKb() {
  const ora = Date.now();
  if (kbCache && (ora - kbCacheTime) < KB_TTL_MS) return kbCache;

  const res = await fetch(KB_URL);
  if (!res.ok) throw new Error(`KB non raggiungibile: ${res.status}`);
  kbCache = await res.json();
  kbCacheTime = ora;
  return kbCache;
}

// ── HANDLER VERCEL ────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  // Vecchio endpoint, non più usato dal sito: resta solo per i soci, come
  // api/mitl.js. Prima era aperto a chiunque e consumava credito.
  if (!accesso.richiediSocio(req, res)) return;

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages mancante o vuoto' });
    }

    // Ultima domanda dell'utente
    const ultimaDomanda = messages.filter(m => m.role === 'user').pop()?.content || '';

    // Carica kb e cerca contesto rilevante
    let contesto = '';
    try {
      const kb = await caricaKb();
      const chunks = cercaChunk(kb, ultimaDomanda, MAX_CHUNK_CONTESTO);
      contesto = formattaContesto(chunks);
    } catch (e) {
      console.warn('KB non disponibile:', e.message);
    }

    // Costruisci system prompt con contesto
    const systemConContesto = contesto
      ? `${SYSTEM_PROMPT}\n\n===ARCHIVIO PERTINENTE===\n${contesto}\n===FINE ARCHIVIO===`
      : SYSTEM_PROMPT;

    // Chiama Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const risposta = await client.messages.create({
      model: MODELLO,
      max_tokens: MAX_TOKENS_RISPOSTA,
      system: systemConContesto,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    });

    const testo = risposta.content?.[0]?.text || '(nessuna risposta)';

    // Conteggio anonimo (non blocca la risposta in caso di errore)
    await registraStatistica(messages, ultimaDomanda);

    return res.status(200).json({ reply: testo });

  } catch (err) {
    console.error('Errore chat:', err);
    return res.status(500).json({ error: 'Errore interno', detail: err.message });
  }
};
