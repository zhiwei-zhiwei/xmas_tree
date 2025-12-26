# Project Recreation Prompt (90%+ Similarity Target)

You are Codex. Recreate a React + Vite + TypeScript project that renders an interactive, luxurious Christmas tree scene with postprocessing bloom, instanced ornaments, dynamic photo frames pulled from a local folder, and camera + hand-gesture interactions. The target is to match the existing project structure, visuals, and behaviors with ~90% similarity. Follow the details below as closely as possible.

---

## 1) Tech Stack & Tooling
- Vite + React 19 + TypeScript.
- Three.js with @react-three/fiber and @react-three/drei.
- postprocessing for bloom.
- Tailwind is installed but not actively used for layout (CSS is custom).
- Mediapipe hand tracking via `@mediapipe/hands` and `@mediapipe/camera_utils`.

Dependencies (package.json):
```
@react-three/drei ^10.0.0
@react-three/fiber ^9.4.2
@mediapipe/camera_utils ^0.3.1675466862
@mediapipe/hands ^0.4.1675469240
postprocessing ^6.36.3
react ^19.0.0
react-dom ^19.0.0
three ^0.168.0
```

Dev dependencies:
```
@vitejs/plugin-react ^4.3.1
typescript ^5.5.4
tailwindcss ^3.4.6
postcss ^8.4.39
autoprefixer ^10.4.19
@types/node, @types/react, @types/react-dom
```

Scripts:
```
dev: vite
build: tsc -b && vite build
preview: vite preview
```

---

## 2) Folder Structure
```
grand-luxury-tree/
  public/
    photos/                # photos used on the tree (JPG)
  src/
    App.tsx
    main.tsx
    index.css
    scene/
      GrandTree.tsx
      PostEffects.tsx
      SceneErrorBoundary.tsx
      HandGestureController.tsx
      GestureCameraController.tsx
    vite-env.d.ts
  vite.config.ts
```

---

## 3) Vite Plugin: Dynamic Photo List
Create a custom Vite plugin in `vite.config.ts` that:
- Reads `public/photos` directory.
- Filters by extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.
- Sorts filenames and returns a virtual module `virtual:photo-list` that exports:
  ```ts
  export const photoUrls: string[] = ["/photos/xxx.JPG", ...];
  ```
- Watches the photos directory in dev and invalidates the virtual module on change.

Add the module declaration in `src/vite-env.d.ts`:
```ts
declare module 'virtual:photo-list' { export const photoUrls: string[]; }
declare module '@mediapipe/hands';
declare module '@mediapipe/camera_utils';
```

---

## 4) App.tsx (Main Scene Container)
- Use `<Canvas>` from @react-three/fiber.
- Set camera: position `[0, 2.6, 8]`, fov `48`, near `0.1`, far `60`.
- Use ACESFilmic tone mapping and exposure `1.1`.
- Clear color transparent black (alpha 0).
- Add fog with `#0b1b2a`, near 9, far 28.
- Render `<GrandTree mode={mode} />`.
- Use `<OrbitControls>` with:
  - `enablePan={false}`
  - `minDistance={6}`, `maxDistance={12}`
  - `minPolarAngle={0.55}`, `maxPolarAngle={1.45}`
  - `autoRotate` enabled unless hand is active
  - `autoRotateSpeed={0.3}`
- Add `<PostEffects />` for bloom.
- Add `<GestureCameraController>` using `controlsRef` + `handRef`.
- Add `<HandGestureController>` at top-level, not inside Canvas.
- Listen to Spacebar to toggle mode: `FORMED` ↔ `CHAOS`.
- Mode label map: `FORMED -> "Formed"`, `CHAOS -> "Unleashed"`.

Overlay:
- Only show a status badge at bottom-left:
  ```
  Status: Formed / Unleashed
  ```
- The earlier top-left panel and bottom-right footnote are not rendered (CSS exists but not used).

---

## 5) CSS (index.css)
Match the atmospheric styling and layout:
- Import fonts: `Cinzel` and `Gloock` from Google Fonts.
- Dark gradient background with starry overlay using `body::before` and `body::after`.
- `.app-shell` relative, full size, overflow hidden.
- `.app-canvas` absolute, full size.
- `.app-overlay` absolute, padding, pointer-events none.
- `.lux-panel` style for status badge.
- `.lux-status` uppercase, letter spacing.
- Keep existing unused classes (lux-panel-main, lux-title, lux-subtitle, etc.) in CSS.

Gesture preview panel (top-right):
```
.gesture-preview-panel {
  position: absolute;
  top: 1.25rem;
  right: 1.5rem;
  width: 190px;
  border-radius: 0.9rem;
  border: 1px solid rgba(246, 216, 122, 0.4);
  background: rgba(6, 25, 18, 0.75);
  box-shadow: 0 0 24px rgba(246, 216, 122, 0.18);
  padding: 0.5rem;
  display: grid;
  gap: 0.4rem;
  pointer-events: none;
  z-index: 3;
}
.gesture-preview-video { height: 120px; object-fit: cover; border-radius: 0.6rem; }
.gesture-preview-label { font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; }
```

---

## 6) PostProcessing Bloom (PostEffects.tsx)
- Use `EffectComposer` with `RenderPass` and `EffectPass`.
- Bloom settings:
  - intensity: `0.8`
  - luminanceThreshold: `0.9`
  - luminanceSmoothing: `0.08`
  - mipmapBlur: `true`
- Use `useFrame` to render composer.
- Ensure composer resizes on canvas size changes.

---

## 7) Hand Gesture Control (HandGestureController.tsx)
Behavior:
- Uses Mediapipe Hands + Camera utils.
- Default to `selfieMode: true`.
- Detect one hand.
- showPreview default `true` and show video + status.
- Gesture detection: open hand triggers CHAOS, closed hand triggers FORMED.
- Movement: map palm center to `[-1,1]` range for camera control.
- Stability: require 3 stable frames before switching gesture.
- Confidence: `minDetectionConfidence` and `minTrackingConfidence` both `0.5`.
- Use two strategies for open/closed:
  1. Finger extended count (tips vs PIP y position).
  2. Average tip distance vs palm size if ambiguous.

Implementation specifics:
- Create a `<video>` element via ref, used by `Camera` from `@mediapipe/camera_utils`.
- The preview panel is visible and shows `Camera active / Camera error / Camera idle` and `Open hand / Closed hand / Hand detected / No hand`.
- Cleanup: stop camera, stop tracks, reset internal state on unmount.

---

## 8) Gesture Camera Control (GestureCameraController.tsx)
Behavior:
- Reads normalized hand movement values from a ref.
- When hand active, capture current azimuth/polar as base.
- Map hand x to azimuth (range 0.75), hand y to polar (range 0.45).
- Use THREE.MathUtils.damp for smooth interpolation.
- Clamp polar between OrbitControls minPolarAngle and maxPolarAngle.

---

## 9) Scene: GrandTree.tsx
The tree is a single component with many subcomponents:
- `TreeMode`: `FORMED` and `CHAOS`.
- `progress` is damped to target state each frame.
- `groupRef` rotates gently over time.

### Core constants:
```
TREE_HEIGHT = 4.6
TREE_RADIUS = 2.1
CHAOS_RADIUS = 6.4

FOLIAGE_COUNT = 1860
GIFT_COUNT = 80
BAUBLE_COUNT = 140
LIGHT_COUNT = 36
STAR_COUNT = 50
SPIRAL_COUNT = 90
SPIRAL_TURNS = 3.4
SNOW_COUNT = 520
ROOT_PINE_COUNT = 16
ROOT_BERRY_COUNT = 22
GROUND_GIFT_COUNT = 26
BASE_Y = -TREE_HEIGHT / 2 - 0.75
```

### Foliage (Shader Points)
- Custom vertex/fragment shaders.
- Positions blend between target and chaos via `uProgress`.
- Add breathing and twinkle.
- Use additive blending and transparent points.
- Colors: base green `#0a4a32`, gold `#f6d87a`.
- Alpha is softened: multiply by 0.75; color is slightly dimmed.

### OrnamentCluster
Instanced ornaments:
- Gift boxes (cube) with per-instance color (random red or green).
  - Color palette: `#E73B2B` and `#1E8A4B`.
  - Material: metalness 0.2, roughness 0.25, emissive `#2a0c12`, emissiveIntensity 0.18.
- Gift ribbons (gold) and bow sphere.
- Baubles: gold physical material, clearcoat and specular.
- Light orbs: warm yellow, lower emissive intensity.
- Stars: octahedrons with emissive.

Distribution:
- `buildLayeredOrnaments` used for gifts, baubles, lights with height bias to make bottom fuller.
- Parameters:
  - gifts: `tMin 0.02, tMax 0.9, tPower 1.35`
  - baubles: `tMin 0.03, tMax 0.9, tPower 1.25`
  - lights: `tMin 0.02, tMax 0.88, tPower 2.6`

### SpiralLights
- Two instanced spirals: red and green.
- Spheres (24 segments).
- Emissive pulse (sin waves).
- `toneMapped={false}`.

### PhotoOrnaments
- Uses `photoUrls` from Vite virtual module.
- Photos distributed evenly along tree height (not top-heavy).
- In CHAOS (progress > 0.75), photo frames billboard to camera and scale up to 2x.
- Photo sizes preserve original aspect ratio, fit inside frame:
  - `maxWidth = 0.64`, `maxHeight = 0.7`.
- Photo textures: SRGB, anisotropy 16, linear mipmap filtering.
- Photo material: emissive map on, emissiveIntensity 0.42, roughness 0.12, toneMapped false.

Photo frame:
- Backing: box 0.7 x 0.85 x 0.04, off-white (#f7f2e8).
- Top clip: small gold bar.
- Photo plane offset slightly upward (y=0.04).

### RootDecor
Adds fullness at tree base:
- Wreath ring (torus) in red.
- Pine cones (cones) in brown.
- Berries (small spheres) in red with faint emissive.

### GroundGiftRing (Base Gifts)
Ring of gifts around base:
- Body green (vertex colors, palette is just `#1E8A4B`).
- Red lid as separate instanced mesh.
- Gold ribbon and bow.
- Body lowered slightly relative to lid.

### Snowfall
Animated points falling from above (SNOW_COUNT).
- Size 0.045, opacity 0.7.

### Lighting
Lights in scene:
```
ambientLight intensity 0.6 color #0b3b2a
hemisphereLight intensity 0.6 color #f6e6b2 groundColor #0b2d1f
directionalLight position [3,5,6] intensity 1.25 color #fff2c4
pointLight [0,1.6,5.4] intensity 1.1 color #fff1c9
pointLight [0,3.8,0] intensity 2.4 color #f6d87a
pointLight [-4,2,-2] intensity 1.4 color #d4af37
spotLight [6,8,6] intensity 3.4 angle 0.35 penumbra 0.6 color #f6d87a
Environment preset "warehouse"
```

### Ground
- Large gold circular base: radius 3.4.
- Ring border: inner 2.6, outer 3.45.

### Tree Group Offsets
- The main tree group is offset down by `[0, -1.4, 0]`.
- Top ornament: torusKnot geometry, gold.

---

## 10) Scene Error Boundary
Add a React error boundary that displays a styled error card when the scene fails.

---

## 11) Behavior Summary
- Spacebar toggles the tree between FORMED and CHAOS.
- In CHAOS:
  - Ornaments move toward “chaos” positions in a larger sphere.
  - Photo frames billboard toward camera and scale to 2x.
- Hand gesture:
  - Open hand => CHAOS
  - Closed hand => FORMED
  - Hand movement controls camera angles
  - When a hand is active, auto-rotate is disabled.

---

## 12) Visual Style Notes
Aim for a premium, luxurious, cinematic feel:
- Emerald greens, gold highlights, ruby reds.
- Soft bloom; avoid overexposure.
- Rich gradient night sky background with drifting star pattern.
- Subtle motion: slow rotation, wobble, snowfall, sparkles.

---

## 13) Output Expectation
The recreated project should compile and run with `npm install` and `npm run dev`. The resulting scene must:
- Show the full tree with ornaments, photos, and base gifts.
- Load all images in `public/photos` with no duplicates and no manual list.
- Match the gesture interaction and UI preview panel.
- Mirror the described layouts, colors, counts, and movement logic.
