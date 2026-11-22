# OMJ — CHARACTER BIBLE: THE PLUSH TEDDY RIGS

## 1. Core Anatomy & Proportions (Strict Mandate)
**DO NOT CREATE SKINNY, LEAN, ELONGATED OR UNNATURAL TEDDY CHARACTERS.**
Both characters are modeled after high-end, premium plush toys with chubby, rounded proportions:

- **Head:** Large, perfectly spherical base with chubby, slightly drooping cheeks (`rx: 34`, `ry: 32`).
- **Torso:** Compact, rounded, with a prominent cuddly belly (`rx: 30`, `ry: 36`).
- **Limbs:**
  - Arms: Short, thick, rounded plush paws with no sharp joints.
  - Legs: Short, stubby, positioned forward in sitting/cuddling poses with padded paw soles.
- **Ears:** Soft semi-circular rounded cups with darker inner velvet patches (`rx: 10`, `ry: 10`).
- **Muzzle & Nose:** Tiny, slightly protruding oval muzzle (`#f5f0ea`) with a delicate chocolate-brown button nose (`#3e2723`) featuring a micro-specular highlight.
- **Mouth:** Subtle curved stitch smile with emotional flexure (neutral, soft smile, nervous wobble, open happy gasp).

---

## 2. Character Distinctions
### Character 1 (Teddy A - The Waiting Soul / Male Teddy)
- **Fur Color:** Warm honey-caramel plush (`#8B5A2B` base, `#D4A373` highlights, `#5C3A1E` shadows).
- **Defining Accessory:** Soft knitted miniature scarf or collar seam with subtle stitch accents.
- **Personality in Motion:** Thoughtful, slightly hesitant, deeply affectionate, emotional eye gaze.

### Character 2 (Teddy B - The Guiding Light / Female Teddy)
- **Fur Color:** Creamy blush velvet (`#E8C39E` base, `#F3E0CC` highlights, `#B08968` shadows).
- **Defining Accessory:** Delicate silk ear ribbon or pastel rosy hair ornament with soft fabric drop.
- **Personality in Motion:** Gentle, reassuring, curious, comforting, tender touch.

---

## 3. Facial Art & Emotion Rigging
- **Eye Construction:**
  - Base: Deep obsidian glossy discs (`#1a1a1a`).
  - Specular Highlights: Multi-tiered glassy reflections (primary top-left oval highlight `#ffffff`, secondary soft bottom-right crescent bounce `#e0e0e0`).
  - Emotional States:
    - *Happy / Content:* Soft curved eye squints with heightened cheek blush (`#e8a598` at 60% opacity).
    - *Longing / Sadness:* Watery glass shader overlay (`#ffffff` opacity pulse) + physical falling teardrop curve (`#a0d2eb` with specular gleam).
    - *Nervous:* Eye pupils darting sideways, micro-shiver on paw rigs.
- **Blinking:** Realistic 3-phase blink via GSAP timeline (closing: 0.08s, closed: 0.04s, opening: 0.12s) with randomized natural intervals (2.5s – 5.5s).

---

## 4. Plush Material & Shading Architecture
- Layered SVG linear and radial gradients mimicking soft velour / cotton plush.
- Tactile dashed stroke stitches (`stroke-dasharray="2,3"`) along limb joints and ear bases.
- Contact ambient occlusion: Drop shadows below seated rumps (`ellipse` with `feGaussianBlur stdDeviation="6"`).
