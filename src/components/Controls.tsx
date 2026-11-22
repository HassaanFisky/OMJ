import {
  useEffect,
  useRef,
  type ChangeEvent,
} from "react";
import type { AudioController, PlaybackSnapshot } from "../audio/AudioController";
import { formatTime } from "../timeline/score";

export function Icon({
  name,
}: {
  name: "play" | "pause" | "replay" | "close" | "sound" | "mute";
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "play" && (
        <path d="M8 5v14l11-7Z" fill="currentColor" stroke="none" />
      )}
      {name === "pause" && (
        <path d="M8 5v14M16 5v14" strokeWidth="3" />
      )}
      {name === "replay" && (
        <path d="M5 8a8 8 0 1 1-1 7M5 3v5h5" />
      )}
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {(name === "sound" || name === "mute") && (
        <>
          <path d="M4 9h4l5-4v14l-5-4H4Z" />
          {name === "mute"
            ? <path d="m17 9 5 6m0-6-5 6" />
            : <path d="M17 8q5 4 0 8M19 5q8 7 0 14" />}
        </>
      )}
    </svg>
  );
}

export function IntroScreen({
  snapshot,
  ready,
  draft,
  onPlay,
  onFile,
  onTranscript,
}: {
  snapshot: PlaybackSnapshot;
  ready: boolean;
  draft: boolean;
  onPlay(): void;
  onFile(event: ChangeEvent<HTMLInputElement>): void;
  onTranscript(): void;
}) {
  return (
    <section className="entrance" aria-labelledby="omj-title">
      <svg className="entrance-emblem" viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="27" fill="none"
          stroke="currentColor" strokeWidth=".7" opacity=".25" />
        <path
          d="M39 14C20 15 16 36 33 44C18 43 11 29 18 20C23 12 33 10 39 14Z"
          fill="currentColor"
        />
        <path d="m43 25 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
          fill="currentColor" />
      </svg>

      <p className="eyebrow">an illustrated music film</p>
      <h1 id="omj-title">OMJ</h1>
      <p className="subtitle">O Meri Jaan</p>
      <span className="title-rule" />

      <button
        className="primary-button"
        disabled={!ready}
        onClick={onPlay}
      >
        <Icon name="play" />
        {snapshot.status === "ended" ? "REPLAY OMJ" : "PLAY OMJ"}
      </button>

      <div className="entrance-utilities">
        <label className="file-control">
          <span>{snapshot.duration ? "Change audio" : "Choose audio"}</span>
          <input
            type="file"
            aria-label="Choose audio file"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.webm,.flac"
            onChange={onFile}
          />
        </label>

        {snapshot.duration > 0 && (
          <span>{formatTime(snapshot.duration)} · audio ready</span>
        )}
      </div>

      {draft && (
        <p className="draft-indicator">Lyric timing is provisional</p>
      )}

      <p className="local-note">A chosen file stays on this device.</p>

      <button className="transcript-link" onClick={onTranscript}>
        Read lyrics
      </button>
    </section>
  );
}

export function AudioPlayer({
  controller,
  snapshot,
  ready,
  onPlay,
  onReplay,
  onClose,
  onTranscript,
}: {
  controller: AudioController;
  snapshot: PlaybackSnapshot;
  ready: boolean;
  onPlay(): void;
  onReplay(): void;
  onClose(): void;
  onTranscript(): void;
}) {
  const playButton = useRef<HTMLButtonElement>(null);
  const playing = snapshot.status === "playing";

  useEffect(() => {
    playButton.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="player" aria-label="Playback controls">
      <div className="player-row">
        <button
          ref={playButton}
          className="icon-button"
          onClick={() => playing ? controller.pause() : onPlay()}
          aria-label={playing ? "Pause" : "Resume"}
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>

        <time>{formatTime(snapshot.time)}</time>

        <label className="seek">
          <span className="sr-only">Seek</span>
          <input
            type="range"
            aria-label="Seek"
            min="0"
            max={snapshot.duration || 1}
            step="0.01"
            value={Math.min(snapshot.time, snapshot.duration || 1)}
            disabled={!ready}
            onChange={(event) =>
              controller.seek(Number(event.currentTarget.value))
            }
            aria-valuetext={
              `${formatTime(snapshot.time)} of ${formatTime(snapshot.duration)}`
            }
          />
        </label>

        <time>{formatTime(snapshot.duration)}</time>

        <button
          className="icon-button"
          onClick={onReplay}
          aria-label="Replay"
        >
          <Icon name="replay" />
        </button>
      </div>

      <div className="player-subrow">
        <button onClick={onTranscript}>Lyrics</button>
        <span>
          {snapshot.status === "waiting" ? "Buffering…" : "O Meri Jaan"}
        </span>
        <button onClick={onClose}>Close</button>
      </div>
    </section>
  );
}
