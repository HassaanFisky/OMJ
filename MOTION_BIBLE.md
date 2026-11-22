# OMJ — MOTION BIBLE & ANIMATION ARCHITECTURE

## 1. Core Animation Philosophy
- **Physical Plush Weight:** Movements must never feel stiff or rigid like robotic vectors. They must exhibit plush squash, stretch, and inertia using custom cubic-bezier and spring physics (`power2.out`, `sine.inOut`, `back.out(1.4)`).
- **Secondary Motion:** Ear wiggles, scarf fringe flutter, cheek blush blooms, and eye saccades provide constant life without distracting jitter.
- **Frame-Rate Target:** 60 FPS transform-based animations using CSS GPU acceleration (`translate3d`, `scale`, `rotate`, `opacity`). Never animate `top`, `left`, `width`, or `height` directly.

---

## 2. GSAP Choreography Systems
- **Master Timeline (`FilmEngine.ts`):** Centralized GSAP timeline synchronized via `currentTime` from `AudioController.ts` or standalone normalized delta time in preview mode.
- **Breathing Idle Cycles:**
  - Torso: `scaleY: 1.03`, `scaleX: 0.99`, duration 2.8s, ease `sine.inOut`, yoyo: true, repeat: -1.
  - Head: `y: -2px`, `rotation: 1deg`, duration 2.8s, delay 0.2s.
- **Kiss Contact Mechanics (Scene C & L):**
  - Character heads tilt inward (`rotation: -6deg` and `+6deg`).
  - Noses compress slightly (`scaleX: 0.92`, `scaleY: 0.95`).
  - Eyelids lower smoothly over 0.4s to closed expression.

---

## 3. Particle Systems (Canvas Engine)
- **Engine:** Off-DOM / High-performance Canvas rendering (`ParticleEngine.ts`) with requestAnimationFrame lifecycle and auto-throttle when tab is inactive.
- **Presets:**
  - *Fireflies:* Warm bioluminescent orbs with Perlin noise wander paths.
  - *Raindrops & Splashes:* High-velocity downward streaks with collision ripples at ground level.
  - *Snowflakes:* Multi-size drift with lateral trigonometric oscillation (`Math.sin(angle)`).
  - *Floating Hearts:* Slow buoyant upward drift with gentle rocking and opacity dissipation.
  - *Stardust / Nebula Mist:* Soft Gaussian glow particles suspended in deep space.
