/**
 * OMJ natural-language world commands — deterministic, offline intent parser.
 *
 * This is deliberately NOT a language model. It is a transparent, testable
 * rule engine that maps ordinary phrasing onto the same `WorldAction` values
 * the hotspots emit. If a request cannot be understood it says so instead of
 * pretending. The `IntentProvider` interface below is the seam an actual model
 * could later implement without changing the world engine at all.
 */

import type { CharacterId, WorldAction } from "./actions";
import type { Atmosphere, WeatherCondition } from "./state";

export interface ParseResult {
  status: "ok" | "unsupported" | "empty";
  actions: WorldAction[];
  reply: string;
  /** Stable id of the rule that matched, useful for tests and telemetry. */
  intent: string;
}

/**
 * The provider seam. A future model-backed implementation would satisfy this
 * interface and could be injected without touching the engine or renderer.
 */
export interface IntentProvider {
  readonly kind: "local" | "model";
  parse(input: string): ParseResult;
}

interface Rule {
  intent: string;
  /** All groups must match; each group is a list of alternatives. */
  requires: Array<string[]>;
  /** If any of these appear, the rule is rejected. */
  forbids?: Array<string[]>;
  build(input: NormalizedInput): WorldAction[] | null;
  reply: string | ((input: NormalizedInput) => string);
}

interface NormalizedInput {
  raw: string;
  text: string;
  words: string[];
}

const STOP = new Set([
  "the", "a", "an", "please", "omj", "to", "of", "and", "it", "is", "be", "would",
  "could", "can", "you", "me", "let", "lets", "make", "some", "turn", "on", "off",
]);

function normalize(raw: string): NormalizedInput {
  const text = ` ${raw
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

  const words = text.trim().length ? text.trim().split(" ") : [];
  return { raw, text, words };
}

const has = (input: NormalizedInput, ...terms: string[]) =>
  terms.some((term) => input.text.includes(` ${term} `) || input.text.includes(`${term} `) || input.text.includes(` ${term}`));

const hasAny = (input: NormalizedInput, group: string[]) => has(input, ...group);

const mentionsCharacter = (input: NormalizedInput, id: CharacterId) => {
  const name = id === "mochi" ? "mochi" : "yume";
  return has(input, name) || (id === "mochi" ? has(input, "teddy", "him") : has(input, "her", "she"));
};

function weatherTarget(input: NormalizedInput): WeatherCondition | null {
  if (has(input, "rain", "rainy", "raining", "drizzle", "storm", "downpour")) return "rain";
  if (has(input, "snow", "snowy", "snowing", "blizzard", "flurries")) return "snow";
  if (has(input, "cloud", "clouds", "cloudy", "overcast", "gloomy")) return "cloudy";
  if (
    has(input, "clear", "clears", "sunny", "sunshine", "stops", "stop") &&
    hasAny(input, ["rain", "snow", "weather", "sky", "outside"])
  ) {
    return "clear";
  }
  return null;
}

function whoTarget(input: NormalizedInput): "mochi" | "yume" | "both" {
  const mochi = mentionsCharacter(input, "mochi");
  const yume = mentionsCharacter(input, "yume");
  if (mochi && yume) return "both";
  if (mochi) return "mochi";
  if (yume) return "yume";
  return "both";
}

let sequence = 0;
const actionId = (intent: string) => {
  sequence = (sequence + 1) % 1_000_000;
  return `${intent}-${sequence}`;
};

const RULES: Rule[] = [
{
    intent: "character.wave",
    requires: [["wave", "hello", "greet", "say hi", "wave back", "waving"]],
    reply: "They wave back.",
    build: (input) => [{ id: actionId("wave"), type: "wave", who: whoTarget(input) }],
  },

{
    intent: "character.hug",
    requires: [["hug", "embrace", "cuddle", "squeeze"]],
    reply: "Mochi and Yume hold each other close.",
    build: () => [{ id: actionId("hug"), type: "hug", preset: "gentle" }],
  },

{
    intent: "character.lookEachOther",
    requires: [["look", "glance", "stare"], ["each other", "at mochi", "at yume", "one another", "him", "her"]],
    reply: "They find each other's eyes.",
    build: (input) => {
      const atMochi = has(input, "at mochi");
      const atYume = has(input, "at yume");
      if (atMochi && !atYume) {
        return [{ id: actionId("lookyume"), type: "look", who: "yume", at: "mochi" }];
      }
      if (atYume && !atMochi) {
        return [{ id: actionId("lookmochi"), type: "look", who: "mochi", at: "yume" }];
      }
      return [
        { id: actionId("looka"), type: "look", who: "mochi", at: "yume" },
        { id: actionId("lookb"), type: "look", who: "yume", at: "mochi" },
      ];
    },
  },

{
    intent: "character.look",
    requires: [["look", "glance", "stare", "gaze", "watch"], ["mochi", "yume", "teddy", "them", "both"]],
    reply: "Their eyes follow.",
    build: (input) => {
      const who = whoTarget(input);
      const at = has(input, "window", "sky", "outside", "snow", "rain")
        ? "window"
        : has(input, "globe")
          ? "globe"
          : has(input, "lamp")
            ? "lamp"
            : has(input, "mochi") && has(input, "yume")
              ? "viewer"
              : has(input, "at me", "viewer", "us", "camera", "audience")
                ? "viewer"
                : "viewer";
      return [{ id: actionId("look"), type: "look", who, at }];
    },
  },

{
    intent: "character.express",
    requires: [["happy", "smile", "smiling", "joyful", "sleepy", "shy", "curious", "calm", "warm"]],
    forbids: [["lamp", "light", "lights", "room", "curtain", "weather", "camera"]],
    reply: "Their expression softens.",
    build: (input) => {
      const expression = has(input, "sleepy", "tired", "rest")
        ? "sleepy"
        : has(input, "shy", "bashful")
          ? "shy"
          : has(input, "curious", "wonder", "puzzled")
            ? "curious"
            : has(input, "warm", "tender", "loving")
              ? "warm"
              : has(input, "calm", "peaceful", "quiet")
                ? "calm"
                : "happy";
      return [{ id: actionId("express"), type: "express", who: whoTarget(input), expression }];
    },
  },

{
    intent: "globe.open",
    requires: [["globe"], ["open", "show", "reveal", "unveil", "shake"]],
    reply: "The snow globe wakes up.",
    build: () => [{ id: actionId("globe"), type: "toggle", flag: "globeOpen" }],
  },

{
    intent: "gift.open",
    requires: [["gift", "present", "box"], ["open", "reveal", "unwrap"]],
    reply: "The gift box opens.",
    build: () => [{ id: actionId("gift"), type: "toggle", flag: "giftOpen" }],
  },

{
    intent: "curtains.open",
    requires: [
      ["curtain", "curtains", "drapes", "blinds"],
      ["open", "opened", "part", "pull", "draw", "aside", "back"],
    ],
    reply: "The curtains part.",
    build: () => [{ id: actionId("curtainsopen"), type: "setCurtains", open: 1 }],
  },

{
    intent: "curtains.close",
    requires: [
      ["curtain", "curtains", "drapes", "blinds"],
      ["close", "closed", "shut", "draw", "cover"],
    ],
    reply: "The curtains close.",
    build: () => [{ id: actionId("curtainsclose"), type: "setCurtains", open: 0 }],
  },

{
    intent: "lamp.warm",
    requires: [["warm", "warmer", "cosy", "cozy", "amber"]],
    forbids: [["cool", "cooler", "cold"]],
    reply: "The lamp turns warmer.",
    build: () => [{ id: actionId("lampwarm"), type: "setLamp", kerosene: 0.85, kelvin: 1900 }],
  },

{
    intent: "lamp.cool",
    requires: [["cool", "cooler", "colder", "blue"]],
    reply: "The lamp turns cooler.",
    build: () => [{ id: actionId("lampcool"), type: "setLamp", kelvin: 5200 }],
  },

{
    intent: "lamp.bright",
    requires: [["bright", "brighter", "lighter", "raise", "up"]],
    forbids: [["dim", "darker", "down", "off"]],
    reply: "The lamp glows brighter.",
    build: () => [{ id: actionId("lampbright"), type: "setLamp", kerosene: 1 }],
  },

{
    intent: "lamp.dim",
    requires: [["dim", "dimmer", "darker", "low", "lower", "softer"]],
    reply: "The lamp dims.",
    build: () => [{ id: actionId("lampdim"), type: "setLamp", kerosene: 0.16 }],
  },

{
    intent: "lamp.off",
    requires: [["lamp", "light", "lights"], ["off", "out", "dark", "kill"]],
    reply: "The lamp goes dark.",
    build: () => [{ id: actionId("lampoff"), type: "setLamp", kerosene: 0 }],
  },

{
    intent: "lamp.on",
    requires: [["lamp"], ["on", "back", "light"]],
    reply: "The lamp comes back up.",
    build: () => [{ id: actionId("lampon"), type: "setLamp", kerosene: 0.8 }],
  },

{
    intent: "lights.fairy",
    requires: [["fairy", "fairies", "string", "garland", "lights", "bulbs"]],
    forbids: [["lamp"]],
    reply: "The fairy lights flicker to life.",
    build: () => [{ id: actionId("fairy"), type: "toggle", flag: "fairyLights" }],
  },

{
    intent: "lights.candle",
    requires: [["candle", "candles", "flame"]],
    reply: "A candle flame steadies.",
    build: () => [{ id: actionId("candle"), type: "toggle", flag: "candle" }],
  },

{
    intent: "lights.cove",
    requires: [["cove", "ceiling", "strip", "ambient"]],
    reply: "The cove lighting shifts.",
    build: () => [{ id: actionId("cove"), type: "toggle", flag: "cove" }],
  },

{
    intent: "camera.window",
    requires: [["camera", "view", "move", "face", "go to", "turn to", "show me", "look at"], ["window", "sky", "outside"]],
    forbids: [["look at mochi", "look at yume"]],
    reply: "The camera drifts to the window.",
    build: () => [{ id: actionId("camwindow"), type: "camera", preset: "window" }],
  },

{
    intent: "camera.bed",
    requires: [["camera", "view", "move", "face", "go to", "turn to", "show me", "look at"], ["bed", "quilt", "razai"]],
    reply: "The camera glides to the bed.",
    build: () => [{ id: actionId("cambed"), type: "camera", preset: "bed" }],
  },

{
    intent: "camera.vanity",
    requires: [["camera", "view", "move", "face", "go to", "turn to", "show me", "look at"], ["mirror", "vanity", "dressing"]],
    reply: "The camera turns to the mirror.",
    build: () => [{ id: actionId("camvanity"), type: "camera", preset: "vanity" }],
  },

{
    intent: "camera.bookshelf",
    requires: [["camera", "view", "move", "face", "go to", "turn to", "show me", "look at"], ["bookshelf", "shelf", "books", "slats"]],
    reply: "The camera sweeps to the bookshelf wall.",
    build: () => [{ id: actionId("cambooks"), type: "camera", preset: "bookshelf" }],
  },

{
    intent: "camera.globe",
    requires: [["camera", "view", "move", "zoom", "show me"], ["globe", "snowglobe"]],
    reply: "The camera settles on the snow globe.",
    build: () => [{ id: actionId("camglobe"), type: "camera", preset: "globe" }],
  },

{
    intent: "camera.overview",
    requires: [["camera", "view"], ["overview", "back", "reset", "wide", "whole", "room"]],
    reply: "The camera returns to the whole room.",
    build: () => [{ id: actionId("camover"), type: "camera", preset: "overview" }],
  },

{
    intent: "camera.character",
    requires: [["camera", "view", "focus", "closer"], ["mochi", "yume", "teddy"]],
    reply: "The camera moves closer.",
    build: (input) => {
      const who = whoTarget(input);
      return [
        {
          id: actionId("camchar"),
          type: "camera",
          preset: who === "yume" ? "yume" : who === "mochi" ? "mochi" : "overview",
        },
      ];
    },
  },

{
    intent: "camera.closer",
    requires: [["closer", "zoom", "nearer", "in"]],
    forbids: [["out", "back"]],
    reply: "The camera moves in.",
    build: () => [{ id: actionId("zoomin"), type: "camera", distance: 360 }],
  },

{
    intent: "camera.farther",
    requires: [["farther", "further", "wider", "zoom out", "back"]],
    reply: "The camera pulls back.",
    build: () => [{ id: actionId("zoomout"), type: "camera", distance: 760 }],
  },

{
    intent: "weather.rain",
    requires: [["rain", "rainy", "raining", "drizzle", "storm", "downpour"]],
    forbids: [["stop", "stops", "no more", "clear"]],
    reply: "Rain begins outside the window.",
    build: () => [{ id: actionId("rain"), type: "setWeather", condition: "rain" }],
  },

{
    intent: "weather.snow",
    requires: [["snow", "snowy", "snowing", "blizzard", "flurries"]],
    forbids: [["stop", "stops", "no more", "clear"]],
    reply: "Snow drifts past the glass.",
    build: () => [{ id: actionId("snow"), type: "setWeather", condition: "snow" }],
  },

{
    intent: "weather.cloudy",
    requires: [["cloud", "clouds", "cloudy", "overcast", "gloomy"]],
    reply: "Clouds gather over the hills.",
    build: () => [{ id: actionId("cloudy"), type: "setWeather", condition: "cloudy" }],
  },

{
    intent: "weather.clear",
    requires: [
      ["clear", "clears", "sunny", "stops", "stop", "bright"],
      ["rain", "snow", "weather", "sky", "outside"],
    ],
    reply: "The sky clears.",
    build: () => [{ id: actionId("clear"), type: "setWeather", condition: "clear" }],
  },

{
    intent: "time.night",
    requires: [["night", "nighttime", "midnight", "dark", "moon", "moonlight", "stars", "starry"]],
    reply: "The night deepens.",
    build: () => [{ id: actionId("night"), type: "setAtmosphere", atmosphere: "night" as Atmosphere }],
  },

{
    intent: "time.twilight",
    requires: [["twilight", "dusk", "evening", "sunset"]],
    reply: "Twilight settles in.",
    build: () => [{ id: actionId("twilight"), type: "setAtmosphere", atmosphere: "twilight" as Atmosphere }],
  },

{
    intent: "time.dawn",
    requires: [["dawn", "sunrise", "morning", "sunup"]],
    reply: "Dawn warms the glass.",
    build: () => [{ id: actionId("dawn"), type: "setAtmosphere", atmosphere: "dawn" as Atmosphere }],
  },

{
    intent: "time.day",
    requires: [["day", "daytime", "noon", "afternoon", "bright", "daylight"]],
    forbids: [["night", "dusk", "dawn", "twilight"]],
    reply: "Morning light fills the room.",
    build: () => [{ id: actionId("day"), type: "setAtmosphere", atmosphere: "day" as Atmosphere }],
  },
];

function evaluateRule(rule: Rule, input: NormalizedInput): WorldAction[] | null {
  for (const group of rule.requires) {
    if (!hasAny(input, group)) return null;
  }

  if (rule.forbids) {
    for (const group of rule.forbids) {
      if (hasAny(input, group)) return null;
    }
  }

  return rule.build(input);
}

function splitClauses(raw: string): string[] {
  return raw
    .split(/\s*(?:,|;|\+|\band\b|\bthen\b)\s*/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause.split(/\s+/).filter(Boolean).length > 0);
}

const SUGGESTIONS = [
  "make it rain",
  "let it snow",
  "open the curtains",
  "turn the lamp warmer",
  "move the camera to the window",
  "make Mochi wave",
  "make Yume look at Mochi",
  "show the snow globe",
  "make them hug",
];

export function suggestCommands(count = 4): string[] {
  return SUGGESTIONS.slice(0, count);
}

/**
 * Parses one user utterance into zero or more world actions.
 * Deterministic: identical input always yields identical actions.
 */
export function parseWorldCommand(raw: string): ParseResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { status: "empty", actions: [], reply: "Type a request like “let it snow”.", intent: "empty" };
  }

  if (trimmed.length > 160) {
    return {
      status: "unsupported",
      actions: [],
      reply: "That is a little too long for me. Try a short request.",
      intent: "too-long",
    };
  }

  const clauses = splitClauses(trimmed);
  const actions: WorldAction[] = [];
  const replies: string[] = [];
  const intents: string[] = [];
  const unknown: string[] = [];
  let sawEmptyClause = false;

  for (const clause of clauses) {
    const input = normalize(clause);
    if (!input.words.some((word) => !STOP.has(word))) {
      sawEmptyClause = true;
      continue;
    }

    let matched = false;
    for (const rule of RULES) {
      const built = evaluateRule(rule, input);
      if (!built) continue;

      actions.push(...built);
      replies.push(typeof rule.reply === "function" ? rule.reply(input) : rule.reply);
      intents.push(rule.intent);
      matched = true;
      break;
    }

    if (!matched) unknown.push(clause);
  }

  if (!actions.length) {
    if (unknown.length) {
      return {
        status: "unsupported",
        actions: [],
        reply: `I can't do “${unknown[0]}” yet. I understand light, weather, time, curtains, camera moves, the snow globe, and Mochi & Yume's gestures.`,
        intent: "unsupported",
      };
    }

    return {
      status: sawEmptyClause ? "empty" : "unsupported",
      actions: [],
      reply: "I didn't catch an action there.",
      intent: "empty",
    };
  }

  const partial = unknown.length
    ? ` (I skipped “${unknown[0]}” — that one isn't supported yet.)`
    : "";

  return {
    status: "ok",
    actions,
    reply: `${replies.join(" ")}${partial}`.trim(),
    intent: intents.join("+"),
  };
}

/** The default provider: purely local, no network, no model. */
export const localIntentProvider: IntentProvider = {
  kind: "local",
  parse: parseWorldCommand,
};

/** Explicit, user-visible capability list for the help affordance. */
export const COMMAND_CAPABILITIES = {
  weather: ["make it rain", "let it snow", "clear the sky", "bring clouds"],
  light: ["turn the lamp warmer", "dim the lamp", "toggle fairy lights", "light a candle"],
  time: ["make it night", "dawn light", "daylight", "twilight"],
  room: ["open the curtains", "close the curtains", "show the snow globe", "open the gift"],
  camera: [
    "move the camera to the window",
    "look at the bed",
    "show the mirror",
    "zoom in",
    "zoom out",
  ],
  characters: [
    "make Mochi wave",
    "make Yume look at Mochi",
    "make them hug",
    "Mochi looks happy",
    "make them sleepy",
  ],
} as const;
