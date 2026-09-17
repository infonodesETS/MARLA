/* ===== MARLA — chatbot di info.nodes ===== */
/* Unica interfaccia: parla con /api/mitl, che vede sia l'archivio sia i
   database dei progetti. Vedi docs/CONTRATTO-FONTI.md.

   Due differenze rispetto alla versione precedente, che chiamava /api/chat:
   - le risposte contengono citazioni in markdown, quindi i link vanno resi
     cliccabili invece che scappati come testo;
   - MARLA è riservata ai soci di info.nodes: si entra dall'Area soci del sito,
     che apre qui una sessione (cookie). Senza sessione la pagina rimanda lì.
     Vedi api/lib/accesso.js.

   Il cookie vale solo su marlamag.vercel.app: le copie della pagina su altri
   indirizzi (GitHub Pages) non possono parlare con MARLA e rimandano là. */

const CASA = 'https://marlamag.vercel.app';
const SU_VERCEL = location.origin === CASA || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const ENDPOINT = '/api/mitl';

const BENVENUTO = `Ciao, sono MARLA. Ho davanti l'archivio di info.nodes — newsletter, pubblicazioni, inchieste, report di altre organizzazioni — e il database Man in the Loop sui finanziamenti alle armi autonome. Posso incrociarli, e ti dico sempre da dove viene ogni cosa. Se non c'è, te lo dico e basta.`;

class InfonodesChat {
  constructor() {
    this.messages = [];
    this.isTyping = false;
    this.pronta = false;
    this.init();
  }

  init() {
    this.messagesEl = document.getElementById('chat-messages');
    this.form = document.getElementById('chat-form');
    this.input = document.getElementById('chat-input');
    if (!this.messagesEl || !this.form) return;

    this.controllaAccesso();

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text || this.isTyping || !this.pronta) return;
      this.input.value = '';
      if (/^\/config(urazione)?$/i.test(text)) return this.controllaConfigurazione();
      this.send(text);
    });
  }

  /* Chi apre la pagina senza essere entrato dall'Area soci viene mandato lì:
     se ha già fatto il login, il sito lo rimanda subito indietro. Ci pensa il
     server a dire dove (api/sessione.js), così l'indirizzo del sito sta in un
     posto solo. */
  async controllaAccesso() {
    if (!SU_VERCEL) {
      return this.addMessage('bot', `Da qui non posso rispondere. MARLA è riservata ai soci di info.nodes: [aprila qui](${CASA}/).`);
    }
    if (this.input) this.input.placeholder = 'un attimo…';
    try {
      const res = await fetch('/api/sessione', { credentials: 'same-origin', cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401 && d.ingresso) return this.vaiAllIngresso(d.ingresso);
      if (!res.ok) return this.addMessage('bot', d.error || `Errore ${res.status}.`);
      this.addMessage('bot', BENVENUTO);
      this.pronta = true;
      if (this.input) { this.input.placeholder = 'scrivi qui…'; this.input.focus(); }
    } catch (e) {
      this.addMessage('bot', 'Non riesco a raggiungere il server: ' + e.message);
    }
  }

  vaiAllIngresso(indirizzo) {
    this.pronta = false;
    this.addMessage('bot', `MARLA è riservata ai soci di info.nodes. Ti porto all'[Area soci](${indirizzo})…`);
    location.href = indirizzo;
  }

  addMessage(role, text, extra) {
    const msg = document.createElement('div');
    msg.className = `msg ${role}`;
    const label = role === 'bot' ? '[ MARLA ]' : '[ TU ]';
    msg.innerHTML = `<div class="msg-label">${label}</div>${this.rendi(text)}` +
                    (extra ? `<div class="msg-note">${this.escapeHtml(extra)}</div>` : '');
    this.messagesEl.appendChild(msg);
    this.scrollBottom();
    return msg;
  }

  /* Markdown minimo: link e grassetto. Tutto il resto resta scappato — le
     citazioni sono il motivo per cui questi link esistono, e devono essere
     cliccabili. */
  rendi(text) {
    return this.escapeHtml(text)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
               '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  showTyping() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    this.messagesEl.appendChild(el);
    this.scrollBottom();
  }

  hideTyping() {
    const el = document.getElementById('typing');
    if (el) el.remove();
  }

  scrollBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Scrivendo "/config" nella chat si vede quali variabili d'ambiente il deploy
     in esecuzione vede davvero. Serve dopo ogni aggiunta su Vercel: le variabili
     nuove valgono solo per i deploy successivi, e senza questo controllo la
     differenza fra "non l'ho messa" e "non ho ridistribuito" non si vede. */
  async controllaConfigurazione() {
    this.addMessage('user', '/config');
    this.isTyping = true;
    this.showTyping();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ controlla: 'configurazione' })
      });
      const d = await res.json().catch(() => ({}));
      this.hideTyping();

      if (res.status === 401 && d.ingresso) return this.vaiAllIngresso(d.ingresso);
      if (!res.ok) return this.addMessage('bot', d.error || `Errore ${res.status}.`);

      const righe = Object.entries(d)
        .filter(([k]) => k !== 'nota')
        .map(([k, v]) => `${/MANCANTE/.test(v) ? '✗' : '✓'} ${k}: ${v}`)
        .join('\n');
      this.addMessage('bot', `**Configurazione del deploy in esecuzione**\n\n${righe}`, d.nota);
    } catch (e) {
      this.hideTyping();
      this.addMessage('bot', 'Non riesco a raggiungere il server: ' + e.message);
    } finally {
      this.isTyping = false;
    }
  }

  async send(userText) {
    this.addMessage('user', userText);
    this.messages.push({ role: 'user', content: userText });
    this.isTyping = true;
    this.showTyping();

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ messages: this.messages })
      });
      const data = await res.json().catch(() => ({}));
      this.hideTyping();

      // La sessione dura 7 giorni: se è scaduta a metà conversazione, si rientra.
      if (res.status === 401 && data.ingresso) {
        this.messages.pop();
        return this.vaiAllIngresso(data.ingresso);
      }
      if (!res.ok) {
        this.messages.pop();
        this.addMessage('bot', res.status === 429
          ? 'Troppe domande in un\'ora. Riprova più tardi.'
          : (data.error || `Errore ${res.status}.`));
        return;
      }

      const reply = data.reply || '(nessuna risposta)';
      this.messages.push({ role: 'assistant', content: reply });

      // Riga di servizio: quali fonti ha consultato e, se si è fermata per un
      // motivo anomalo, quale. Serve a capire un blocco senza leggere i log.
      const d = data.diagnostica || {};
      const note = [
        (data.strumenti || []).length ? `consultato: ${[...new Set(data.strumenti)].join(', ')}` : null,
        d.stop_reason && d.stop_reason !== 'end_turn' ? `interrotta: ${d.stop_reason}` : null,
        (d.errori || []).length ? `errori — ${[...new Set(d.errori)].join(' | ')}` : null,
      ].filter(Boolean).join(' · ');

      this.addMessage('bot', reply, note || null);
    } catch (err) {
      this.hideTyping();
      this.messages.pop();
      this.addMessage('bot', 'Errore di connessione. Riprova tra qualche secondo.');
      console.error('Chat error:', err);
    } finally {
      this.isTyping = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new InfonodesChat();
});
