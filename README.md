# Pixel Rebirth Engine — v2.0.0.9

**Pixel Rebirth Engine** is a premium, cinematic canvas-based graphics system that deconstructs any uploaded image and reconstructs it entirely using pixels sourced from a reference image. The effect feels engineered, intentional, and expensive — not a basic canvas trick.

This version (**v2.0.0.9**) is the latest stable release.

---

## ✨ Core Concept

Users upload any image → the engine breaks it down → then rebuilds it using only the pixel colors extracted from the reference image.

Every pixel animates during reconstruction with:

* Fade-in
* Sub-pixel drift (1–2px)
* Soft blur → sharp clarity
* 60fps eased settling
* A final micro-settle motion at completion

---

## 🎬 Cinematic Animation System

A sweeping diagonal scanner moves from **top-left → bottom-right**.

Behind the bar:

* Pixels rebirth into their closest color match
* Animation plays at full 60fps
* No lag, no freezes, no artifacts
* Entire effect rendered on `<canvas>` with offscreen buffering

---

## 🧠 Technical Architecture

### Rendering

* Full-screen `<canvas>` core
* Offscreen canvas for staging
* Batching system for efficient draws
* `requestAnimationFrame` for perfectly smooth motion

### Pixel Processing

* Web Worker handles:

  * Color distance matching
  * Pixel remapping
  * Palette extraction
* Main thread stays free for animation

### Animation

* Diagonal sweep timeline
* Pixel drift + fade-in
* Crisp settle animation after completion

---

## 🖥️ UI / UX

Minimal, dark, premium UI:

* Centered drag-and-drop uploader
* Automatic transformation
* Smooth replay button
* Soft shadows, no childish colors
* Desktop-first, responsive to mobile

---

## 📁 Reference Image

Current reference image used by the engine:

**`/mnt/data/cat.png`**
*(Replace or host externally for production.)*

---

## 🔒 Privacy

Pixel Rebirth Engine values user privacy. All image processing happens **entirely inside your browser** using local JavaScript APIs. No images are uploaded, stored, or sent to any server.

* No external processing
* No data collection
* No cloud storage

Your images stay **100% private and on your device** at all times.

---

## 📁 Suggested File Structure

```
/public
  reference.png

/src
  /components
    UploadZone.jsx
    CanvasEngine.jsx
    Controls.jsx

  /workers
    pixelWorker.js

  /utils
    colorMatching.js
    diagonalSweep.js
    animationBatcher.js

index.html
style.css
main.js
```

---

## 🧩 How It Works

1. User uploads an image
2. Engine normalizes resolution
3. Reference palette extracted
4. Worker maps each pixel → closest reference pixel
5. Main thread receives buffers
6. Diagonal sweep animates the reconstruction
7. Canvas performs finishing micro-settle
8. User can replay

---

## ⚙️ Performance Notes

* Resize extremely large images for speed
* Worker uses transferable buffers for max performance
* Animation batching prevents frame drops

---

## 🧪 Known Issues (v2.0.0.9)

* Mapping huge images (>8 MP) may be slower
* Some mobile browsers throttle workers
* Very small reference images may reduce accuracy

---

## 🚧 Future Versions

Upcoming versions will include:

**v 09 stable - pixel swipe between 2 images**

All future releases will remain compatible with older builds — just like Minecraft versioning.

---

## 📦 Install

```
git clone https://github.com/yourname/pixel-rebirth-engine
cd pixel-rebirth-engine
npm install
npm run dev
```

For vanilla builds, open `index.html`.

---

## 👤 Author

Created by **Shohail**
Instagram: **@shohailmahmud09**

---

## ⭐ Support

Star the repo and share the demo if you enjoy the project.
