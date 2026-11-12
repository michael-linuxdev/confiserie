# Confiserie Sommer

Ein Puzzle als installierbare PWA: Pralinen-Teile in eine 8×8-Schachtel ziehen, volle Reihen und Spalten werden verpackt. Die Kundschaft bestellt bestimmte Sorten mit Zuglimit; jede gelieferte Bestellung macht die nächste schwerer.

- **Bestellungen:** Sorten sammeln, bevor die Züge ausgehen – sonst kostet es ein ♥ (drei pro Partie).
- **Sortenrein:** Eine Reihe aus nur einer Sorte zählt doppelt.
- **Drehen:** Teil antippen; Drehungen sind eine knappe Ressource.
- **Ablage:** Ein Teil zurücklegen oder tauschen.
- **Krokant** blockiert Felder, **Eiskonfekt** schmilzt nach 9 Zügen zu Krokant.
- **Tagesschachtel:** jeden Tag dieselbe Teilefolge für alle, eigener Bestwert.
- **Ränge und Schachtel-Designs** werden über die höchste erreichte Bestellung freigeschaltet.
- Laufende Partien werden gespeichert und beim nächsten Öffnen fortgesetzt.

Live: https://confiserie.micana.de

Das Spiel ist eine einzige statische Seite ohne Build-Schritt und ohne externe Requests – es läuft nach dem ersten Aufruf komplett offline. Spielstände liegen im `localStorage`: `cs_best` (Bestwert), `cs_meta` (Rang, Design, Einstellungen), `cs_run_saison` und `cs_run_tag` (laufende Partien).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Spiel (HTML, CSS, JS in einer Datei) |
| `sw.js` | Service Worker: Cache-first für alle App-Dateien |
| `manifest.webmanifest` | PWA-Manifest |
| `fonts/` | Nunito 700/800/900, Playfair Display Italic 700 (SIL OFL 1.1, Lizenztexte liegen bei) |
| `icons/` | App-Icons, erzeugt mit `tools/make-icons.mjs` |
| `.github/workflows/pages.yml` | Deployment auf GitHub Pages |

## Lokal starten

Ein beliebiger statischer Server im Repo-Root genügt, z. B.:

```sh
python3 -m http.server 8080
# oder
npx serve -l 8080
```

Dann http://localhost:8080 öffnen. Der Service Worker wird nur unter `https:` bzw. `localhost` registriert; über `file://` läuft das Spiel ohne ihn.

Weil der Service Worker cache-first arbeitet, siehst du Änderungen lokal erst, wenn du in `sw.js` die `VERSION` änderst (danach erscheint im Spiel „Neue Version – tippen zum Aktualisieren“) oder in den DevTools unter *Application → Service Workers* „Update on reload“ aktivierst.

## Schwierigkeit / Balancing

Alle Stellschrauben stehen in `P(s)` in `index.html` (s = Nummer der Bestellung): Sortenzahl, Bestellmenge, Zuglimit, sperrige Teile, Krokant und Eiskonfekt. Wie sich Änderungen auswirken, zeigt eine Bot-Simulation mit der echten Spiellogik:

```sh
npm i -D playwright       # einmalig
node tools/balance.cjs    # je Bestellung: erreicht %, geliefert %, geplatzt
```

Der Bot wertet jeden Zug aus, nutzt aber weder Ablage noch Drehen; er kommt im Median bis Bestellung 6. Wer plant, kommt weiter.

## Icons neu erzeugen

```sh
node tools/make-icons.mjs
```

Das Skript zeichnet die Herz-Praline aus dem ersten Prototyp auf cremefarbenem Grund und schreibt 192, 512, 512 maskable, apple-touch-icon (180) und favicon nach `icons/`. Es braucht nur Node, keine Pakete.

## Deployment

Jeder Push auf `main` startet den Workflow `.github/workflows/pages.yml`. Er kopiert die App-Dateien nach `_site`, setzt in `sw.js` die `VERSION` auf den Commit-Hash und veröffentlicht das Ergebnis über `actions/upload-pages-artifact` und `actions/deploy-pages`. Durch den Commit-Hash bekommt jeder Deploy einen neuen Cache; bereits installierte Apps zeigen dann den Aktualisierungs-Hinweis.

Einmalige Einrichtung:

```sh
# Pages mit Actions als Quelle aktivieren und Custom Domain setzen
gh api -X POST repos/michael-linuxdev/confiserie/pages -f build_type=workflow
gh api -X PUT  repos/michael-linuxdev/confiserie/pages -f cname=confiserie.micana.de

# sobald das Zertifikat ausgestellt ist
gh api -X PUT  repos/michael-linuxdev/confiserie/pages -F https_enforced=true
```

DNS: `confiserie.micana.de` als `CNAME` auf `michael-linuxdev.github.io`.
