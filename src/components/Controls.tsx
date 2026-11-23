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
  draft: _draft,
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
      <h1 id="omj-title" className="sr-only">OMJ</h1>

      {/* Mysterious, minimalist floating trigger pill over live animated world */}
      <div className="entrance-trigger-wrap">
        <button
          className="primary-button trigger-pill"
          disabled={!ready}
          onClick={onPlay}
          aria-label={snapshot.status === "ended" ? "REPLAY OMJ" : "PLAY OMJ"}
        >
          <span className="trigger-monogram">OMJ</span>
          <span className="trigger-dot" aria-hidden="true">✦</span>
          <Icon name="play" />
          <span>{snapshot.status === "ended" ? "REPLAY OMJ" : "PLAY OMJ"}</span>
        </button>
      </div>

      {/* Discreet corner controls: clean, non-intrusive icon buttons */}
      <div className="entrance-corner-tools">
        <label className="corner-icon-button file-control" title="Choose or change audio file">
          <span className="corner-icon-text" aria-hidden="true">♫</span>
          <input
            type="file"
            aria-label="Choose audio file"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.webm,.flac"
            onChange={onFile}
          />
          <span className="sr-only">
            {snapshot.duration ? "Change audio" : "Choose audio"}
          </span>
        </label>

        <button
          className="corner-icon-button transcript-link"
          onClick={onTranscript}
          aria-label="Read lyrics"
          title="Read lyrics transcript"
        >
          <span className="corner-icon-text" aria-hidden="true">Aa</span>
          <span className="sr-only">Read lyrics</span>
        </button>
      </div>
    </section>
  );
}

/**
 * Discreet Cinematic Controls
 * Replaces the conventional heavy music-player seekbar/dashboard with an unobtrusive,
 * floating glass pill meeting WCAG 44x44px touch targets.
 */
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
    <section className="player cinematic-controls" aria-label="Playback controls">
      <div className="player-row">
        <button
          ref={playButton}
          className="icon-button"
          onClick={() => (playing ? controller.pause() : onPlay())}
          aria-label={playing ? "Pause" : "Resume"}
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>

        <button
          className="icon-button"
          onClick={onReplay}
          aria-label="Replay"
          disabled={!ready}
        >
          <Icon name="replay" />
        </button>

        <button
          className="icon-button"
          onClick={onTranscript}
          aria-label="Lyrics transcript"
        >
          <span className="control-text-icon">Aa</span>
        </button>

        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>
    </section>
  );
}
