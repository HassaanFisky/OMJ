import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { AudioController, PlaybackSnapshot } from "../audio/AudioController";

export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function Icon({
  name,
}: {
  name: "play" | "pause" | "replay" | "close" | "sound" | "mute" | "menu" | "orbit";
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
      {name === "menu" && (
        <path d="M4 7h16M4 12h16M4 17h10" />
      )}
      {name === "orbit" && (
        <>
          <path d="M3 12a9 3.5 0 1 0 18 0a9 3.5 0 1 0-18 0" />
          <path d="M12 3v18" opacity="0.45" />
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
  const isEnded = snapshot.status === "ended";

  return (
    <section className="entrance" aria-labelledby="omj-title">
      {/* SINGLE visible OMJ identity mark at the center of the entrance */}
      <div className="entrance-crest">
        <h1 id="omj-title" className="entrance-monogram">
          OMJ
        </h1>
        <span className="entrance-divider" aria-hidden="true" />
      </div>

      {/* Minimalist floating play trigger */}
      <div className="entrance-trigger-wrap">
        <button
          className="primary-button trigger-pill"
          disabled={!ready}
          onClick={onPlay}
          aria-label={isEnded ? "REPLAY OMJ" : "PLAY OMJ"}
        >
          <Icon name={isEnded ? "replay" : "play"} />
          <span>{isEnded ? "Replay" : "Begin"}</span>
        </button>
      </div>

      {/* Discreet corner controls */}
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
 * Top-Left Compact Pin-Up Speed & Cinema Popover
 * Never covers the full viewport or blocks Mochi and Yume.
 */
export function PinUpMenu({
  snapshot,
  ready,
  active,
  playbackRate,
  captionsVisible,
  onPlay,
  onPause,
  onReplay,
  onToggleMute,
  onRateChange,
  onToggleCaptions,
  onResetOrbit,
}: {
  snapshot: PlaybackSnapshot;
  ready: boolean;
  active: boolean;
  playbackRate: number;
  captionsVisible: boolean;
  onPlay(): void;
  onPause(): void;
  onReplay(): void;
  onToggleMute(): void;
  onRateChange(rate: number): void;
  onToggleCaptions(): void;
  onResetOrbit(): void;
}) {
  const [open, setOpen] = useState(false);
  const playing = snapshot.status === "playing";

  return (
    <div className="pinup-wrap">
      <button
        type="button"
        className="pinup-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Playback menu"
        aria-expanded={open}
      >
        <Icon name={open ? "close" : "menu"} />
        <span className="pinup-rate-tag">{playbackRate}x</span>
      </button>

      {open && (
        <div className="pinup-card" role="dialog" aria-label="Cinema controls">
          <div className="pinup-section-label">Speed</div>
          <div className="speed-pills" role="group" aria-label="Playback speed">
            {SPEED_PRESETS.map((rate) => (
              <button
                key={rate}
                type="button"
                className="speed-pill"
                data-active={playbackRate === rate ? "true" : "false"}
                onClick={() => onRateChange(rate)}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div className="pinup-actions">
            <button
              type="button"
              className="pinup-action-btn"
              disabled={!ready}
              onClick={() => (playing ? onPause() : onPlay())}
            >
              <Icon name={playing ? "pause" : "play"} />
              <span>{playing ? "Pause" : active ? "Resume" : "Play"}</span>
            </button>

            <button
              type="button"
              className="pinup-action-btn"
              disabled={!ready}
              onClick={onReplay}
            >
              <Icon name="replay" />
              <span>Replay</span>
            </button>

            <button
              type="button"
              className="pinup-action-btn"
              onClick={onToggleMute}
            >
              <Icon name={snapshot.muted ? "mute" : "sound"} />
              <span>{snapshot.muted ? "Unmute" : "Mute"}</span>
            </button>

            <button
              type="button"
              className="pinup-action-btn"
              onClick={onToggleCaptions}
              aria-pressed={captionsVisible}
            >
              <span className="control-text-icon">Aa</span>
              <span>{captionsVisible ? "Hide Lyrics" : "Show Lyrics"}</span>
            </button>

            <button
              type="button"
              className="pinup-action-btn"
              onClick={onResetOrbit}
            >
              <Icon name="orbit" />
              <span>Reset 360° View</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Discreet Minimal Cinema Controls
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
