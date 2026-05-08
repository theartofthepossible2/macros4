"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CameraGate from "@/components/CameraGate";
import TabBar from "@/components/TabBar";
import { resizeImage } from "@/lib/image";

type Props = { barcode: string | null };

export default function ScanClient({ barcode }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function onCapture(blob: Blob) {
    setBusy(true);
    setError("");
    try {
      const dataUrl = await resizeImage(blob, 1024, 0.82);
      // Stash the image and navigate to confirm. We use sessionStorage so it
      // does not survive a tab close — the photo never persists at rest.
      sessionStorage.setItem("pending_meal_image", dataUrl);
      router.push("/confirm");
    } catch (e: any) {
      setError(e?.message || "Failed to prepare photo");
      setBusy(false);
    }
  }

  if (!barcode) {
    return (
      <main className="app-frame">
        <header className="app-header">
          <span className="title">Capture</span>
        </header>
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 14 }}>Set your membership tag number first.</p>
          <a href="/settings" style={{ fontSize: 12, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Open settings →</a>
        </div>
        <TabBar />
      </main>
    );
  }

  return (
    <main className="app-frame">
      <header className="app-header">
        <span className="title">Capture</span>
        <span style={{ fontSize: 11, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }} />
          synced
        </span>
      </header>

      <CameraGate expectedBarcode={barcode} onCapture={onCapture} />

      {busy && <div style={busyOverlay}>Preparing photo…</div>}
      {error && <div style={{ ...busyOverlay, color: "var(--err)" }}>{error}</div>}

      <TabBar />
    </main>
  );
}

const busyOverlay: React.CSSProperties = {
  position: "absolute",
  bottom: 80,
  left: 16,
  right: 16,
  padding: "8px 12px",
  background: "rgba(0,0,0,0.7)",
  color: "white",
  fontSize: 12,
  borderRadius: 4,
  textAlign: "center",
};
