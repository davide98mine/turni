// Turni Circolo · widget per iPhone (app gratuita «Scriptable»)
// Mostra aperture, chiusure e reperibilità di oggi e dei giorni seguenti, come il widget di Turni Manager.
// Il link dei turni va messo nel «Parameter» del widget (tieni premuto il widget → Modifica widget → Parameter).
// Dopo il link, separate da uno spazio, si possono aggiungere queste parole:
//   domani        → mostra domani e dopodomani (senza: oggi e domani)
//   aperture  chiusure  reperibilità   → mostra solo quelle (senza: tutte e tre)
// Esempio:  https://…&k=…  domani aperture
// In alternativa incolla il link qui sotto tra le virgolette.
const LINK_QUI = "";

const PARAM = ((args.widgetParameter || "").trim() || LINK_QUI).trim();
const LINK = (PARAM.match(/https?:\/\/\S+/) || [""])[0];
const PAROLE = PARAM.replace(LINK, " ").toLowerCase();
const DA_DOMANI = /\bdomani\b/.test(PAROLE);
const SCELTI = [["A", /apertur/], ["C", /chiusur/], ["R", /reperibil/]].filter(([, re]) => re.test(PAROLE)).map(([s]) => s);
const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const TIPI = [["A", "Apertura"], ["C", "Chiusura"], ["R", "Reperibilità"]];
const BG = new Color("#0F1513"), TESTO = new Color("#E9EFEC"), GRIGIO = new Color("#84938D"), DEBOLE = new Color("#5A6862");

function param(link, name) {
  const m = link.match(new RegExp("[?&]" + name + "=([^&#]*)"));
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
}
function dmy(d) { return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); }
function lista(a) { return Array.isArray(a) ? a.filter(Boolean) : (a && typeof a === "object" ? Object.values(a) : []); }

async function dati() {
  const fm = FileManager.local();
  const file = fm.joinPath(fm.documentsDirectory(), "turni-circolo.json");
  const db = param(LINK, "db").replace(/\/+$/, ""), k = param(LINK, "k");
  if (!db || !k) return { errore: "Manca il link: tieni premuto il widget → Modifica widget → Parameter" };
  try {
    const r = new Request(db + "/condivisi/" + encodeURIComponent(k) + ".json");
    r.timeoutInterval = 20;
    const d = await r.loadJSON();
    if (!d || typeof d !== "object" || d.error) throw new Error("vuoto");
    fm.writeString(file, JSON.stringify(d));
    return d;
  } catch (e) {
    if (fm.fileExists(file)) { const d = JSON.parse(fm.readString(file)); d.offline = true; return d; }
    return { errore: "Nessun dato: controlla il link o la connessione" };
  }
}

function coloreDi(d, nome) {
  for (const p of lista(d.people)) if (p.n === nome && /^#[0-9A-Fa-f]{6}$/.test(p.c)) return new Color(p.c);
  return GRIGIO;
}

function giorno(w, d, data, titolo, compatto) {
  const t = w.addText(titolo);
  t.font = Font.boldSystemFont(compatto ? 13 : 14);
  t.textColor = TESTO;
  w.addSpacer(3);
  const giornoData = dmy(data);
  const turni = lista(d.shifts).filter(s => s.d === giornoData);
  let righe = 0;
  const tipi = TIPI.filter(([sigla]) => !SCELTI.length || SCELTI.includes(sigla));
  for (const [sigla, nome] of tipi) {
    const chi = turni.filter(s => s.t === sigla).map(s => s.p);
    if (!chi.length) continue;
    righe++;
    const r = w.addStack();
    r.centerAlignContent();
    const pallino = r.addText("● ");
    pallino.font = Font.systemFont(compatto ? 10 : 11);
    pallino.textColor = coloreDi(d, chi[0]);
    const tipo = r.addText(tipi.length === 1 ? "" : nome + " ");
    tipo.font = Font.systemFont(compatto ? 11 : 12);
    tipo.textColor = GRIGIO;
    const nomi = r.addText(chi.join(", "));
    nomi.font = Font.mediumSystemFont(compatto ? 12 : 13);
    nomi.textColor = TESTO;
    nomi.lineLimit = 1;
    nomi.minimumScaleFactor = 0.7;
  }
  if (!righe) {
    const n = w.addText("Nessun turno");
    n.font = Font.systemFont(12);
    n.textColor = GRIGIO;
  }
}

function etichetta(data, i) {
  const base = GIORNI[data.getDay()] + " " + data.getDate() + " " + MESI[data.getMonth()];
  return (i === 0 ? "Oggi · " : i === 1 ? "Domani · " : i === 2 ? "Dopodomani · " : "") + (i > 2 ? base.charAt(0).toUpperCase() + base.slice(1) : base);
}

async function crea() {
  const d = await dati();
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 14, 12, 14);
  if (LINK) w.url = LINK;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  if (d.errore) {
    const t = w.addText("Turni Circolo");
    t.font = Font.boldSystemFont(14);
    t.textColor = TESTO;
    w.addSpacer(4);
    const e = w.addText(d.errore);
    e.font = Font.systemFont(12);
    e.textColor = GRIGIO;
    return w;
  }
  const famiglia = config.widgetFamily || "medium";
  const quanti = famiglia === "small" ? 1 : famiglia === "large" || famiglia === "extraLarge" ? 4 : 2;
  const oggi = new Date();
  const primo = DA_DOMANI ? 1 : 0;
  for (let i = 0; i < quanti; i++) {
    const data = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + primo + i);
    giorno(w, d, data, etichetta(data, primo + i), famiglia !== "large");
    if (i < quanti - 1) w.addSpacer(8);
  }
  w.addSpacer();
  const ora = new Date(d.updated || Date.now());
  const f = w.addText((d.offline ? "Senza rete · " : "") + "agg. " + ora.getDate() + " " + MESI[ora.getMonth()] + " " +
    String(ora.getHours()).padStart(2, "0") + ":" + String(ora.getMinutes()).padStart(2, "0"));
  f.font = Font.systemFont(9);
  f.textColor = DEBOLE;
  return w;
}

const widget = await crea();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
