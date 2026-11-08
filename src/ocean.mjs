// These are extrema of hourly total sea-level model samples, not official tide tables.
const finite = (x) => typeof x === "number" && Number.isFinite(x);
export function oceanExtrema(hours, from = 0) {
  const result = [];
  for (let i = 1; i < hours.length - 1; i++) {
    const a = hours[i - 1],
      b = hours[i],
      c = hours[i + 1];
    if (
      b.time < from ||
      b.time - a.time !== 3600000 ||
      c.time - b.time !== 3600000 ||
      ![a.seaLevel, b.seaLevel, c.seaLevel].every(finite)
    )
      continue;
    if (b.seaLevel > a.seaLevel && b.seaLevel > c.seaLevel)
      result.push({ time: b.time, value: b.seaLevel, kind: "high" });
    if (b.seaLevel < a.seaLevel && b.seaLevel < c.seaLevel)
      result.push({ time: b.time, value: b.seaLevel, kind: "low" });
  }
  return result;
}
export function levelTrend(hours, time) {
  const i = hours.findIndex((h) => h.time <= time && h.time + 3600000 > time);
  if (i < 0 || i + 1 >= hours.length) return null;
  const a = hours[i],
    b = hours[i + 1];
  if (b.time - a.time !== 3600000 || !finite(a.seaLevel) || !finite(b.seaLevel))
    return null;
  const diff = b.seaLevel - a.seaLevel;
  return Math.abs(diff) < 0.02
    ? "Pouca variação prevista"
    : diff > 0
      ? "Nível a subir"
      : "Nível a descer";
}
export function directionLabel(degrees) {
  if (!finite(degrees) || degrees < 0 || degrees > 360) return "—";
  return ["N", "NE", "E", "SE", "S", "SO", "O", "NO"][
    Math.round(degrees / 45) % 8
  ];
}
