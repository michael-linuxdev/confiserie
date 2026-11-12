# Truffle Box

*A Chocolatier's Puzzle* – ein Puzzle als installierbare PWA: Pralinen-Teile in eine 8×8-Schachtel ziehen, volle Reihen und Spalten werden verpackt. Die Kundschaft bestellt bestimmte Sorten mit Zuglimit; jede gelieferte Bestellung macht die nächste schwerer.

- **Bestellungen:** Sorten sammeln, bevor die Züge ausgehen – sonst kostet es ein ♥ (drei pro Partie).
- **Sortenrein:** Eine Reihe aus nur einer Sorte zählt doppelt.
- **Drehen:** Teil antippen; Drehungen sind eine knappe Ressource.
- **Ablage:** Ein Teil zurücklegen oder tauschen.
- **Krokant** blockiert Felder, **Eiskonfekt** schmilzt nach 9 Zügen zu Krokant.
- **Tagesschachtel:** jeden Tag dieselbe Teilefolge für alle, eigener Bestwert.
- **Blitzrunde:** 30 Züge auf Punkte, eigener Bestwert – die kurze Partie für zwischendurch.
- **Erste Züge geführt:** Neue Spieler bekommen statt eines Regel-Dialogs vier Schritte am Spielfeld (legen, drehen, Reihe verpacken, Bestellung).
- **Ränge und Schachtel-Designs** werden über die höchste erreichte Bestellung freigeschaltet.
- **Tagesrunde:** Jeder Tag mit der Tagesschachtel zählt weiter (7 Tage = eine Runde, +1 ★ je Tag, +5 ★ am siebten). Ein verpasster Tag setzt nichts zurück.
- **Tagesziele:** drei pro Tag, für alle gleich; Fortschritt zählt über alle Partien des Tages. Jedes Ziel bringt 1 ★, alle drei zusammen 2 ★ extra.
- **Sterne ★** schalten Förmchen-Farben frei (5, 12, 25, 45) – rein optisch. Dazu elf **Auszeichnungen**.
- **Ergebnis teilen:** nach der Partie als Text über das Teilen-Menü des Geräts bzw. die Zwischenablage.
- Laufende Partien werden gespeichert und beim nächsten Öffnen fortgesetzt.

Live: https://confiserie.micana.de

Das Spiel ist eine einzige statische Seite ohne Build-Schritt und ohne externe Requests – es läuft nach dem ersten Aufruf komplett offline. Spielstände liegen im `localStorage`: `cs_best` (Bestwert), `cs_meta` (Rang, Design, Einstellungen, Sterne, Tagesziele, Tagesrunde, Auszeichnungen), `cs_run_saison`, `cs_run_tag` und `cs_run_blitz` (laufende Partien). Dazu `cs_playtest` (Testprotokoll) und `cs_install_skip` (Zeitpunkt von „Im Browser weiterspielen“).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Spiel (HTML, CSS, JS in einer Datei) |
| `sw.js` | Service Worker: Cache-first für alle App-Dateien |
| `manifest.webmanifest` | PWA-Manifest |
| `fonts/` | Nunito 700/800/900, Playfair Display Italic 700 (SIL OFL 1.1, Lizenztexte liegen bei) |
| `icons/` | App-Icons, erzeugt mit `tools/make-icons.mjs` |
| `art/raw/` | Gemalte Rohbilder aus einem Bildgenerator, so wie geliefert (Magenta-Hintergrund) |
| `art/source/` | Freigestellte Quellbilder (PNG, 1024 px) für Sprites und Icon, erzeugt von `tools/import-art.mjs` |
| `art/PROMPTS.md` | Prompts, um die Quellbilder mit einem Bildgenerator als gemalte Fassung zu erzeugen |
| `sprites/` | Pralinen-Sprites (WebP, 256 px), erzeugt mit `tools/make-sprites.mjs` |
| `tools/` | Hilfsskripte; ihre Pakete stehen als devDependencies in `package.json` |
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

## Layout

Die Schachtel hat 8×8 Felder (`N` Spalten, `R` Zeilen in `index.html`; ein Versuch mit 10 Zeilen wurde zurückgenommen). Ihre Breite `--bw` richtet sich nach der Bildschirmbreite und danach, dass Kopf, Bestellung, Schachtel, Teile und Hinweis in die Höhe passen (Safe Areas eingerechnet); auf hohen Bildschirmen wird die Teile-Ablage höher und der Inhalt steht mittig. Markieren, Kopieren, Kontextmenü, Vorschau und Zoomen sind im Spiel gesperrt – außer im Eingabefeld für den Spielstand-Code.

## Installationshinweis

Im Handy-Browser erscheint beim Start ein Vollbild-Hinweis mit der passenden Anleitung (iPhone/Android, je Browser; auf Android mit „Jetzt installieren“, sobald der Browser es anbietet). „Im Browser weiterspielen“ gilt 6 Stunden. Der Hinweis erscheint nie in der installierten App, nie am Computer und nie in automatisierten Browsern – zum Ansehen `?installGate=1` anhängen. Auf dem iPhone haben Safari und die installierte App getrennte Speicher; der Spielstand lässt sich als Code mitnehmen (Menü → Mehr → Spielstand mitnehmen).

## Testprotokoll und Playtest

Das Spiel schreibt Ereignisse (Sitzung, Partie, Bestellung, Drehen, Ablage, Hänger, Tagesziel, Installationshinweis, Fehler) nur auf dem Gerät mit, höchstens 3000 Einträge. Nichts wird gesendet. Unter Menü → Mehr lässt es sich abschalten, leeren und als `.jsonl` exportieren.

```sh
node tools/playtest.cjs    # Bot-Playtest: Partielänge, Hänger, Ertrag für Tagesziele, Layout-Messung
```

Befunde stehen in `docs/playtest/`.

## Lesbarkeit

```sh
node tools/contrast.cjs    # Textkontraste (Ziel ≥ 4,5) und jede Praline gegen jedes Förmchen (ΔL* Rand / Fläche)
```

Alle Pralinen tragen eine dunkle Kontur und bekommen im Spiel zusätzlich einen feinen dunklen Rand per CSS; nach Änderungen an Sprites, Förmchen- oder Textfarben das Skript laufen lassen.

## Schwierigkeit / Balancing

Alle Stellschrauben stehen in `P(s)` in `index.html` (s = Nummer der Bestellung): Sortenzahl, Bestellmenge, Zuglimit, sperrige Teile, Krokant und Eiskonfekt. Wie sich Änderungen auswirken, zeigt eine Bot-Simulation mit der echten Spiellogik:

```sh
npm i -D playwright       # einmalig
node tools/balance.cjs    # je Bestellung: erreicht %, geliefert %, geplatzt
```

Der Bot wertet jeden Zug aus, nutzt aber weder Ablage noch Drehen; er kommt im Median bis Bestellung 6. Wer plant, kommt weiter.

## Sprites und Icons neu erzeugen

Das Spiel selbst braucht keine Pakete. Nur die Skripte in `tools/` nutzen [sharp](https://sharp.pixelplumbing.com) (devDependency):

```sh
npm i                         # einmalig
node tools/import-art.mjs art/raw   # stellt die gemalten Rohbilder frei -> art/source/*.png
node tools/make-sprites.mjs   # art/source/*.png  -> sprites/*.webp
node tools/make-icons.mjs     # art/source/icon.png -> icons/*.png
```

Die Pralinen sind gemalte Bilder aus einem Bildgenerator (Prompts in `art/PROMPTS.md`), geliefert auf Magenta-Hintergrund. `import-art.mjs` entfernt den Hintergrund von außen her (zusammenhängende Fläche, kein Farbschlüssel – Rosa im Motiv bleibt) und passt drei Motive fürs Spiel an: Die Pistazie wird grün eingefärbt (sonst wäre sie die vierte braune Praline), die Kokoskugel bekommt eine dunkle Kontur (sonst verschwindet sie auf dem hellen Papier), und der Frostring wird aufgeweitet, damit Sorte und Zahl sichtbar bleiben. `tools/make-art.mjs` zeichnet weiterhin die frühere Vektor-Fassung, überschreibt dabei aber `art/source/`.

Quellbilder in `art/source/` (PNG, quadratisch, mind. 1024 px, transparenter Hintergrund – außer `icon.png`):

| Datei | Verwendung |
| --- | --- |
| `truffle-dark.png`, `nougat.png`, `coconut.png`, `raspberry.png`, `pistachio.png`, `caramel.png` | Sorten 0–5 (Zartbitter, Nougat, Kokos, Himbeer, Pistazie, Karamell) |
| `brittle.png`, `brittle-gold.png` | Krokant, Krokant mit Goldrand |
| `frost.png` | Frostring, liegt beim Eiskonfekt über der Sorte |
| `icon.png` | App-Icon, deckend auf `#fbeee6` |

`make-sprites.mjs` schneidet jedes Motiv auf seinen Inhalt zu, skaliert alle Pralinen auf dieselbe deckende Fläche (so wirken Herz, Blatt und Quadrat gleich groß), setzt sie mittig auf 256×256 und schreibt WebP mit Alpha. Es bricht mit Fehler ab, wenn ein Bild fehlt, keinen transparenten Hintergrund hat, eine Datei über 40 KB oder alle zusammen über 350 KB liegen. Schlagschatten gehören nicht ins Bild; die setzt das Spiel per CSS. Die Sprites sind per `background-image` an die Klassen `.p0`–`.p5`, `.blk` und `.blk.l2` gebunden; neue Dateien müssen zusätzlich in `ASSETS` in `sw.js` stehen.

`make-icons.mjs` schreibt 192, 512, 512 maskable (Motiv in der Safe Zone), apple-touch-icon (180) und favicon (48) nach `icons/`, alle deckend.

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
