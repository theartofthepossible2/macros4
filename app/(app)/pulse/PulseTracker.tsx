"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";

// Every heuristic worth touching lives here.
const CONFIG = {
  windowMs: 12000, // history kept
  baselineMs: 2000, // detrend window (keep >1.5s so low HR survives)
  smoothMs: 120, // light low-pass on the signal
  stdWindowMs: 4000, // window for the adaptive peak threshold
  ampWindowMs: 3000, // window for amplitude / quality
  peakK: 0.45, // peak must exceed peakK * recent std
  refractoryMs: 300, // min gap between beats -> caps at 200 bpm
  minIBI: 300, // 200 bpm  } physiological gate
  maxIBI: 1500, // 40 bpm   } on inter-beat intervals
  ibiKeep: 10, // recent beats feeding the BPM median
  ibiForBPM: 4, // beats required before showing a number
  warmupMs: 2500, // ignore the first moment while the finger settles
  roi: 48, // sample a centered roi x roi patch of the frame
  darkRed: 26, // mean red below this = "the lens can't see light"
};

const IDLE_STATUS = "Resting heart rate, no wearable required.";
const SEARCHING_STATUS = "Searching for a pulse — press gently and keep still.";

type CameraState = "idle" | "requesting" | "live" | "error";
type Mood = "locked" | "ok" | "searching";
type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean };
type WakeLockSentinelLike = { release(): Promise<void> };

export function PulseTracker() {
  // Low-frequency display state only; everything per-frame lives in refs.
  const [running, setRunning] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [bpm, setBpm] = useState<number | null>(null);
  const [mood, setMood] = useState<Mood>("searching");
  const [statusText, setStatusText] = useState(IDLE_STATUS);
  const [statusWarn, setStatusWarn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const beatRef = useRef<HTMLSpanElement>(null);
  const disclaimerRef = useRef<HTMLParagraphElement>(null);

  const samplerRef = useRef<CanvasRenderingContext2D | null>(null);
  const scopeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const colorsRef = useRef<{ trace: string; grid: string } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const torchOnRef = useRef(false);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const kickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const samplesRef = useRef<{ t: number; r: number }[]>([]);
  const procRef = useRef<{ t: number; v: number }[]>([]);
  const ibisRef = useRef<number[]>([]);
  const lastPeakTRef = useRef(0);
  const startedAtRef = useRef(0);
  const displayRangeRef = useRef({ min: -1, max: 1 });
  const traceFlashRef = useRef(0);
  const lastUiTRef = useRef(0);
  const pendingRef = useRef<{ bpm: number | null; mood: Mood; text: string; warn: boolean }>({
    bpm: null,
    mood: "searching",
    text: SEARCHING_STATUS,
    warn: false,
  });

  useEffect(() => {
    const onPageHide = () => stop();
    const onVisibility = () => {
      if (runningRef.current && document.visibilityState === "visible") requestWakeLock();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- camera lifecycle -------------------------------------------------

  async function start() {
    if (runningRef.current || startingRef.current) return;
    if (!window.isSecureContext) {
      setStatusNow("This needs an https:// address to reach the camera.", true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusNow("This browser can't open the camera.", true);
      return;
    }

    startingRef.current = true;
    setCameraState("requesting");
    setStatusNow("Requesting camera…", false);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err) {
      startingRef.current = false;
      setCameraState("error");
      reportCameraError(err);
      return;
    }

    // The component may have unmounted (or Stop raced us) during the await.
    const video = videoRef.current;
    if (!startingRef.current || !video) {
      stream.getTracks().forEach((t) => t.stop());
      startingRef.current = false;
      return;
    }

    streamRef.current = stream;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Autoplay hiccups are fine; the stream still delivers frames.
    }
    if (!startingRef.current) return; // stop() ran during play()

    const track = stream.getVideoTracks()[0];
    if (!track) {
      stop();
      setStatusNow("Couldn't start the camera.", true);
      return;
    }
    trackRef.current = track;
    setCameraState("live");
    await setupTorch(track);
    if (!startingRef.current) return; // stop() ran during the torch await; it already released everything
    requestWakeLock();

    samplesRef.current = [];
    procRef.current = [];
    ibisRef.current = [];
    lastPeakTRef.current = 0;
    startedAtRef.current = performance.now();
    displayRangeRef.current = { min: -1, max: 1 };
    traceFlashRef.current = 0;
    lastUiTRef.current = 0;
    pendingRef.current = { bpm: null, mood: "searching", text: SEARCHING_STATUS, warn: false };

    startingRef.current = false;
    runningRef.current = true;
    setRunning(true);
    setBpm(null);
    setMood("searching");
    setStatusNow(SEARCHING_STATUS, false);
    rafRef.current = requestAnimationFrame(loop);
  }

  function stop() {
    startingRef.current = false;
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const track = trackRef.current;
    if (track && torchOnRef.current) {
      track.applyConstraints({ advanced: [{ torch: false } as TorchConstraints] }).catch(() => {});
    }
    torchOnRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    releaseWakeLock();

    setRunning(false);
    setCameraState("idle");
    setTorchAvailable(false);
    setTorchOn(false);
    setBpm(null);
    setMood("searching");
    setStatusNow(IDLE_STATUS, false);
    clearScope();
  }

  function reportCameraError(err: unknown) {
    const name = err instanceof DOMException ? err.name : "Error";
    if (name === "NotAllowedError" || name === "SecurityError") {
      setStatusNow("Camera access was blocked. Allow it in your browser settings and try again.", true);
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      setStatusNow("No rear camera was found on this device.", true);
    } else if (name === "NotReadableError") {
      setStatusNow("The camera is busy in another app. Close it and try again.", true);
    } else {
      setStatusNow(`Couldn't start the camera (${name}).`, true);
    }
  }

  // Android Chrome exposes the torch; iOS Safari does not (use a bright room
  // there — the reading still works without the flash).
  async function setupTorch(track: MediaStreamTrack) {
    let caps: MediaTrackCapabilities & { torch?: boolean } = {};
    try {
      caps = track.getCapabilities ? track.getCapabilities() : {};
    } catch {}
    if (caps.torch) {
      setTorchAvailable(true);
      await setTorch(true);
    } else {
      setTorchAvailable(false);
    }
  }

  async function setTorch(on: boolean) {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as TorchConstraints] });
      torchOnRef.current = on;
      setTorchOn(on);
    } catch {
      setTorchAvailable(false);
    }
  }

  async function requestWakeLock() {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
      };
      if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {}
  }

  function releaseWakeLock() {
    try {
      wakeLockRef.current?.release();
    } catch {}
    wakeLockRef.current = null;
  }

  // ---- per-frame loop ---------------------------------------------------

  function loop() {
    if (!runningRef.current) return;
    const now = performance.now();
    sampleFrame(now);
    processSample(now);
    drawScope();
    flushDisplay(now);
    rafRef.current = requestAnimationFrame(loop);
  }

  function sampleFrame(now: number) {
    const video = videoRef.current;
    if (!video) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    if (!samplerRef.current) {
      const c = document.createElement("canvas");
      c.width = CONFIG.roi;
      c.height = CONFIG.roi;
      samplerRef.current = c.getContext("2d", { willReadFrequently: true });
    }
    const sctx = samplerRef.current;
    if (!sctx) return;

    const s = Math.min(vw, vh) * 0.5;
    sctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, CONFIG.roi, CONFIG.roi);

    const data = sctx.getImageData(0, 0, CONFIG.roi, CONFIG.roi).data;
    let rSum = 0;
    for (let i = 0; i < data.length; i += 4) rSum += data[i];
    const r = rSum / (data.length / 4); // red channel carries the PPG signal

    samplesRef.current.push({ t: now, r });
    trim(samplesRef.current, now, CONFIG.windowMs);
  }

  function processSample(now: number) {
    const samples = samplesRef.current;
    const proc = procRef.current;
    if (samples.length < 5) return;

    // Baseline = mean red over baselineMs. Subtracting it removes the large
    // DC component and slow drift, leaving the small pulsatile ripple.
    const baseFrom = now - CONFIG.baselineMs;
    let bSum = 0;
    let bN = 0;
    for (let i = samples.length - 1; i >= 0; i--) {
      if (samples[i].t < baseFrom) break;
      bSum += samples[i].r;
      bN++;
    }
    const baseline = bSum / bN;
    const detr = samples[samples.length - 1].r - baseline;

    // Light smoothing over smoothMs to suppress per-pixel camera noise.
    let v = detr;
    if (proc.length) {
      const smFrom = now - CONFIG.smoothMs;
      let sum = detr;
      let n = 1;
      for (let i = proc.length - 1; i >= 0; i--) {
        if (proc[i].t < smFrom) break;
        sum += proc[i].v;
        n++;
      }
      v = sum / n;
    }
    proc.push({ t: now, v });
    trim(proc, now, CONFIG.windowMs);

    detectBeat(now);
    updateReadout(now, baseline);
  }

  // Confirm a peak with a one-sample delay (need the next sample to know the
  // middle one is a local max). Adaptive threshold + refractory period.
  function detectBeat(now: number) {
    const proc = procRef.current;
    const n = proc.length;
    if (n < 3) return;
    const a = proc[n - 3].v;
    const b = proc[n - 2].v;
    const c = proc[n - 1].v;
    const bt = proc[n - 2].t;
    const thr = CONFIG.peakK * recentStd(now, CONFIG.stdWindowMs);

    if (!(b > a && b >= c && b > thr)) return;
    if (bt - lastPeakTRef.current < CONFIG.refractoryMs) return;

    if (lastPeakTRef.current > 0) {
      const ibi = bt - lastPeakTRef.current;
      if (ibi >= CONFIG.minIBI && ibi <= CONFIG.maxIBI) {
        ibisRef.current.push(ibi);
        if (ibisRef.current.length > CONFIG.ibiKeep) ibisRef.current.shift();
        kickNumber();
        traceFlashRef.current = 1;
      }
    }
    lastPeakTRef.current = bt;
  }

  function updateReadout(now: number, baseline: number) {
    const ibis = ibisRef.current;
    const elapsed = now - startedAtRef.current;
    const amp = recentAmplitude(now, CONFIG.ampWindowMs);

    if (baseline < CONFIG.darkRed) {
      pendingRef.current = {
        bpm: null,
        mood: "searching",
        text: torchOnRef.current
          ? "The lens looks dark — cover it fully with your fingertip."
          : "The lens looks dark. Cover it fully, in a bright room since the flash isn't on.",
        warn: true,
      };
      return;
    }
    if (elapsed < CONFIG.warmupMs || ibis.length < CONFIG.ibiForBPM) {
      pendingRef.current = { bpm: null, mood: "searching", text: SEARCHING_STATUS, warn: false };
      return;
    }

    // BPM from the median inter-beat interval (robust to the odd missed beat).
    const sorted = ibis.slice().sort((x, y) => x - y);
    const medIBI = sorted[Math.floor(sorted.length / 2)];
    const value = Math.round(60000 / medIBI);

    // Quality from how regular the beats are (coefficient of variation).
    const mean = ibis.reduce((s, x) => s + x, 0) / ibis.length;
    const variance = ibis.reduce((s, x) => s + (x - mean) ** 2, 0) / ibis.length;
    const cv = Math.sqrt(variance) / mean;

    if (amp < 0.35) {
      pendingRef.current = { bpm: value, mood: "searching", text: "Faint signal — press a little more firmly.", warn: false };
    } else if (cv < 0.12) {
      pendingRef.current = { bpm: value, mood: "locked", text: "Locked on.", warn: false };
    } else if (cv < 0.28) {
      pendingRef.current = { bpm: value, mood: "ok", text: "Got it — hold steady for a cleaner reading.", warn: false };
    } else {
      pendingRef.current = { bpm: value, mood: "searching", text: "Steadying — keep your hand still.", warn: false };
    }
  }

  // Push pending readout into React state a few times per second, not per
  // frame; identical values bail out of re-rendering entirely.
  function flushDisplay(now: number) {
    if (now - lastUiTRef.current < 250) return;
    lastUiTRef.current = now;
    const p = pendingRef.current;
    setBpm(p.bpm);
    setMood(p.mood);
    setStatusText(p.text);
    setStatusWarn(p.warn);
  }

  function setStatusNow(text: string, warn: boolean) {
    setStatusText(text);
    setStatusWarn(warn);
  }

  // ---- windowed stats ---------------------------------------------------

  function recentStd(now: number, ms: number) {
    const proc = procRef.current;
    const from = now - ms;
    let sum = 0;
    let sq = 0;
    let n = 0;
    for (let i = proc.length - 1; i >= 0; i--) {
      if (proc[i].t < from) break;
      const v = proc[i].v;
      sum += v;
      sq += v * v;
      n++;
    }
    if (n < 2) return 1;
    const mean = sum / n;
    return Math.sqrt(Math.max(0, sq / n - mean * mean));
  }

  function recentAmplitude(now: number, ms: number) {
    const proc = procRef.current;
    const from = now - ms;
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = proc.length - 1; i >= 0; i--) {
      if (proc[i].t < from) break;
      const v = proc[i].v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return isFinite(mx - mn) ? mx - mn : 0;
  }

  function trim(arr: { t: number }[], now: number, ms: number) {
    const cutoff = now - ms;
    let i = 0;
    while (i < arr.length && arr[i].t < cutoff) i++;
    if (i > 0) arr.splice(0, i);
  }

  // ---- rendering the trace ----------------------------------------------

  function fitCanvas() {
    const canvas = scopeRef.current;
    if (!canvas) return null;
    if (!scopeCtxRef.current) scopeCtxRef.current = canvas.getContext("2d");
    const ctx = scopeCtxRef.current;
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { ctx, w, h };
  }

  // Trace/grid colors come from the theme (text-bad on the canvas, text-muted
  // on the disclaimer) so the canvas never hardcodes a palette.
  function colors() {
    if (!colorsRef.current) {
      const canvas = scopeRef.current;
      const trace = canvas ? getComputedStyle(canvas).color : "currentColor";
      const grid = disclaimerRef.current ? getComputedStyle(disclaimerRef.current).color : trace;
      colorsRef.current = { trace, grid };
    }
    return colorsRef.current;
  }

  function drawScope() {
    const fit = fitCanvas();
    if (!fit) return;
    const { ctx, w, h } = fit;
    const proc = procRef.current;
    const { trace, grid } = colors();

    ctx.clearRect(0, 0, w, h);

    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    const cols = 6;
    for (let i = 1; i < cols; i++) {
      const gx = (w / cols) * i;
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (proc.length < 2) return;

    let mn = Infinity;
    let mx = -Infinity;
    for (const p of proc) {
      if (p.v < mn) mn = p.v;
      if (p.v > mx) mx = p.v;
    }
    const pad = Math.max((mx - mn) * 0.15, 0.5);
    mn -= pad;
    mx += pad;
    const range = displayRangeRef.current;
    range.min += (mn - range.min) * 0.08;
    range.max += (mx - range.max) * 0.08;
    const span = Math.max(range.max - range.min, 0.001);

    const t0 = proc[0].t;
    const tSpan = Math.max(proc[proc.length - 1].t - t0, 1);
    const weak =
      recentAmplitude(proc[proc.length - 1].t, CONFIG.ampWindowMs) < 0.35 ||
      ibisRef.current.length < CONFIG.ibiForBPM;

    ctx.globalAlpha = weak ? 0.45 : 1;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = trace;
    ctx.shadowColor = trace;
    ctx.shadowBlur = 8 + traceFlashRef.current * 10;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < proc.length; i++) {
      const x = ((proc[i].t - t0) / tSpan) * w;
      const y = h - ((proc[i].v - range.min) / span) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const ly = h - ((proc[proc.length - 1].v - range.min) / span) * h;
    ctx.fillStyle = trace;
    ctx.beginPath();
    ctx.arc(w - 2, ly, 3 + traceFlashRef.current * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (traceFlashRef.current > 0) traceFlashRef.current = Math.max(0, traceFlashRef.current - 0.08);
  }

  function clearScope() {
    const fit = fitCanvas();
    if (fit) fit.ctx.clearRect(0, 0, fit.w, fit.h);
  }

  function kickNumber() {
    const el = beatRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.transform = "scale(1.07)";
    if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
    kickTimerRef.current = setTimeout(() => {
      if (beatRef.current) beatRef.current.style.transform = "scale(1)";
    }, 140);
  }

  // ---- UI ---------------------------------------------------------------

  const moodClass = mood === "locked" ? "text-good" : mood === "ok" ? "text-white" : "text-muted";

  return (
    <div className="space-y-5">
      <Card className="relative h-48 overflow-hidden">
        <canvas ref={scopeRef} className="absolute inset-0 h-full w-full text-bad" aria-label="Live pulse waveform" />
        {!running && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm leading-relaxed text-muted">
            Cover the rear camera lens with your fingertip, then press Start and hold still.
          </div>
        )}
      </Card>

      <div className="flex flex-col items-center gap-1 py-2">
        <span
          ref={beatRef}
          className={`text-7xl font-bold tabular-nums tracking-tight transition-transform ${moodClass}`}
        >
          {bpm == null ? "— —" : bpm}
        </span>
        <span className="text-xs uppercase tracking-[0.2em] text-muted">bpm</span>
        <p className={`mt-2 min-h-5 text-center text-sm ${statusWarn ? "text-bad" : "text-muted"}`} aria-live="polite">
          {statusText}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        {/* Not disabled while requesting: startingRef already guards re-entry,
            and the disabled attribute would drop keyboard focus to <body>. */}
        <Button
          onClick={() => (running ? stop() : start())}
          variant={running ? "ghost" : "primary"}
          className="min-w-32"
        >
          {running ? "Stop" : cameraState === "requesting" ? "Starting…" : "Start"}
        </Button>
        {torchAvailable && (
          <Button onClick={() => setTorch(!torchOn)} variant="ghost">
            {torchOn ? "Flash on" : "Flash off"}
          </Button>
        )}
      </div>

      <p ref={disclaimerRef} className="text-center text-xs text-muted">
        An estimate from your fingertip&apos;s color changes — not a medical device.
      </p>

      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
    </div>
  );
}
