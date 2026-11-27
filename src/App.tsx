import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { AudioController } from "./audio/AudioController";
import { CommandBar } from "./components/CommandBar";
import { ExploreHud } from "./components/ExploreHud";
import { ExploreStage, type ExploreHandle } from "./components/ExploreStage";
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
import { describeAction, type WorldAction } from "./world/actions";
import { WorldEngine } from "./world/engine";
import { parseWorldCommand, type ParseResult } from "./world/nlCommands";
import type { WorldState } from "./world/state";

/**
 * The three top-level screens.
 *
 * `entrance` keeps the original OMJ crest over the curated intro frame, so the
 * first impression of the project is unchanged. `explore` is the new living
 * world. `cinematic` is the filmed musical experience.
 */
type Screen = "entrance" | "explore" | "cinematic";

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window === "undefined"
        ? false
        : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export default function App() {
  const [controller] = useState(() => new AudioController());
  const [engine] = useState(() => new WorldEngine());

  const stageRef = useRef<StageHandle>(null);
  const exploreRef = useRef<ExploreHandle>(null);

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  const [world, setWorld] = useState<WorldState>(() => engine.getState());
  useEffect(() => engine.subscribe((next) => setWorld({ ...next })), [engine]);

  const [score, setScore] = useState<Score>(
    () => structuredClone(initialScore),
  );
  const [screen, setScreen] = useState<Screen>("entrance");
  const [textOpen, setTextOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [openingContext, setOpeningContext] = useState<LiveOpeningContext>(
    () => fallbackOpeningContext(),
  );
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // The cinematic stage keeps the system preference. Explore mode additionally
  // honours an explicit in-room override so visitors can calm the room without
  // changing an operating-system setting.
  const systemReduced = useReducedMotion();
  const exploreReduced = motionOverride ?? systemReduced;

  const active = screen === "cinematic";
  const exploring = screen === "explore";

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

  // The room opens onto the visitor's real local time and weather, matching how
  // the cinematic entrance already resolves its opening sky.
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;

    const hour = openingContext.localHour;
    const atmosphere =
      hour < 5.2
        ? "night"
        : hour < 7.5
          ? "dawn"
          : hour < 17
            ? "day"
            : hour < 19.6
              ? "twilight"
              : "night";

    const condition =
      openingContext.weather?.condition === "rain" ||
      openingContext.weather?.condition === "snow" ||
      openingContext.weather?.condition === "cloudy"
        ? openingContext.weather.condition
        : "clear";

    engine.dispatch({ id: "adopt-atmosphere", type: "setAtmosphere", atmosphere });
    engine.dispatch({ id: "adopt-weather", type: "setWeather", condition });
  }, [engine, openingContext]);

  useEffect(() => {
    if (snapshot.status === "ended" && screen === "cinematic") {
      setScreen("entrance");
    }
  }, [snapshot.status, screen]);

  // Exactly one animation clock is ever running: the engine ticks only while
  // the room is the visible screen, and the audio clock only drives the film.
  useEffect(() => {
    engine.dispatch({
      id: `screen-${screen}`,
      type: "setMode",
      mode: screen === "explore" ? "explore" : "cinematic",
    });

    if (screen !== "explore") engine.stop();
  }, [engine, screen]);

  function handleRateChange(rate: number) {
    setPlaybackRate(rate);
    controller.setRate(rate);
  }

  async function begin() {
    if (!ready) return;

    if (snapshot.status === "ended") controller.seek(0);
    controller.setRate(playbackRate);

    if (await controller.play()) {
      setScreen("cinematic");
    }
  }

  async function replay() {
    controller.pause();
    controller.seek(0);
    controller.setRate(playbackRate);

    if (ready && await controller.play()) {
      setScreen("cinematic");
    }
  }

  function closeExperience() {
    controller.pause();
    controller.seek(0);
    setScreen("entrance");
  }

  function enterRoom() {
    controller.pause();
    setScreen("explore");
    setAnnouncement("You are in the room. Drag to look around.");
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

  const dispatch = useCallback(
    (action: WorldAction) => {
      engine.dispatch(action);
    },
    [engine],
  );

  const runCommand = useCallback(
    (result: ParseResult) => {
      result.actions.forEach((action) => engine.dispatch(action));

      setAnnouncement(
        result.status === "ok"
          ? result.actions.map(describeAction).join(" ")
          : result.reply,
      );
    },
    [engine],
  );

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (textOpen) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest("input,button,a,textarea,select,[contenteditable='true'],[role='application']")) {
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
      controller.seek(controller.getCurrentTime() - 5);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      controller.seek(controller.getCurrentTime() + 5);
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
  const statusLine = useMemo(() => {
    if (world.weather.condition === "snow") return "snow drifting past the glass";
    if (world.weather.condition === "rain") return "rain on the window";
    if (world.weather.condition === "cloudy") return "clouds over the hills";
    return "a clear sky";
  }, [world.weather.condition]);

  return (
    <main
      className="experience"
      tabIndex={-1}
      onKeyDown={keyboard}
      aria-label="OMJ musical experience"
      data-screen={screen}
      data-mode={exploring ? "explore" : "cinematic"}
    >
      <audio id="omj-audio" preload="metadata" />

      {exploring ? (
        <ExploreStage
          ref={exploreRef}
          engine={engine}
          reduced={exploreReduced}
          onAnnounce={setAnnouncement}
          onDispatch={dispatch}
        />
      ) : (
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
      )}

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
          onResetOrbit={() =>
            exploring ? exploreRef.current?.focusObject("window") : stageRef.current?.resetOrbit()
          }
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

          {exploring ? (
            <button
              className="mode-toggle"
              onClick={() => void begin()}
              disabled={!ready}
              title={ready ? "Watch the filmed version" : "Choose an audio file first"}
            >
              <Icon name="play" />
              <span>Cinematic</span>
            </button>
          ) : (
            <button className="mode-toggle" onClick={enterRoom} title="Step into the room">
              <Icon name="orbit" />
              <span>Explore</span>
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

      {exploring && (
        <>
          <div className="room-intro">
            <p className="room-eyebrow">The room</p>
            <p className="room-subtitle">
              {world.time.atmosphere} light, {statusLine}. Drag to look around,
              scroll to move closer.
            </p>
          </div>

          <ExploreHud
            world={world}
            reduced={exploreReduced}
            onDispatch={dispatch}
            onToggleReduced={() => setMotionOverride((prev) => !(prev ?? systemReduced))}
          />

          <CommandBar world={world} onRun={runCommand} parse={parseWorldCommand} />
        </>
      )}

      {screen === "entrance" && (
        <IntroScreen
          snapshot={snapshot}
          ready={ready}
          draft={score.verification !== "verified"}
          onPlay={() => void begin()}
          onFile={chooseAudio}
          onTranscript={() => openText(false)}
          onExplore={enterRoom}
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

      <p className="sr-only app-announcer" role="status" aria-live="polite">
        {announcement}
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
