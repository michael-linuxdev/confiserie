# Prompts für gemalte Pralinen

Zehn Bilder, PNG, quadratisch, mindestens 1024×1024. Alle außer `icon.png` mit **transparentem
Hintergrund**. Fertige Dateien unter genau diesen Namen nach `art/source/` legen, dann:

```sh
node tools/make-sprites.mjs && node tools/make-icons.mjs && node tools/contrast.cjs
```

(`tools/make-art.mjs` nicht mehr starten – es würde die Bilder mit den gezeichneten überschreiben.)

## So bleiben die Bilder einheitlich

- Den Stil-Vorspann bei jedem Bild wörtlich voranstellen.
- Wenn der Generator es kann: denselben Seed bzw. das erste gelungene Bild als Stil-Referenz für alle weiteren.
- Kann er keinen transparenten Hintergrund: „on a plain flat magenta background (#ff00ff)“ statt
  „transparent background“ schreiben und danach freistellen.
- `brittle-gold` aus `brittle` ableiten (Bild-zu-Bild / Edit), damit es derselbe Splitter ist.

## Stil-Vorspann (für alle außer icon.png)

```
Hand-painted casual mobile game sprite, single chocolate confection, viewed from above at a
slight 3/4 angle, soft studio light from top left, glossy highlights, rich saturated colours,
clean silhouette, thick readable shapes, dark brown outline, no text, no plate, no paper cup,
no cast shadow, centered, fills about 80% of the frame, transparent background, 1024x1024.
```

## Motive

| Datei | Prompt (an den Vorspann anhängen) |
| --- | --- |
| `truffle-dark.png` | Round dark chocolate truffle dome with fine light-brown cocoa drizzle lines across the top. |
| `nougat.png` | Square milk-chocolate nougat praline with rounded corners and one whole hazelnut on top. |
| `coconut.png` | White chocolate ball densely coated in coconut flakes, clearly outlined so it reads on a cream background. |
| `raspberry.png` | Heart-shaped raspberry praline with shiny pink glaze and a bright highlight. |
| `pistachio.png` | Leaf-shaped green pistachio praline with a centre vein and chopped pistachio crumbs. |
| `caramel.png` | Hexagonal golden caramel praline with white sea salt flakes on top. |
| `brittle.png` | Rough broken shard of almond brittle, dark amber and brown, with visible almond pieces, jagged edges. |
| `brittle-gold.png` | The same almond brittle shard, wrapped diagonally with a thin shiny gold foil band. |
| `frost.png` | A ring of white frost and pale blue ice crystals only, with small icicle spikes; the centre is completely empty and transparent; the ring touches the frame edges. |

## icon.png (deckend, kein Alpha)

```
Hand-painted casual mobile game app icon: a glossy pink heart-shaped raspberry praline sitting in
an open dark-brown chocolate box with a thin gold trim, lid leaning back, viewed from above at a
slight 3/4 angle, soft studio light from top left, rich saturated colours, thick readable shapes,
no text, centered with generous margin, flat plain cream background #fbeee6, fully opaque,
1024x1024.
```

## Worauf beim Aussuchen achten

- Jede Sorte muss an **Form und Farbe** sofort erkennbar sein; im Spiel sind die Bilder 25–45 px groß.
- Karamell (golden, Sechseck) und Krokant (dunkler, gezackt) dürfen sich nicht ähneln.
- Kokos braucht eine dunkle Kontur, sonst verschwindet es auf dem hellen Papierförmchen
  (`tools/contrast.cjs` misst das: „Rand“ sollte über 20 liegen).
- Kein Schatten unter der Praline, nichts abgeschnitten, kein Text, kein Teller.
- Der Frostring muss in der Mitte leer sein – dort stehen Sorte und Zahl.
