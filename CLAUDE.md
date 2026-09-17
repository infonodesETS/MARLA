# Infonodes — Sito Archivio con chatbot MARLA

## Cos'è questo progetto
Sito web di info.nodes ETS. Estetica retro terminale anni '90 (verde su nero, font VT323).
Ospita un archivio di materiali e il chatbot MARLA alimentato da Claude API.

**Repository pubblico:** https://github.com/infonodesETS/MARLA
**Sito live:** https://infonodesets.github.io/MARLA/
**Dominio attuale:** https://www.infonodes.org/ (su Register.it — ancora attivo, non toccare)
**Chatbot backend:** https://marlamag.vercel.app/api/chat

## Utente
- Non programmatore, lavora da Windows 11
- Username GitHub: infonodesETS
- Budget API: ~€1500

## Struttura del progetto
```
infonodes-website/
├── index.html                    # Homepage
├── pubblicazioni/
│   └── index.html                # Pagina sezione pubblicazioni
├── css/style.css                 # CSS tema retro terminale
├── js/
│   ├── chatbot.js                # Frontend chatbot MARLA
│   └── materiali.js              # Rendering dinamico schede materiali
├── api/
│   └── chat.js                   # Funzione serverless Vercel (Claude API)
├── scripts/
│   ├── genera_indice.py          # Genera search-index.json
│   ├── costruisci_kb.py          # Genera kb.json (memoria MARLA)
│   └── requirements.txt          # Dipendenze Python
├── .github/workflows/
│   └── genera-indice.yml         # GitHub Action: rigenera indice e kb
├── MARLA newsletter/             # Newsletter MARLA (HTML Substack + PDF)
├── pubblicazioni/                # Pubblicazioni info.nodes (PDF + .txt metadati)
├── archivio/                     # Materiali interni (PDF + .txt metadati)
├── letture/                      # Report di altre org (PDF + .txt con URL fonte)
│   └── index.html                # Pagina elenco letture
├── search-index.json             # Auto-generato dall'Action
├── kb.json                       # Auto-generato dall'Action (769 KB)
├── package.json                  # @anthropic-ai/sdk
└── vercel.json                   # Configurazione Vercel
```

## Architettura chatbot MARLA

### Knowledge base (kb.json)
- Generata da `scripts/costruisci_kb.py` su ogni push a "MARLA newsletter/**", pubblicazioni/**, archivio/**, letture/**, scripts/**
- Quattro fonti: newsletter MARLA (HTML Substack + PDF), pubblicazioni, archivio, letture
- Chunk da 400 parole con overlap di 50
- Ogni chunk ha: id, fonte, titolo, tipo, url, fonte_nome, testo
- PDF scansionati: fallback OCR con pytesseract (tesseract-ocr-ita installato nell'Action)
- HTML Substack: titolo estratto da og:title / h1 / title tag
- File .txt compagno: URL e fonte_nome salvati in ogni chunk del documento

### Backend (Vercel serverless)
- Modello: claude-haiku-4-5
- MAX_CHUNK_CONTESTO = 6, MAX_TOKENS_RISPOSTA = 600
- Cache kb.json in memoria: 10 minuti
- Ricerca keyword: tokenizzazione italiana con stopwords, score per match esatto/parziale
- MARLA istruita a citare sempre fonte e URL originale quando disponibile

### Frontend
- chatbot.js: POST a https://marlamag.vercel.app/api/chat con { messages: [...] }
- Label: [ MARLA ] per bot, [ TU ] per utente

## Layout homepage
MARLA è uno strumento di ricerca, non una pagina di presentazione: la home è la
chat e basta. La bio "Chi è MARLA", il box "Chi siamo" e la striscia delle ultime
letture sono stati rimossi (21/08/2026).

1. Header (titolo MARLA, claim fucsia) + ticker fucsia + nav ([HOME] [LE MIE FONTI])
2. Chatbot MARLA — larghezza piena
3. Footer ("MARLA loves you" fucsia)

`fonti/index.html` raccoglie tutto ciò a cui MARLA attinge, in tre sezioni:
pubblicazioni di info.nodes, database di info.nodes (Man in the Loop, FOIA
Tracker), fonti esterne. Le due sezioni testuali vengono da `search-index.json`
come prima. `pubblicazioni/` e `letture/` esistono ancora ma non sono più nel
menu: i link già condivisi continuano a funzionare.

## Convenzione file materiali (.txt)
```
Titolo: ...
Autori: ...
Piattaforma: Nome testata          ← anche "Organizzazione:" o "Fonte:" ok
URL: https://...                   ← citato da MARLA nelle risposte
Anno: ...
Data: 2026-06-10                   ← o GG/MM/AAAA; ordina le letture; ok anche nel campo Anno
Parole chiave: ...
Descrizione: (testo libero, tutto indicizzato)
```
- I .txt con PDF/DOCX compagno vengono usati solo come metadati (non creano chunk separati)
- I .txt senza PDF compagno vengono indicizzati come chunk propri
- Le card delle letture linkano SEMPRE all'URL originale, mai al PDF locale

## MARLA — un solo chatbot su tutte le fonti

C'è **una sola interfaccia**: la home, `marlamag.vercel.app/`. Il widget parla con
`/api/mitl`, che vede tutte le fonti registrate. `/api/chat` è il vecchio endpoint
(solo archivio, ricerca per parole chiave): non è più usato dal sito, ma è ancora
online e senza limiti di chiamate.

- `js/chatbot.js` — il widget. Rende i link delle citazioni (il vecchio scappava
  tutto), chiede il codice, e accetta **`/config`**: mostra quali variabili
  d'ambiente il deploy in esecuzione vede davvero, mai i valori.
- `api/mitl.js` — l'agente. Il modello ha **strumenti** e decide quali chiamare:
  serve perché "questa società ha investitori cileni?" richiede due passaggi
  concatenati che nessuna ricerca testuale può fare.
- `api/fonti/` — una fonte per file: `manintheloop.js`, `archivio.js`, `foia.js`.
  Dal 17/09/2026 `foia.js` legge anche il **testo dei documenti allegati** alle
  richieste — risposte degli enti e riesami, in genere PDF, spesso scansioni —
  con lo strumento `foia_documenti`: li scarica dal Drive condiviso e li passa al
  modello, che li legge pagina per pagina. Niente viene copiato nel repository
- `api/lib/citazioni.js` — il controllo delle citazioni, con i suoi test
  (`node api/lib/citazioni.test.js`, gira senza npm install)
- `docs/CONTRATTO-FONTI.md` — **da leggere prima di aggiungere una fonte**
- `dati/index.html` — reindirizza alla home; era la porta separata, il link girava già

Regola che regge tutto: il modello può citare solo id e URL che gli strumenti gli
hanno davvero restituito. È verificato dal codice, non chiesto nel prompt.

Ogni fonte dichiara `pubblico` o `interno`. Oggi la porta è una sola e richiede il
codice, quindi `VISIBILITA_PORTA = 'interno'` e si vedono tutte e tre le fonti (14
strumenti). Con il codice tolto sarebbero 11: le fonti interne **non verrebbero
caricate**, non filtrate dopo.

### Tempi

`api/mitl.js` può durare fino a **300 secondi** (`vercel.json`, dal 17/09/2026;
prima 60). Serve da quando MARLA legge i documenti FOIA: una domanda aperta che
ne apre parecchi superava i 60 secondi e finiva in un 504 senza risposta. 300 è
il massimo del piano Hobby di Vercel con Fluid Compute. Le chiamate agli
strumenti di uno stesso turno partono in parallelo.

### Se il chatbot si blocca

Sotto ogni risposta c'è una riga con fonti consultate, motivo dell'interruzione ed
eventuali errori degli strumenti. `interrotta: max_tokens` significa che il tetto
per singola chiamata è troppo basso: vale per **ogni** chiamata, non per la
risposta finale, e il modello spesso ragiona a lungo prima di invocare uno
strumento — se il tetto scatta lì, la chiamata resta troncata e il giro si perde.

## Variabili d'ambiente Vercel
- ANTHROPIC_API_KEY — chiave API Anthropic
- MITL_CHAT_TOKEN — codice d'accesso alla chat. Senza, l'endpoint risponde 503 a
  chiunque. Si condivide come `marlamag.vercel.app/#codice=…`: chi apre quel link
  entra senza digitare, e il codice sparisce dalla barra dell'indirizzo
- MITL_INDEX_URL — dove leggere l'indice Man in the Loop. **Punta al branch
  `eu-funding` finché non viene fatto il merge su `main`**: dopo il merge va
  cambiata in `https://infonodesets.github.io/manintheloop/data/mitl-index.json`,
  altrimenti MARLA continua a rispondere su dati fermi senza dare segnali
- MITL_MODELLO — facoltativa, default `claude-sonnet-5`
- GOOGLE_SPREADSHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY — fonte FOIA,
  stessi valori del progetto foia.nodes. **GOOGLE_SHEET_NAME va lasciata vuota**:
  il nome del foglio viene chiesto all'API.
  Il service account deve poter leggere **anche il Drive condiviso "Foia.nodes
  Archive"**, dove foia.nodes carica gli allegati: se `foia_documenti` risponde
  "documento non leggibile sul Drive", è lì che manca il permesso. Ogni chiamata
  a Google ha un tempo massimo di 15 secondi, così un Google lento non fa
  scadere la funzione.
  La chiave privata si copia da `service-account.json` per intero, da
  `-----BEGIN PRIVATE KEY-----` a `-----END PRIVATE KEY-----`, lasciando le
  sequenze di escape a-capo così come sono (nel file appaiono come barra + n):
  sono le interruzioni di riga, non decorazione. Sono ~1700 caratteri, e
  `/config` li conta — se sono molti meno, la copia si è fermata a metà.
  Le variabili nuove valgono **solo per i deploy successivi**: dopo averle
  aggiunte serve un Redeploy, altrimenti risultano MANCANTI.

## Note importanti
- Branch principale: **master** (non main)
- GitHub Pages richiede repo pubblico → kb.json è pubblico
- Eliminare un file da archivio/ triggera l'Action e MARLA dimentica il contenuto in ~12 min (10 min cache Vercel)
- Il modello claude-3-5-haiku-20241022 è deprecato → usare claude-haiku-4-5
- git pull --rebase prima di ogni push per evitare conflitti con l'Action
