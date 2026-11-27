import { useEffect, useRef, useState } from "react";
import type { WorldAction } from "../world/actions";
import { HUG_LABELS, HUG_SHORT_LABELS } from "../world/actions";
import type { HugPreset, WorldState } from "../world/state";

export interface ExploreHudProps {
  world: WorldState;
  reduced: boolean;
  onDispatch(action: WorldAction): void;
  onToggleReduced(): void;
}

const WEATHER_OPTIONS = [
  ["clear", "Clear", "☾"],
  ["cloudy", "Cloudy", "☁"],
  ["rain", "Rain", "☂"],
  ["snow", "Snow", "❄"],
] as const;

const TIME_OPTIONS = [
  ["night", "Night"],
  ["twilight", "Twilight"],
  ["dawn", "Dawn"],
  ["day", "Day"],
] as const;

/** The presets offered in the compact picker, in deliberate order. */
const HUG_PRESETS: HugPreset[] = [
  "gentle",
  "comforting",
  "shy",
  "reunion",
  "sway",
  "handhold",
  "nosenose",
];

const HUG_GLYPH: Record<HugPreset, string> = {
  gentle: "◠",
  comforting: "❍",
  shy: "◔",
  reunion: "◕",
  sway: "∿",
  handhold: "∞",
  nosenose: "◡",
  wave: "✋",
};

/**
 * The exploration HUD.
 *
 * Quiet by design: one atmosphere row, one character row, and disclosures for
 * the room's lights and the interaction library. Every control here maps to a
 * real action and a real change in the world — there are no mood buttons.
 */
export function ExploreHud({ world, reduced, onDispatch, onToggleReduced }: ExploreHudProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [hugOpen, setHugOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const hugging = world.interaction.kind === "hug";
  const onBed = world.interaction.kind === "bed";
  const activePreset = hugging ? world.interaction.preset : null;

  // Close the picker on Escape and on an outside click, so it never traps the
  // room. Selecting a preset deliberately keeps it open: the user is comparing
  // variations, and closing after each one made that impossible.
  useEffect(() => {
    if (!hugOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHugOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(event.target as Node)) setHugOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [hugOpen]);

  const lampOn = world.lamp.targetKerosene > 0.5;

  return (
    <aside className="explore-hud" aria-label="Room atmosphere" data-hud-surface>
      <div className="hud-row" role="group" aria-label="Weather">
        {WEATHER_OPTIONS.map(([condition, label, glyph]) => (
          <button
            key={condition}
            type="button"
            className="hud-pill"
            aria-label={`Weather: ${label}`}
            data-active={world.weather.condition === condition}
            aria-pressed={world.weather.condition === condition}
            onClick={() =>
              onDispatch({
                id: `hud-weather-${condition}`,
                type: "setWeather",
                condition,
              })
            }
          >
            <span aria-hidden="true">{glyph}</span>
            <span className="hud-pill-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="hud-row" role="group" aria-label="Time of day">
        {TIME_OPTIONS.map(([atmosphere, label]) => (
          <button
            key={atmosphere}
            type="button"
            className="hud-pill hud-pill-text"
            data-active={world.time.atmosphere === atmosphere}
            aria-pressed={world.time.atmosphere === atmosphere}
            onClick={() =>
              onDispatch({
                id: `hud-time-${atmosphere}`,
                type: "setAtmosphere",
                atmosphere,
              })
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="hud-row hud-row-tight" role="group" aria-label="Characters">
        <button
          type="button"
          className="hud-pill hud-pill-text"
          data-active={world.characters.mochi.waveImpulse > 0}
          onClick={() => onDispatch({ id: "hud-wave", type: "wave", who: "both" })}
        >
          Wave
        </button>

        <div className="hud-popover-anchor" ref={pickerRef}>
          <button
            type="button"
            className="hud-pill hud-pill-text"
            data-active={hugOpen || hugging}
            aria-expanded={hugOpen}
            aria-haspopup="menu"
            onClick={() => setHugOpen((open) => !open)}
          >
            {hugging ? HUG_SHORT_LABELS[activePreset ?? "gentle"] : "Hug"}
            <span className="hud-caret" aria-hidden="true">
              ▾
            </span>
          </button>

          {hugOpen && (
            <div
              className="hug-picker"
              role="menu"
              aria-label="Choose a hug"
              data-hug-picker
            >
              <p className="hug-picker-title">Hug</p>
              <div className="hug-picker-grid">
                {HUG_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    role="menuitemradio"
                    aria-checked={activePreset === preset}
                    data-preset={preset}
                    data-active={activePreset === preset}
                    className="hug-option"
                    onClick={() =>
                      onDispatch({ id: `hud-hug-${preset}`, type: "hug", preset })
                    }
                  >
                    <span className="hug-option-glyph" aria-hidden="true">
                      {HUG_GLYPH[preset]}
                    </span>
                    <span className="hug-option-label">{HUG_SHORT_LABELS[preset]}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="hug-neutral"
                onClick={() => {
                  onDispatch({ id: "hud-neutral", type: "neutral" });
                  setHugOpen(false);
                }}
              >
                Step back to neutral
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="hud-pill hud-pill-text"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          {moreOpen ? "Less" : "More"}
        </button>
      </div>

      {moreOpen && (
        <div className="hud-more">
          <div className="hud-row" role="group" aria-label="Lights">
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={lampOn}
              aria-pressed={lampOn}
              onClick={() => onDispatch({ id: "hud-lamp-toggle", type: "light", source: "lamp", on: !lampOn })}
            >
              {lampOn ? "Lamp on" : "Lamp off"}
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={world.lamp.cove}
              aria-pressed={world.lamp.cove}
              onClick={() => onDispatch({ id: "hud-cove", type: "light", source: "cove" })}
            >
              Room light
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={world.lamp.fairyLights}
              aria-pressed={world.lamp.fairyLights}
              onClick={() => onDispatch({ id: "hud-fairy", type: "light", source: "fairies" })}
            >
              Fairy lights
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={world.lamp.candle}
              aria-pressed={world.lamp.candle}
              onClick={() => onDispatch({ id: "hud-candle", type: "light", source: "candle" })}
            >
              Candle
            </button>
          </div>

          <label className="hud-slider" data-hud-surface>
            <span className="hud-slider-label">Lamp</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(world.lamp.targetKerosene * 100)}
              aria-label="Lamp brightness"
              onChange={(event) =>
                onDispatch({
                  id: `hud-lamp-${event.target.value}`,
                  type: "light",
                  source: "lamp",
                  intensity: Number(event.target.value) / 100,
                  on: Number(event.target.value) > 0,
                })
              }
            />
            <output className="hud-slider-value">{Math.round(world.lamp.targetKerosene * 100)}</output>
          </label>

          <label className="hud-slider" data-hud-surface>
            <span className="hud-slider-label">Warmth</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((5200 - world.lamp.targetKelvin) / 3.4)}
              aria-label="Room warmth"
              onChange={(event) =>
                onDispatch({
                  id: `hud-warmth-${event.target.value}`,
                  type: "light",
                  source: "lamp",
                  warmth: Number(event.target.value) / 100,
                })
              }
            />
            <output className="hud-slider-value">
              {Math.round((5200 - world.lamp.targetKelvin) / 3.4)}
            </output>
          </label>

          <div className="hud-row" role="group" aria-label="Bed">
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={onBed && world.interaction.bedPose === "sit"}
              onClick={() => onDispatch({ id: "hud-bed-sit", type: "bed", action: "sit" })}
            >
              Sit
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={onBed && world.interaction.bedPose === "lie"}
              onClick={() => onDispatch({ id: "hud-bed-lie", type: "bed", action: "lie" })}
            >
              Lie down
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={onBed && world.interaction.bedPose === "rest"}
              onClick={() => onDispatch({ id: "hud-bed-rest", type: "bed", action: "rest" })}
            >
              Rest
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={onBed && world.interaction.bedPose === "together"}
              onClick={() => onDispatch({ id: "hud-bed-together", type: "bed", action: "together" })}
            >
              Together
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              disabled={!onBed}
              onClick={() => onDispatch({ id: "hud-bed-up", type: "bed", action: "rise" })}
            >
              Get up
            </button>
          </div>

          <div className="hud-row" role="group" aria-label="Toggles">
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={world.props.curtainsOpen > 0.5}
              aria-pressed={world.props.curtainsOpen > 0.5}
              onClick={() => onDispatch({ id: "hud-window", type: "light", source: "window", on: world.props.curtainsOpen < 0.5 })}
            >
              Window
            </button>
            <button
              type="button"
              className="hud-pill hud-pill-text"
              data-active={reduced}
              aria-pressed={reduced}
              onClick={onToggleReduced}
            >
              Reduce motion
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
