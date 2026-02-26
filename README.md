# Pump Flow

Pump Flow is a mobile-first pumptrack riding game built with vanilla HTML, CSS, and JavaScript. It aims for smooth rhythm-based movement where timing your pumps and pops creates speed and score chains.

## Gameplay

- **Hold touch on downslopes** to pump and accelerate.
- **Release near crests** to pop into the air.
- **Tap while airborne** for extra style through flips.
- Land cleanly to keep your streak and maximize score.
- Reach checkpoints to secure fast crash restarts.

Each run is a finite course with a live progress bar, checkpoint markers, and a run timer.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Project structure

- `index.html` - app shell + screens
- `styles.css` - mobile-first minimalist styling
- `game.js` - game loop, touch controls, physics, checkpoints, timer, camera, and rendering
- `manifest.webmanifest` - PWA metadata
- `sw.js` - offline cache + update handling
- `assets/icon.svg` - app icon

## PWA notes

The app is installable and supports offline play through the service worker cache.
