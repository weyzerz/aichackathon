"use client";

import { useState } from "react";

export default function ResetButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function reset() {
    if (!confirm("Reset the demo to its starting data?")) return;
    setState("busy");
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  return (
    <button
      type="button"
      onClick={reset}
      disabled={state === "busy"}
      className="rounded-full border border-[#8A9A7B]/50 px-4 py-2 text-sm text-[#6B7A5E] transition hover:bg-[#8A9A7B]/10 disabled:opacity-50"
    >
      {state === "busy" ? "Resetting…" : state === "done" ? "Demo reset ✓" : state === "error" ? "Reset failed, retry" : "Reset demo"}
    </button>
  );
}
