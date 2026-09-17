# TO DO — verso la pubblicazione (settembre 2026)

Lista delle cose da fare/valutare. Aggiornarla man mano: spuntare ciò che è
fatto, aggiungere ciò che emerge.

## MARLA unica: fondere archivio e database

Obiettivo: **una sola interfaccia e un solo chatbot** che risponde sia con i
materiali dell'archivio sia con i dati di Man in the Loop e dei database futuri,
dichiarando sempre da quale fonte viene ogni affermazione.
Vedi `docs/CONTRATTO-FONTI.md` e la sezione "MARLA sui dati" in `CLAUDE.md`.

Stato al 21/08/2026: **fatto e funzionante**. Una sola interfaccia,
`marlamag.vercel.app/`, con tre fonti: archivio, Man in the Loop, FOIA Tracker.
Restano i tetti di spesa e il contenuto dei documenti FOIA.

- [x] **Titoli della kb corretti** (21/08/2026) — non era un problema estetico: gli
      export Substack contengono solo il corpo, quindi lo script ripiegava sul primo
      `<h1>`, che è la rubrica ricorrente del numero. Undici newsletter diverse si
      chiamavano tutte "FACTS ARE FACTS. FICTION IS FICTION" e, siccome l'id era
      ricavato dal titolo, **si fondevano in un unico documento**: tredici newsletter
      irraggiungibili e citazioni attribuite al pezzo sbagliato. Ora il titolo viene dal
      nome del file e gli id sono unici a prescindere. **Da 83 a 99 documenti.**
- [x] **`archivio` aggiunto al registro delle fonti** (21/08/2026).
- [x] **Interfaccia unica** (21/08/2026) — il widget della home parla con `/api/mitl`
      e vede tutte le fonti. Serviva anche rendere cliccabili i link delle citazioni:
      il widget scappava tutto e i markdown uscivano come testo grezzo. `/dati/`
      reindirizza alla home.
- [x] **MARLA riservata ai soci** (17/09/2026) — si entra dall'Area soci del sito con
      un lasciapassare firmato, come FOIA Tracker; il codice condiviso `#codice=…`
      non vale più. Chiuso anche il vecchio `/api/chat`, che era aperto a chiunque.
      Vedi CLAUDE.md, "Accesso".
- [x] **FOIA Tracker collegato** (21/08/2026) — prima fonte `interno`, letta dal vivo
      dal Google Sheet perché questo repo è pubblico e un indice committato sarebbe
      leggibile da chiunque. La colonna EMAIL non esce mai. Contiene i **metadati**
      delle richieste, non il testo delle risposte.
- [ ] **Tetti di spesa** — il tool use costa molto più della singola chiamata di
      prima: più giri, modello più capace, `MAX_TOKENS` a 8000. Misurare il costo
      reale su qualche decina di domande vere. **Da fare prima di allargare l'accesso.**
- [ ] **`/api/chat` non ha alcun limite di chiamate** e ha CORS aperto, in un repo
      pubblico che ne documenta l'indirizzo. Non è più usato dal sito ma è ancora
      online: mettere un tetto o spegnerlo.
- [ ] **Leggere il contenuto delle risposte FOIA** — oggi MARLA sa che una risposta
      è arrivata e dove sta il documento su Drive, non cosa c'è scritto. Servirebbe
      scaricare da Drive, estrarre il testo e quasi sempre passare per l'OCR, perché
      le PA rispondono con scansioni. Lavoro a sé, qualità dipendente dai documenti.
- [ ] **Titoli dei 19 numeri PDF della newsletter** — restano `MARLA2.22`, `MARLA 5.21`:
      codici di numero, non contenuti. Nel catalogo l'estratto iniziale compensa, ma
      si potrebbe fare meglio. Serve sapere la convenzione dei nomi (mese.anno?).
- [ ] **Un service account dedicato** — oggi MARLA usa lo stesso di foia.nodes e della
      contabilità: chi ha quella chiave ha accesso a tutto ciò che gli è stato
      condiviso. Un secondo account con sola lettura sul foglio FOIA restringerebbe.

Se il chatbot si blocca: sotto ogni risposta c'è una riga con giri di strumenti e
motivo dell'interruzione. `interrotta: max_tokens` significa che il tetto per
singola chiamata è troppo basso — vale per **ogni** chiamata, non per la risposta
finale, e il modello spesso ragiona a lungo prima di invocare uno strumento: se il
tetto scatta lì, la chiamata resta troncata e il giro si perde in silenzio. È stata
la causa del blocco del 21/08: 3000 non bastavano.

Limiti noti, da tenere presenti e dichiarare nelle risposte:
- 57 documenti su 99 non hanno un link: si citano per titolo (il contratto lo prevede).
- La ricerca nell'archivio è lessicale. Cercando "frontiere/confini/border" il primo
  risultato è un passaggio sul megaprogetto saudita NEOM dove "superare i confini" è
  figurato — stesso tipo di falso positivo del "cross-border cooperation" nei progetti
  EDF. Il catalogo è il canale principale, la ricerca il secondo.
- Gli embedding risolverebbero la copertura, ma con 99 documenti il guadagno è modesto
  e aggiungono un fornitore e una chiave: da riconsiderare verso le centinaia di documenti.
- Il FOIA Tracker contiene i metadati delle richieste, non il testo delle risposte:
  MARLA deve dirlo invece di dedurre il contenuto dall'oggetto della richiesta.

## Da fare
- [ ] **Stile e linguaggio di MARLA** — affinare il system prompt (tono, autrici/autori
      di riferimento, esempi di voce). Sessione dedicata.
- [ ] **Dominio personalizzato** — collegare infonodes.org o un sottodominio
      (es. marla.infonodes.org) a GitHub Pages: DNS su Register.it + file CNAME.

## Da valutare
- [ ] Pagina/nota legale (licenza CC BY-SA citata nel footer, privacy policy minima)
- [ ] Test del sito su mobile prima della pubblicazione
- [ ] Limite di spesa mensile impostato sulla console Anthropic (verificare)

## Fatto
- [x] Statistiche anonime attive: https://marlamag.vercel.app/api/stats (12/06/2026)
- [x] Riga privacy nel footer di tutte le pagine (12/06/2026)
- [x] Sito retro + chatbot MARLA funzionante (giugno 2026)
- [x] Sezioni: pubblicazioni, archivio, letture, MARLA newsletter
- [x] Rename repository in MARLA, pulizia struttura (12/06/2026)
