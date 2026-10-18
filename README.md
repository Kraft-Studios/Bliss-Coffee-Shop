# Bliss Coffee Roastery

A website for **Bliss Coffee Roastery**, a coffee shop and roastery in Kimberley, Northern Cape.

Live site: https://kraft-studios.github.io/Bliss-Coffee-Shop/

## Pages

| Page | What it covers |
| --- | --- |
| `index.html` | Home: a scroll-driven story with pinned video sections, the roast, the cup, the space and a feed of Instagram posts |
| `menu.html` | The menu, with section tabs and a "My picks" list to show at the counter |
| `coffee.html` | A guide to the beans, a "find your bean" quiz and a brew calculator with timer |
| `story.html` | A look around the room |
| `visit.html` | Address, map and practical information |

## Features

- Pinned, scroll-driven hero, jokes and iced mocha sections
- Coffee finder quiz and brew lab (ratio calculator with a guided timer)
- Menu section tabs and saved "My picks"
- Image viewer, scroll-to-top button and coffee-bean cursor
- Responsive layout, with reduced-motion support
- Videos that autoplay muted, with a tap-to-play fallback on phones that block autoplay

## Run locally

It is a static site with no build step. From the project folder:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Project structure

```
index.html  menu.html  coffee.html  story.html  visit.html
css/
  style.css    base styles and design tokens
  theme.css    premium theme layer and interactive components
js/
  main.js      scroll-driven sections and video playback
  extras.js    quiz, brew lab, menu picks, image viewer, cursor
assets/
  images/      photography
  video/       short looping clips
```

## Credits

Photography and video belong to Bliss Coffee Roastery
([@blisscoffeeroastery](https://www.instagram.com/blisscoffeeroastery/) on Instagram).
Fonts: Cormorant Garamond and Jost, via Google Fonts.
