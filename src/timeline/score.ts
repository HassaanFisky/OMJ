export type Verification = "draft" | "verified";

export interface WordCue {
  text: string;
  start: number;
  end: number;
}

const rows = [
  [28, 31, "waiting", "Kabhi tu dekh ke main karun intezaar, ke tu karey mujhe yaad"],
  [31, 32, "help", "And you call me, pull up"],
  [32, 34, "only", "Yeh samajh le tu baat, ke nahi karey agli baat"],
  [34, 37, "kiss", "Meri jaan, you're the only one, you're my love"],
  [37, 40, "leaving", "Nahi hota bardasht, jab tu deti nahi hai saath"],
  [40, 42, "neglected", "And you give me no time, you show me no love"],
  [42, 44, "sky", "Par ab kab khatam hon sitam"],
  [44, 49, "mist", "Kasam se, barbaad main hota raha"],

  [49, 51, "chorus1-0", "O meri jaan"],
  [51, 53, "chorus1-1", "Yun na sata"],
  [53, 56, "chorus1-2", "Main hoon betaab"],
  [56, 58, "chorus1-3", "O meri jaan"],
  [58, 61, "chorus1-4", "O meri jaan"],
  [61, 63, "chorus1-5", "Yun na sata"],
  [63, 65, "chorus1-6", "Main hoon betaab"],
  [65, 68, "chorus1-7", "O meri jaan"],

  [69, 71, "nervous", "Main maanta hoon meri hi ghaltiyan"],
  [71, 74, "disagree", "Par maanti nahi apni tu ghaltiyan"],
  [74, 77, "gifts", "Yeh jaan-e-nisaar tujh pe sab diya, sab diya"],
  [77, 80, "hearts", "Jo karna bhi nahi tha, woh sab kiya"],
  [80, 83, "exhausted", "Ab marta hi rahe, har dum jiya"],
  [83, 85, "winter", "Tere dil mein tu rehti hai, yeh sardiyan"],
  [85, 88, "comfort", "Teri jhooti hamdardi, tasalliyan"],

  [88, 90, "call", "Oh meri jaan"],
  [90, 93, "devotion", "Yeh jaan tujh pe, hum waartay hain"],
  [93, 95, "unnoticed", "Par yeh tujhe na pata"],
  [95, 97, "phone", "Tu dekhti nahi meri koshishein"],
  [97, 100, "thought", "Aur tu jaise koi bala"],
  [100, 102, "dream", "Mere sar se utarti hi nahi hai tu, kyun?"],
  [102, 104, "reach", "Kabhi meri taraf aa"],
  [104, 110, "lap", "Tujhe baith ke sunayenge hum saaray ghum"],

  [110, 112, "chorus2-0", "O meri jaan"],
  [112, 114, "chorus2-1", "Yun na sata"],
  [114, 116, "chorus2-2", "Main hoon betaab"],
  [116, 118, "chorus2-3", "O meri jaan"],
  [118, 120, "chorus2-4", "O meri jaan"],
  [120, 122, "chorus2-5", "Yun na sata"],
  [122, 124, "chorus2-6", "Main hoon betaab"],
  [124, 126, "chorus2-7", "O meri jaan"],

  [126, 132, "eyes", "Aankhein jo mila le, tou hum bhooleinge sab shikwe"],
  [132, 137, "embrace", "Dil se tu laga le, toh phir khatam hon yeh qissay"],
  [137, 142, "window", "Humne khirki hai sajaayi, ke tum jhaankoge na phir se"],
  [142, 148, "quilt", "Orh bethein razaai, ke bas sardiyaan hain tere dil mein"],
] as const;

export type Action =
  | (typeof rows)[number][2]
  | "intro"
  | "tail";

export interface Cue {
  id: string;
  start: number;
  end: number;
  action: Action;
  text: string;
  verification: Verification;
  words?: WordCue[];
}

export interface Score {
  version: 1;
  verification: Verification;
  cues: Cue[];
}

export interface Shot {
  id: string;
  start: number;
  end: number;
  action: Action;
  hold: boolean;
}

export const initialScore: Score = {
  version: 1,
  verification: "draft",
  cues: rows.map(([start, end, action, text], index) => ({
    id: `line-${index + 1}`,
    start,
    end,
    action,
    text,
    verification: "draft",
  })),
};

export function validateScore(
  score: Score,
  duration = Number.POSITIVE_INFINITY,
): string[] {
  const errors: string[] = [];

  if (score.version !== 1) {
    errors.push("Unsupported score version.");
  }

  if (score.cues.length !== initialScore.cues.length) {
    errors.push("All 43 supplied lyric lines are required.");
  }

  score.cues.forEach((cue, index) => {
    const reference = initialScore.cues[index];
    const previous = score.cues[index - 1];

    if (
      !reference ||
      cue.id !== reference.id ||
      cue.text !== reference.text ||
      cue.action !== reference.action
    ) {
      errors.push(`Line ${index + 1}: transcription or identity changed.`);
    }

    if (
      !Number.isFinite(cue.start) ||
      !Number.isFinite(cue.end) ||
      cue.start < 0 ||
      cue.end <= cue.start
    ) {
      errors.push(`Line ${index + 1}: invalid interval.`);
    }

    if (previous && cue.start < previous.end) {
      errors.push(`Line ${index + 1}: overlaps the previous line.`);
    }

    if (cue.end > duration + 0.001) {
      errors.push(`Line ${index + 1}: exceeds the loaded audio duration.`);
    }

    if (cue.words?.length) {
      if (cue.verification !== "verified") {
        errors.push(`Line ${index + 1}: word cues require verification.`);
      }

      if (cue.words.map((word) => word.text).join("") !== cue.text) {
        errors.push(`Line ${index + 1}: word text does not reproduce the line.`);
      }

      cue.words.forEach((word, wordIndex) => {
        const prior = cue.words![wordIndex - 1];

        if (
          !Number.isFinite(word.start) ||
          !Number.isFinite(word.end) ||
          word.start < cue.start ||
          word.end > cue.end ||
          word.end <= word.start ||
          (prior && word.start < prior.end)
        ) {
          errors.push(`Line ${index + 1}: invalid word interval.`);
        }
      });
    }
  });

  if (
    score.verification === "verified" &&
    score.cues.some((cue) => cue.verification !== "verified")
  ) {
    errors.push("A verified score requires every line to be verified.");
  }

  return errors;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function verification(value: unknown): Verification {
  if (value !== "draft" && value !== "verified") {
    throw new Error("Invalid verification state.");
  }

  return value;
}

export function parseScore(text: string): Score {
  if (text.length > 512_000) {
    throw new Error("Cue file is too large.");
  }

  const value: unknown = JSON.parse(text);

  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.cues) ||
    value.cues.length !== initialScore.cues.length
  ) {
    throw new Error("Invalid score structure.");
  }

  const cues: Cue[] = value.cues.map((raw: unknown, index: number) => {
    const reference = initialScore.cues[index]!;

    if (
      !record(raw) ||
      raw.id !== reference.id ||
      raw.text !== reference.text ||
      raw.action !== reference.action ||
      typeof raw.start !== "number" ||
      typeof raw.end !== "number"
    ) {
      throw new Error(`Line ${index + 1}: invalid or changed content.`);
    }

    let words: WordCue[] | undefined;

    if (raw.words !== undefined) {
      if (!Array.isArray(raw.words) || raw.words.length > 300) {
        throw new Error("Invalid word cue collection.");
      }

      words = raw.words.map((word: unknown) => {
        if (
          !record(word) ||
          typeof word.text !== "string" ||
          word.text.length > 300 ||
          typeof word.start !== "number" ||
          typeof word.end !== "number"
        ) {
          throw new Error("Invalid word cue.");
        }

        return {
          text: word.text,
          start: word.start,
          end: word.end,
        };
      });
    }

    return {
      id: reference.id,
      text: reference.text,
      action: reference.action,
      start: raw.start,
      end: raw.end,
      verification: verification(raw.verification),
      words,
    };
  });

  const score: Score = {
    version: 1,
    verification: verification(value.verification),
    cues,
  };

  const errors = validateScore(score);

  if (errors.length) {
    throw new Error(errors[0]);
  }

  return score;
}

export function cueAt(time: number, score: Score): Cue | undefined {
  let low = 0;
  let high = score.cues.length - 1;
  let candidate = -1;

  while (low <= high) {
    const middle = (low + high) >>> 1;

    if (score.cues[middle]!.start <= time) {
      candidate = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const cue = score.cues[candidate];
  return cue && time < cue.end ? cue : undefined;
}

export function buildShots(score: Score, duration: number): Shot[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("A finite media duration is required.");
  }

  const errors = validateScore(score, duration);

  if (errors.length) {
    throw new Error(errors[0]);
  }

  const shots: Shot[] = [];
  let cursor = 0;
  let previous: Action = "intro";

  score.cues.forEach((cue, index) => {
    if (cue.start > cursor) {
      shots.push({
        id: index === 0 ? "intro" : `instrumental-${index}`,
        start: cursor,
        end: cue.start,
        action: previous,
        hold: index !== 0,
      });
    }

    shots.push({
      id: cue.id,
      start: cue.start,
      end: cue.end,
      action: cue.action,
      hold: false,
    });

    cursor = cue.end;
    previous = cue.action;
  });

  if (cursor < duration) {
    shots.push({
      id: "instrumental-outro",
      start: cursor,
      end: duration,
      action: "tail",
      hold: false,
    });
  }

  return shots;
}

export function formatTime(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;

  return (
    Math.floor(safe / 60) +
    ":" +
    String(Math.floor(safe % 60)).padStart(2, "0")
  );
}
