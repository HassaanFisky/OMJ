import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { AudioController } from "./audio/AudioController";
import { CinematicStage, type StageHandle } from "./components/CinematicStage";
import { AudioPlayer, Icon, IntroScreen, PinUpMenu } from "./components/Controls";
import { TimingEditor } from "./components/TimingEditor";
import {
  fallbackOpeningContext,
  fetchLiveOpeningContext,
} from "./environment/liveContext";
import type { LiveOpeningContext } from "./environment/weatherState";
import {
  initialScore,
  validateScore,
  type Score,
} from "./timeline/score";

export default function App() {
  const [controller] = useState(() => new AudioController());
  const stageRef = useRef<StageHandle>(null);

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  const [score, setScore] = useState<Score>(
    () => structuredClone(initialScore),
  );
  const [active, setActive] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [openingContext, setOpeningContext] = useState<LiveOpeningContext>(
    () => fallbackOpeningContext(),
  );

  const errors = validateScore(
    score,
    snapshot.duration || undefined,
  );
  const scoreError = errors[0] ?? "";
  const ready = snapshot.duration > 0 && !scoreError;

  useEffect(() => {
    const audio = document.getElementById("omj-audio");

    if (!(audio instanceof HTMLAudioElement)) {
      throw new Error("Missing audio element.");
    }

    return controller.attach(audio);
  }, [controller]);

  useEffect(() => {
    const source = import.meta.env.VITE_AUDIO_SOURCE;

    if (typeof source === "string" && source.trim()) {
      controller.load(source.trim());
    }
  }, [controller]);

  useEffect(() => {
    let cancelled = false;
    void fetchLiveOpeningContext().then((ctx) => {
      if (!cancelled) {
        setOpeningContext(ctx);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (snapshot.status === "ended") {
      setActive(false);
    }
  }, [snapshot.status]);

  function handleRateChange(rate: number) {
    setPlaybackRate(rate);
    controller.setRate(rate);
  }

  async function begin() {
    if (!ready) return;

    if (snapshot.status === "ended") controller.seek(0);
    controller.setRate(playbackRate);

    if (await controller.play()) {
      setActive(true);
    }
  }

  async function replay() {
    controller.pause();
    controller.seek(0);
    controller.setRate(playbackRate);

    if (ready && await controller.play()) {
      setActive(true);
    }
  }

  function closeExperience() {
    controller.pause();
    controller.seek(0);
    setActive(false);
  }

  function chooseAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (file) {
      closeExperience();
      controller.loadFile(file);
    }

    event.currentTarget.value = "";
  }

  function openText(editor: boolean) {
    controller.pause();
    setEditing(editor);
    setTextOpen(true);
  }

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (textOpen) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest("input,button,a,textarea,select,[contenteditable='true']")) {
      return;
    }

    if (
      (event.key === "c" || event.key === "C") &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      setCaptionsVisible((prev) => !prev);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      controller.seek(controller.getSnapshot().time - 5);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      controller.seek(controller.getSnapshot().time + 5);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      if (snapshot.status === "playing") controller.pause();
      else void begin();
    }

    if (event.key === "Escape") controller.pause();
  }

  const message = scoreError || snapshot.message;

  return (
    <main
      className="experience"
      tabIndex={-1}
      onKeyDown={keyboard}
      aria-label="OMJ musical experience"
    >
      <audio id="omj-audio" preload="metadata" />

      <CinematicStage
        ref={stageRef}
        controller={controller}
        score={score}
        duration={snapshot.duration}
        active={active}
        captionsVisible={captionsVisible}
        openingContext={openingContext}
        playbackRate={playbackRate}
      />

      <header className="topbar">
        <PinUpMenu
          snapshot={snapshot}
          ready={ready}
          active={active}
          playbackRate={playbackRate}
          captionsVisible={captionsVisible}
          onPlay={() => void begin()}
          onPause={controller.pause}
          onReplay={() => void replay()}
          onToggleMute={controller.toggleMute}
          onRateChange={handleRateChange}
          onToggleCaptions={() => setCaptionsVisible((prev) => !prev)}
          onResetOrbit={() => stageRef.current?.resetOrbit()}
        />

        <div className="top-actions">
          {import.meta.env.DEV && (
            <button
              className="text-button"
              onClick={() => openText(true)}
            >
              Timing
            </button>
          )}

          <button
            className="sound-button"
            onClick={controller.toggleMute}
            aria-label={snapshot.muted ? "Unmute" : "Mute"}
            aria-pressed={snapshot.muted}
          >
            <Icon name={snapshot.muted ? "mute" : "sound"} />
            <span>{snapshot.muted ? "Muted" : "Sound"}</span>
          </button>
        </div>
      </header>

      {!active && (
        <IntroScreen
          snapshot={snapshot}
          ready={ready}
          draft={score.verification !== "verified"}
          onPlay={() => void begin()}
          onFile={chooseAudio}
          onTranscript={() => openText(false)}
        />
      )}

      {active && (
        <AudioPlayer
          controller={controller}
          snapshot={snapshot}
          ready={ready}
          onPlay={() => void begin()}
          onReplay={() => void replay()}
          onClose={closeExperience}
          onTranscript={() => openText(false)}
        />
      )}

      <p className="sr-only">
        An illustrated two-character film synchronized with audio.
        The complete text is available through Read lyrics or Lyrics.
      </p>

      {message && (
        <p className="notice" role="status">{message}</p>
      )}

      <TimingEditor
        open={textOpen}
        editing={editing}
        controller={controller}
        snapshot={snapshot}
        score={score}
        onScore={setScore}
        onClose={() => setTextOpen(false)}
      />
    </main>
  );
}
