import { useState } from "react";

/** Official white wordmark (bundled locally) with a typographic fallback that holds its shape. */
export default function Wordmark({ height = 30, fallbackSize = 15 }: { height?: number; fallbackSize?: number }) {
  const [bad, setBad] = useState(false);
  if (bad) {
    return <span style={{ fontSize: fallbackSize, fontWeight: 700, letterSpacing: "-.02em", color: "#f7f6f2", whiteSpace: "nowrap" }}>Forja Works</span>;
  }
  return (
    <img
      src="/brand/forja-works-white.svg"
      alt="Forja Works"
      onError={() => setBad(true)}
      style={{ height, width: "auto", display: "block", objectFit: "contain", objectPosition: "left center" }}
    />
  );
}
