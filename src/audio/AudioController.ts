export type PlaybackStatus =
  | "empty"
  | "loading"
  | "ready"
  | "starting"
  | "playing"
  | "paused"
  | "waiting"
  | "ended"
  | "error";

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  time: number;
  duration: number;
  muted: boolean;
  message: string;
}

type Renderer = (time: number, duration: number) => void;

const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_DURATION_SECONDS = 30 * 60;

export class AudioController {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<() => void>();
  private renderers = new Set<Renderer>();
  private frame = 0;
  private lastRender = 0;
  private lastBucket = -1;
  private request = 0;
  private objectURL: string | null = null;

  private snapshot: PlaybackSnapshot = {
    status: "empty",
    time: 0,
    duration: 0,
    muted: false,
    message: "",
  };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  addRenderer = (renderer: Renderer) => {
    this.renderers.add(renderer);
    this.renderNow();

    return () => {
      this.renderers.delete(renderer);
    };
  };

  private publish(patch: Partial<PlaybackSnapshot>) {
    const next = { ...this.snapshot, ...patch };

    if (
      next.status === this.snapshot.status &&
      next.time === this.snapshot.time &&
      next.duration === this.snapshot.duration &&
      next.muted === this.snapshot.muted &&
      next.message === this.snapshot.message
    ) {
      return;
    }

    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private duration() {
    const value = this.audio?.duration ?? 0;

    return Number.isFinite(value) && value > 0
      ? value
      : 0;
  }

  private stopFrames() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  renderNow = () => {
    const time = this.audio?.currentTime ?? 0;
    const duration = this.duration();

    this.renderers.forEach((renderer) => renderer(time, duration));
  };

  private synchronize(force = false) {
    if (!this.audio) return;

    this.renderNow();

    const bucket = Math.floor(this.audio.currentTime * 5);

    if (force || bucket !== this.lastBucket) {
      this.lastBucket = bucket;

      this.publish({
        time: this.audio.currentTime,
        duration: this.duration(),
        muted: this.audio.muted,
      });
    }
  }

  private loop = (timestamp: number) => {
    const audio = this.audio;

    if (
      !audio ||
      audio.paused ||
      audio.ended ||
      document.hidden
    ) {
      this.stopFrames();
      return;
    }

    // Scheduling only. The media remains the animation clock.
    if (timestamp - this.lastRender >= 15) {
      this.lastRender = timestamp;
      this.synchronize();
    }

    this.frame = requestAnimationFrame(this.loop);
  };

  attach(audio: HTMLAudioElement) {
    this.audio = audio;
    audio.preload = "metadata";
    audio.autoplay = false;

    const metadata = () => {
      const duration = this.duration();

      if (!duration || duration > MAX_DURATION_SECONDS) {
        audio.pause();

        this.publish({
          status: "error",
          message: "Choose a finite audio recording shorter than 30 minutes.",
        });
        return;
      }

      this.publish({
        status: audio.paused ? "ready" : "playing",
        duration,
        time: audio.currentTime,
        message: "",
      });

      this.renderNow();
    };

    const playing = () => {
      this.stopFrames();

      this.publish({
        status: "playing",
        message: "",
      });

      this.synchronize(true);
      this.lastRender = 0;
      this.frame = requestAnimationFrame(this.loop);
    };

    const paused = () => {
      this.stopFrames();
      this.synchronize(true);

      this.publish({
        status: audio.ended ? "ended" : "paused",
      });
    };

    const waiting = () => {
      this.stopFrames();
      this.synchronize(true);

      if (!audio.paused) {
        this.publish({ status: "waiting" });
      }
    };

    const seeking = () => {
      this.stopFrames();
      this.synchronize(true);
    };

    const seeked = () => {
      this.synchronize(true);

      if (!audio.paused && !audio.ended && !document.hidden) {
        playing();
      }
    };

    const ended = () => {
      this.stopFrames();
      this.synchronize(true);
      this.publish({ status: "ended" });
    };

    const failed = () => {
      this.stopFrames();

      this.publish({
        status: "error",
        message:
          "The audio could not be loaded. Choose a supported local audio file.",
      });
    };

    const volume = () => {
      this.publish({ muted: audio.muted });
    };

    const timeupdate = () => {
      if (!this.frame) this.synchronize();
    };

    const visibility = () => {
      if (document.hidden) {
        if (!audio.paused) {
          this.pause();
          this.publish({
            message: "Paused while the page was away.",
          });
        }
      } else {
        this.synchronize(true);
      }
    };

    const pagehide = () => this.pause();
    const pageshow = () => this.synchronize(true);

    const events: Array<[string, EventListener]> = [
      ["loadedmetadata", metadata],
      ["durationchange", metadata],
      ["playing", playing],
      ["pause", paused],
      ["waiting", waiting],
      ["seeking", seeking],
      ["seeked", seeked],
      ["ended", ended],
      ["error", failed],
      ["volumechange", volume],
      ["timeupdate", timeupdate],
      ["ratechange", seeked],
    ];

    events.forEach(([name, listener]) =>
      audio.addEventListener(name, listener),
    );

    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);

    return () => {
      this.request++;
      this.stopFrames();

      events.forEach(([name, listener]) =>
        audio.removeEventListener(name, listener),
      );

      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);

      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      if (this.audio === audio) this.audio = null;

      if (this.objectURL) {
        URL.revokeObjectURL(this.objectURL);
        this.objectURL = null;
      }
    };
  }

  loadFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const allowed = new Set([
      "mp3", "m4a", "aac", "wav", "ogg", "oga", "webm", "flac",
    ]);

    if (
      file.size <= 0 ||
      file.size > MAX_FILE_BYTES ||
      !extension ||
      !allowed.has(extension) ||
      (file.type && !file.type.startsWith("audio/"))
    ) {
      this.publish({
        message: "Choose a supported audio file smaller than 80 MB.",
      });
      return;
    }

    this.pause();

    if (this.objectURL) URL.revokeObjectURL(this.objectURL);
    this.objectURL = URL.createObjectURL(file);
    this.load(this.objectURL);
  }

  load(source: string) {
    const audio = this.audio;
    if (!audio) return;

    const url = new URL(source, window.location.href);

    const sameOrigin =
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === window.location.origin;

    if (url.protocol !== "blob:" && !sameOrigin) {
      this.publish({
        message: "Use a local file or a same-origin audio asset.",
      });
      return;
    }

    this.request++;
    this.stopFrames();
    audio.pause();

    this.publish({
      status: "loading",
      time: 0,
      duration: 0,
      message: "",
    });

    audio.src = url.href;
    audio.load();
  }

  async play(): Promise<boolean> {
    const audio = this.audio;

    if (!audio || !this.duration()) return false;

    const request = ++this.request;

    if (audio.ended) audio.currentTime = 0;

    this.publish({
      status: "starting",
      message: "",
    });

    try {
      const attempt = audio.play();
      await attempt;

      return request === this.request && !audio.paused;
    } catch (error) {
      if (request !== this.request) return false;

      this.stopFrames();

      this.publish({
        status: "paused",
        message:
          error instanceof DOMException &&
          error.name === "NotAllowedError"
            ? "Press play to allow sound."
            : "Playback could not start. Check the audio format.",
      });

      return false;
    }
  }

  pause = () => {
    this.request++;
    this.stopFrames();

    if (!this.audio) return;

    this.audio.pause();
    this.synchronize(true);

    if (this.duration()) {
      this.publish({
        status: this.audio.ended ? "ended" : "paused",
      });
    }
  };

  seek = (value: number) => {
    const audio = this.audio;
    const duration = this.duration();

    if (!audio || !duration || !Number.isFinite(value)) return;

    try {
      audio.currentTime = Math.min(duration, Math.max(0, value));
      this.synchronize(true);
    } catch {
      this.publish({
        message: "That position is not available yet.",
      });
    }
  };

  toggleMute = () => {
    if (!this.audio) return;

    this.audio.muted = !this.audio.muted;
    this.publish({ muted: this.audio.muted });
  };

  setRate = (rate: number) => {
    if (!this.audio) return;
    this.audio.playbackRate = rate;
  };

  getRate = () => {
    return this.audio?.playbackRate ?? 1.0;
  };
}
