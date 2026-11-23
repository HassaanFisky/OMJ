# OMJ — VISUAL QA & RESPONSIVE DESIGN SPECIFICATION

## 1. Viewport Matrix & Composition Verification

| Viewport Profile | Dimensions | Composition Alignment & Safe Areas |
| :--- | :--- | :--- |
| **iPhone 14 Pro (Primary Reference)** | 393 × 852 CSS px | Letterboxed 9:16 cinematic stage, `env(safe-area-inset-top)` header offset, bottom controls floating above home indicator bar (`env(safe-area-inset-bottom) + 16px`). Zero horizontal overflow. |
| **iPhone 13 / 14** | 390 × 844 CSS px | Identical aspect ratio scaling; plush teddies remain centered in action safe area. |
| **iPhone 14 Pro Max / 15 Plus** | 430 × 932 CSS px | Dynamic viewport height (`100svh`) maintains perfect framing without content clipping. |
| **Desktop / Laptop** | 1440 × 900 CSS px | Centered cinematic aspect container with rich midnight ambient vignetting and expanded letterbox borders. |

---

## 2. Character Visual & Contact Integrity

### Chubby Plush Proportions
* Head: `rx: 63, ry: 62` (large spherical volume with drooping cheeks).
* Belly: `rx: 52, ry: 68` (cuddly plush tummy with lighter felt patch).
* Limbs: Thick stubby arms (`rx: 17, ry: 26`) and rounded feet pads with embroidered toe dots.
* Surface Detail: Dashed back seam (`stroke-dasharray="2 7"`), ear velvet insets, and neck accessories (Teddy A knitted scarf; Teddy B silk ear ribbon).

### Facial Emotion & Eye Architecture
* Eyes: Sclera oval with obsidian-plum gradient iris (`#2d1a38` to `#0a0410`).
* Specular Catchlights: Dual light points (primary oval top-left, secondary bounce bottom-right).
* Blinking: Multi-phase organic eyelid droop with dynamic scaling, preventing robotic repetition.
* Sadness & Tear Physics: Mouth curve flexes downward (`M-10-115Q0 -129 10-115`), glistening tear layer (`eyeWater`) brightens, and tear droplets fall along the cheek with gravity.

### Contact Mechanics & Inverse Kinematics
* Hand-Holding (`attachHand`): Both paws meet at mid-coordinate `((a.x + b.x) / 2, min(a.y, b.y) - 43)` with smooth IK interpolation.
* Hug Contact: Character A reaches around Character B's back; Character B rests paw on Character A's shoulder.
* Lap Rest (Scene M): Character A rests head directly in Character B's lap (`frame.a.x + 150 * frame.a.scale ≈ frame.b.x - 22`), verified mathematically by automated test.
* Innocent Kiss (Scene C): 11° inward head tilt, eyelids 75% closed, snout proximity with micro-squash deformation.

---

## 3. Atmospheric Motifs & Environmental Transitions
* **The Firefly Guide:** Warm `#ffdf80` bioluminescent orb with smooth trigonometric drift and 14px radial glow aura.
* **Puddle Ripples:** Concentric expanding ellipses at `y: 948` during rainfall.
* **Night Starfield:** Multiplane twinkling stars with 16-point starburst accents.
* **Snow Drift:** Sinusoidal lateral sway during winter sequences.
* **Heart Shower:** Depth-layered floating hearts with opacity fade and gentle rocking.

---

## 4. Accessibility & Touch Standards
* All primary buttons meet or exceed the WCAG AA minimum 44 × 44 CSS px touch target.
* Keyboard navigation support: `Space` (Play/Pause), `ArrowLeft` / `ArrowRight` (Step 5s), `Escape` (Pause).
* Reduced motion: Disables particle drift, eliminates camera zoom transitions, and simplifies eye blinks to instantaneous state changes.
