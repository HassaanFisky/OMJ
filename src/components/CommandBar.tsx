import { useEffect, useId, useRef, useState } from "react";
import {
  COMMAND_CAPABILITIES,
  suggestCommands,
  type ParseResult,
} from "../world/nlCommands";
import type { WorldAction } from "../world/actions";
import type { WorldState } from "../world/state";

export interface CommandBarProps {
  world: WorldState;
  onRun(result: ParseResult): void;
  /** Resolves a raw utterance into actions; injectable so a model provider can drop in later. */
  parse(raw: string): ParseResult;
}

const CHIPS = [
  "let it snow",
  "make it rain",
  "turn the lamp warmer",
  "open the curtains",
  "show the snow globe",
  "make Mochi wave",
] as const;

export function CommandBar({ world, onRun, parse }: CommandBarProps) {
  const [value, setValue] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const helpId = useId();

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 5200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;

    const result = parse(text);
    onRun(result);

    setFeedback({
      tone: result.status === "ok" ? "ok" : "warn",
      text: result.reply,
    });

    if (result.status === "ok") {
      setHistory((prev) => [text, ...prev.filter((entry) => entry !== text)].slice(0, 3));
      setValue("");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submit(value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setValue("");
      inputRef.current?.blur();
    }
  }

  const suggestions = history.length ? history : suggestCommands(3);

  return (
    <div className="command-bar" data-world-revision={world.revision}>
      <form
        className="command-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <label className="sr-only" htmlFor={`${helpId}-input`}>
          Describe a change to the room
        </label>
        <span className="command-glyph" aria-hidden="true">
          ✦
        </span>
        <input
          id={`${helpId}-input`}
          ref={inputRef}
          className="command-input"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell the room what to do…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={160}
          enterKeyHint="send"
        />
        <button type="submit" className="command-send" disabled={!value.trim()}>
          Send
        </button>
        <button
          type="button"
          className="command-help"
          aria-expanded={helpOpen}
          aria-controls={helpId}
          onClick={() => setHelpOpen((open) => !open)}
          title="What can I ask for?"
        >
          ?
        </button>
      </form>

      <div className="command-chips" role="group" aria-label="Example requests">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="command-chip"
            onClick={() => submit(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      {suggestions.length > 0 && history.length > 0 && (
        <div className="command-recent" aria-label="Recent requests">
          {suggestions.map((entry) => (
            <button
              key={entry}
              type="button"
              className="command-chip is-muted"
              onClick={() => submit(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
      )}

      {feedback && (
        <p
          className="command-feedback"
          role="status"
          data-tone={feedback.tone}
        >
          {feedback.text}
        </p>
      )}

      {helpOpen && (
        <div className="command-help-panel" id={helpId} role="dialog" aria-label="Room requests">
          <p className="command-help-note">
            This understands a small, fixed set of room requests with a local
            rule engine — no language model, no network call. Anything outside
            the list is reported honestly rather than faked.
          </p>
          <dl className="command-help-list">
            {Object.entries(COMMAND_CAPABILITIES).map(([group, examples]) => (
              <div key={group} className="command-help-group">
                <dt>{group}</dt>
                <dd>
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="command-example"
                      onClick={() => {
                        submit(example);
                        setHelpOpen(false);
                      }}
                    >
                      {example}
                    </button>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

export type { WorldAction };
