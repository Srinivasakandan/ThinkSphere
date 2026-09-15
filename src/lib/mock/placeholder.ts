/**
 * Generates a deterministic SVG data-URI placeholder standing in for a
 * photographed product image. Keeps the demo self-contained with no
 * external network calls for image assets.
 */
export function placeholderImage(
  label: string,
  sublabel: string,
  seed: number
): string {
  const hue = (seed * 47) % 360;
  const bg = `hsl(${hue}, 28%, 93%)`;
  const accent = `hsl(${hue}, 45%, 55%)`;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
  <rect width="640" height="800" fill="${bg}" />
  <rect x="40" y="40" width="560" height="720" rx="18" fill="white" stroke="${accent}" stroke-width="3" stroke-dasharray="10 8" />
  <circle cx="320" cy="330" r="90" fill="${accent}" opacity="0.15" />
  <rect x="230" y="290" width="180" height="80" rx="10" fill="${accent}" opacity="0.35" />
  <text x="320" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#1f2937" font-weight="700">${escapeXml(
    label
  )}</text>
  <text x="320" y="508" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#4b5563">${escapeXml(
    sublabel
  )}</text>
  <text x="320" y="744" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#9ca3af">Simulated product photo — demo mode</text>
</svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
