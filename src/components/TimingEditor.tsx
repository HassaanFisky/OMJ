import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { AudioController, PlaybackSnapshot } from "../audio/AudioController";
import {
  parseScore,
  validateScore,
  type Score,
} from "../timeline/score";
import { Icon } from "./Controls";

interface Props {
  open: boolean;
  editing: boolean;
  controller: AudioController;
  snapshot: PlaybackSnapshot;
  score: Score;
  onScore(score: Score): void;
  onClose(): void;
}

export function TimingEditor({
  open,
  editing,
  controller,
  snapshot,
  score,
  onScore,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const downloadURL = useRef<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);

  useEffect(() => () => {
    if (downloadURL.current) URL.revokeObjectURL(downloadURL.current);
  }, []);

  function update(
    index: number,
    key: "start" | "end",
    value: number,
  ) {
    if (!Number.isFinite(value)) return;

    onScore({
      ...score,
      verification: "draft",
      cues: score.cues.map((cue, cueIndex) =>
        cueIndex === index
          ? {
              ...cue,
              [key]: Math.max(0, value),
              verification: "draft",
              words: undefined,
            }
          : cue,
      ),
    });
  }

  function mark(index: number, key: "start" | "end") {
    update(
      index,
      key,
      Number(controller.getSnapshot().time.toFixed(3)),
    );
  }

  function exportScore() {
    const errors = validateScore(
      score,
      snapshot.duration || undefined,
    );

    if (errors.length) {
      setMessage(errors[0]!);
      return;
    }

    if (downloadURL.current) {
      URL.revokeObjectURL(downloadURL.current);
    }

    downloadURL.current = URL.createObjectURL(
      new Blob([JSON.stringify(score, null, 2)], {
        type: "application/json",
      }),
    );

    const anchor = document.createElement("a");
    anchor.href = downloadURL.current;
    anchor.download = "omj-score.json";
    anchor.click();

    setMessage("Exported. Exporting does not certify synchronization.");
  }

  async function importScore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    if (file.size > 512_000) {
      setMessage("Cue file is too large.");
      return;
    }

    try {
      const imported = parseScore(await file.text());
      const errors = validateScore(
        imported,
        snapshot.duration || undefined,
      );

      if (errors.length) throw new Error(errors[0]);

      onScore(imported);
      setMessage("Cue file loaded.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Invalid cue file.",
      );
    }
  }

  return (
    <dialog
      ref={dialog}
      className="text-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-header">
        <div>
          <p className="eyebrow">
            {editing ? "development workspace" : "transcript"}
          </p>
          <h2>{editing ? "Timing desk" : "O Meri Jaan"}</h2>
        </div>

        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </header>

      {editing && import.meta.env.DEV && (
        <section className="editor-tools" aria-label="Timing controls">
          <strong>{snapshot.time.toFixed(3)} s</strong>

          <button onClick={() => controller.seek(snapshot.time - 0.05)}>
            −50 ms
          </button>
          <button
            onClick={() =>
              snapshot.status === "playing"
                ? controller.pause()
                : void controller.play()
            }
          >
            {snapshot.status === "playing" ? "Pause" : "Play"}
          </button>
          <button onClick={() => controller.seek(snapshot.time + 0.05)}>
            +50 ms
          </button>
          <button onClick={exportScore}>Export</button>

          <label className="import-control">
            Import
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importScore(event)}
            />
          </label>

          <p>
            Listen to the exact production recording. Mark each phrase’s
            start and end. Repeated choruses require separate review.
          </p>
        </section>
      )}

      {message && <p role="status">{message}</p>}

      <ol className="transcript-list">
        {score.cues.map((cue, index) => (
          <li key={cue.id}>
            <p>{cue.text}</p>

            {editing && import.meta.env.DEV && (
              <div className="cue-tools">
                <label>
                  Start
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    aria-label={`Line ${index + 1} start`}
                    value={cue.start}
                    onChange={(event) =>
                      update(index, "start", Number(event.currentTarget.value))
                    }
                  />
                </label>

                <label>
                  End
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    aria-label={`Line ${index + 1} end`}
                    value={cue.end}
                    onChange={(event) =>
                      update(index, "end", Number(event.currentTarget.value))
                    }
                  />
                </label>

                <button onClick={() => mark(index, "start")}>
                  Mark start
                </button>
                <button onClick={() => mark(index, "end")}>
                  Mark end
                </button>
                <button
                  onClick={() => {
                    controller.seek(Math.max(0, cue.start - 0.4));
                    void controller.play();
                  }}
                >
                  Listen
                </button>

                <label className="checked-label">
                  <input
                    type="checkbox"
                    checked={cue.verification === "verified"}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;

                      const cues = score.cues.map((item, cueIndex) =>
                        cueIndex === index
                          ? {
                              ...item,
                              verification: checked
                                ? "verified" as const
                                : "draft" as const,
                            }
                          : item,
                      );

                      onScore({
                        ...score,
                        verification: cues.every(
                          (item) => item.verification === "verified",
                        ) ? "verified" : "draft",
                        cues,
                      });
                    }}
                  />
                  Audio-checked
                </label>
              </div>
            )}
          </li>
        ))}
      </ol>
    </dialog>
  );
}
