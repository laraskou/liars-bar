# Liar's Bar Helper

A small helper for the _Liar's Bar_ table: a random card-type picker and a Russian roulette simulator. Plain HTML, CSS and JavaScript, no build step, no dependencies. Touch-first and works offline.

## Tools

- **Table** – draws King, Queen or Ace (1/3 each) with a flip animation.
- **Roulette** – a 6-chamber revolver with exactly one loaded chamber, shuffled every round. Used chambers are not reused, and the counter (`x / 6`) never reveals the loaded one. After BANG, a prompt asks whether to reload.

The UI is available in English (default) and German.

## Run

Open `index.html` in a browser.

## Structure

```
index.html   markup
style.css    styles
script.js    logic (cards, roulette, sound, language)
config.js    asset paths
i18n.js      UI texts (EN / DE)
assets/
  photos/    back.jpg, K.jpg, Q.jpg, A.jpg, logo.png
  sounds/    click.mp3, bang.mp3
  rye-latin-400-normal.woff2
```
