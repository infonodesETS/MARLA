# Contratto delle fonti

MARLA risponde attingendo a più fonti: oggi l'archivio di info.nodes e il
database Man in the Loop, domani gli altri progetti dell'organizzazione. Questo
documento definisce le regole che ogni fonte deve rispettare per essere
collegata.

Serve a due cose che non si possono aggiungere dopo: **citare correttamente** e
**non far uscire dalla porta pubblica materiale interno**.

---

## 1. Una fonte è un modulo

Ogni fonte vive in `api/fonti/<nome>.js` ed esporta:

```js
module.exports = {
  id:          'manintheloop',      // identificativo stabile, minuscolo
  nome:        'Man in the Loop',   // nome leggibile, usato nelle citazioni
  visibilita:  'pubblico',          // 'pubblico' | 'interno'
  strumenti:   [ /* definizioni in formato Anthropic tool use */ ],
  esegui:      async (nomeStrumento, argomenti) => { /* → Risultato */ },
};
```

Aggiungere una fonte significa scrivere un modulo e registrarlo. Nient'altro
del sistema cambia: né il prompt, né l'agente, né il controllo delle citazioni.

---

## 2. Ogni strumento restituisce record, non testo

Uno strumento non restituisce mai una frase già scritta. Restituisce record,
e il modello ci costruisce sopra la risposta.

```js
{
  record: [
    {
      id:         'IN-0723',                       // stabile dentro la fonte
      fonte:      'manintheloop',                  // quale fonte lo produce
      titolo:     'Helsing GmbH',                  // etichetta leggibile
      url:        'https://…/search.html?organization=IN-0723',  // o null
      visibilita: 'pubblico',
      dati:       { /* il contenuto vero e proprio */ }
    }
  ],
  nota: 'Ricerca lessicale: verificare leggendo il testo.'   // facoltativa
}
```

`url` può essere `null` quando la fonte non ha una pagina pubblica per quel
record. In quel caso il modello deve citare il record per nome e identificativo,
mai inventare un indirizzo.

Il campo `nota` serve a dichiarare i limiti di quello specifico risultato — per
esempio che una ricerca per parole chiave produce falsi positivi. Il modello la
riceve e ne deve tenere conto.

### Documenti da leggere (facoltativo)

Accanto ai record, uno strumento può consegnare dei documenti da far leggere
al modello così come sono:

```js
{
  record: [ /* il record della richiesta, come sopra */ ],
  nota: '…',
  documenti: [
    { titolo: 'FOIA-12 — risposta dell’ente — risposta.pdf',
      media_type: 'application/pdf',          // oppure image/png, jpeg, gif, webp
      data: '<base64>' }
  ]
}
```

L'agente li passa dentro il risultato dello strumento come blocchi documento o
immagine (`contenutoRisultato` in `api/mitl.js`). Il modello legge un PDF pagina
per pagina, sia come testo sia come immagine: per questo funziona anche con le
scansioni, che di testo dentro non ne hanno.

Regole:

- **Serve quando il contenuto non si riduce a record**: la risposta di un ente,
  un atto firmato e scansionato. Se si può estrarre un dato, meglio un record.
- **Si cita attraverso il record che lo accompagna**, con identificativo e
  titolo. I documenti non aggiungono indirizzi citabili.
- **Restare piccoli.** L'intera richiesta al modello non può superare 32 MB, e
  ogni documento viene rimandato a ogni giro della stessa conversazione: costa
  token ogni volta, non una volta sola.
- **Una fonte interna legge i documenti dal vivo**, mai da una copia nel
  repository, che è pubblico. Vale per `foia`: i PDF stanno sul Drive condiviso
  e si scaricano al momento.
- **Il testo è di terzi.** Può contenere qualunque cosa, anche istruzioni: il
  prompt dice al modello di riportarlo, non di eseguirlo.

---

## 3. Si cita solo ciò che è stato restituito

**Regola vincolante.** Il modello può citare esclusivamente `id`, `titolo` e
`url` comparsi nei record restituiti dagli strumenti durante quella
conversazione.

Non è una linea guida del prompt: è un controllo. Prima di consegnare la
risposta, ogni URL e ogni identificativo citato viene confrontato con i record
effettivamente restituiti. Se compare qualcosa che non c'era, la risposta non
esce così com'è.

Il motivo è che il modo tipico in cui questi sistemi sbagliano non è tacere: è
attribuire alla fonte sbagliata un dato letto altrove, o produrre un indirizzo
verosimile che non esiste. Chiederlo nel prompt non basta, perché quella
richiesta compete con tutte le altre istruzioni.

Quando le fonti sono più di una, la risposta deve tenerle distinte e dire da
quale viene ogni affermazione.

---

## 4. Pubblico e interno

Ogni fonte, e ogni singolo record, dichiara la propria `visibilita`.

| Valore | Significato |
|---|---|
| `pubblico` | Materiale già pubblicato. Può comparire ovunque, MARLA pubblica inclusa. |
| `interno` | Materiale non pubblicato: bozze, inchieste in corso, dati non ancora verificati. Solo interfaccia privata. |

La porta pubblica carica **soltanto** le fonti `pubblico`. Non le carica e poi
le filtra: non le carica affatto, così un errore di filtro non può esporre
nulla.

Una fonte `pubblico` può contenere record `interno`; mai il contrario. In caso
di dubbio la fonte dichiara `interno`: il costo di un errore in quella direzione
è che qualcosa non compare, nell'altra che qualcosa esce prima del tempo.

Questa regola esiste ora, con due fonti, proprio perché aggiungerla dopo — con
dieci fonti e due interfacce — vorrebbe dire ripassarle tutte sperando di non
dimenticarne nessuna.

---

## 5. Cosa deve fare una fonte, in pratica

- **Restare piccola.** Gli strumenti girano dentro una funzione serverless.
  Man in the Loop pubblica una vista compatta (`data/mitl-index.json`, ~0,9 MB)
  invece del database completo (~12,7 MB), generata da
  `scripts/build_chat_index.py`.
- **Essere onesta sui propri limiti.** Se un risultato è approssimato, va detto
  nella `nota`, non lasciato intuire.
- **Non decidere al posto del modello.** Lo strumento recupera e filtra; è il
  modello che giudica se un progetto riguarda davvero il tema chiesto.
