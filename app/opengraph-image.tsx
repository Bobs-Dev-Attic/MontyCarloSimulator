import { ImageResponse } from "next/og";

export const alt = "Monty Carlo Simulator — run thousands of financial scenarios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1120 0%, #111a2e 100%)",
          color: "#e2e8f0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 44 }}>🎲</div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            color: "#ffffff",
            marginTop: 12,
          }}
        >
          Monty Carlo Simulator
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#94a3b8",
            marginTop: 24,
            maxWidth: 960,
          }}
        >
          Thousands of scenarios — retirement, sequence risk, Roth &amp; tax, and
          more. Private, in your browser.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#38bdf8",
            marginTop: 48,
          }}
        >
          Educational tool — not financial advice
        </div>
      </div>
    ),
    { ...size }
  );
}
