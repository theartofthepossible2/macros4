"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { captureFrame } from "@/lib/image";

type GateState = "initializing" | "searching" | "matched" | "mismatch" | "timeout" | "denied";

type Props = {
  expectedBarcode: string;
  onCapture: (blob: Blob) => void;
  timeoutMs?: number;
};

export default function CameraGate({ expectedBarcode, onCapture, timeoutMs = 15000 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<GateState>("initializing");

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, _err, ctrl) => {
            if (cancelled) return;
            if (!result) return;
            const text = result.getText().trim();
            if (text === expectedBarcode.trim()) {
              setState("matched");
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            } else {
              setState("mismatch");
            }
          }
        );
        controlsRef.current = controls;
        if (!cancelled) {
          setState("searching");
          timeoutRef.current = setTimeout(() => {
            setState((s) => (s === "searching" ? "timeout" : s));
          }, timeoutMs);
        }
      } catch (e) {
        if (!cancelled) setState("denied");
      }
    })();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [expectedBarcode, timeoutMs, stopScanner]);

  const onShutter = useCallback(async () => {
    if (state !== "matched" || !videoRef.current) return;
    const blob = await captureFrame(videoRef.current);
    stopScanner();
    onCapture(blob);
  }, [state, onCapture, stopScanner]);

  const banner = bannerCopy(state);
  const pill = pillCopy(state);
  const armed = state === "matched";

  return (
    <div style={{ flex: 1, background: "#1a1a1a", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* corner brackets */}
      <svg viewBox="0 0 300 400" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <path d="M 30 30 L 30 60 M 30 30 L 60 30" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
        <path d="M 270 30 L 270 60 M 270 30 L 240 30" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
        <path d="M 30 370 L 30 340 M 30 370 L 60 370" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
        <path d="M 270 370 L 270 340 M 270 370 L 240 370" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
      </svg>

      <div style={topBannerStyle}>{banner}</div>

      <div style={pillStyle}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: pill.dot }} />
        <span>{pill.text}</span>
      </div>

      <div style={controlsRowStyle}>
        <button
          onClick={onShutter}
          disabled={!armed}
          aria-label="capture"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: armed ? "2px solid white" : "2px solid rgba(255,255,255,0.3)",
            background: armed ? "white" : "rgba(255,255,255,0.25)",
            padding: 0,
            cursor: armed ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          <span
            style={{
              display: "block",
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: armed ? "white" : "rgba(255,255,255,0.25)",
              border: armed ? "1.5px solid #1a1a1a" : "1.5px solid rgba(26,26,26,0.4)",
              margin: "auto",
              transition: "all 0.2s",
            }}
          />
        </button>
      </div>
    </div>
  );
}

function bannerCopy(state: GateState): string {
  switch (state) {
    case "initializing": return "Starting camera…";
    case "searching": return "Include tag in frame";
    case "matched": return "Frame your meal";
    case "mismatch": return "This tag belongs to a different account";
    case "timeout": return "Can't find your tag — check lighting and framing";
    case "denied": return "Camera access denied. Enable it in your browser settings.";
  }
}

function pillCopy(state: GateState): { text: string; dot: string } {
  switch (state) {
    case "initializing": return { text: "starting…", dot: "#888780" };
    case "searching": return { text: "searching for tag", dot: "#f0c14b" };
    case "matched": return { text: "tag matched", dot: "#5DCAA5" };
    case "mismatch": return { text: "tag mismatch", dot: "#E24B4A" };
    case "timeout": return { text: "no tag detected", dot: "#888780" };
    case "denied": return { text: "camera blocked", dot: "#E24B4A" };
  }
}

const topBannerStyle: React.CSSProperties = {
  position: "absolute",
  top: 16, left: 16, right: 16,
  background: "rgba(0,0,0,0.6)",
  color: "white",
  fontSize: 11,
  padding: "8px 12px",
  borderRadius: 4,
  textAlign: "center",
  letterSpacing: "0.02em",
  lineHeight: 1.4,
};

const pillStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 96,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(0,0,0,0.6)",
  color: "white",
  fontSize: 10,
  padding: "6px 12px",
  borderRadius: 4,
  letterSpacing: "0.03em",
};

const controlsRowStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};
