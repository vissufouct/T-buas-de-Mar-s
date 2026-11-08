import test from "node:test";
import assert from "node:assert/strict";
import {
  fishingWindows,
  bestWindow,
  dateKey,
  solar,
  ZONES,
} from "../src/domain.mjs";
const zone = ZONES.find((z) => z.id === "macaneta");
const day = "2026-11-09";
const at = (h) =>
  Date.parse(`${day}T${String(h).padStart(2, "0")}:00:00+02:00`);
const row = (h) => ({
  time: at(h),
  wind: 12,
  gust: 20,
  wave: 1,
  period: 8,
  rain: 0,
});
const data = {
  hours: Array.from({ length: 24 }, (_, h) => row(h)),
  stale: false,
};
const now = at(0);
test("every eligible hour is included once, grouped by class and ordered by start", () => {
  const windows = fishingWindows(data, zone, day, now);
  assert.deepEqual(
    windows.map((w) => w.potential),
    ["Alto", "Bom", "Alto"],
  );
  const included = windows.flatMap((w) => w.samples.map((r) => r.time));
  const { sunrise, sunset } = solar(now, zone);
  const expected = data.hours
    .filter((r) => r.time >= Date.parse(sunrise) && r.time < Date.parse(sunset))
    .map((r) => r.time);
  assert.deepEqual(included, expected);
  assert.equal(new Set(included).size, included.length);
  assert.ok(windows.every((w) => w.end <= Date.parse(sunset)));
  assert.ok(windows.every((w, i) => i === 0 || w.time >= windows[i - 1].end));
});
test("missing and adverse hours break windows, moderate hours get their own class", () => {
  const changed = {
    hours: [
      row(8),
      row(9),
      { ...row(10), wind: 35 },
      row(11),
      { ...row(12), wave: null },
      row(13),
      { ...row(14), rain: 2 },
      row(16),
    ],
    stale: false,
  };
  const windows = fishingWindows(changed, zone, day, now);
  assert.deepEqual(
    windows.map((w) => w.time),
    [at(8), at(11), at(13), at(14), at(16)],
  );
  assert.equal(windows[0].end, at(10));
  assert.equal(windows[3].potential, "Moderado");
  assert.ok(windows[3].evaluation.reasons.some((r) => r.includes("Chuva")));
});
test("stale, unknown zones, empty horizons and started hours cannot generate future windows", () => {
  assert.deepEqual(
    fishingWindows({ ...data, stale: true }, zone, day, now),
    [],
  );
  assert.deepEqual(
    fishingWindows(
      data,
      ZONES.find((z) => z.id === "calanga"),
      day,
      now,
    ),
    [],
  );
  assert.deepEqual(fishingWindows(data, zone, "2026-12-01", now), []);
  assert.ok(
    fishingWindows(data, zone, day, at(12) + 1).every((w) => w.time >= at(13)),
  );
});
test("days never merge, timezone boundaries, duplicates and input remain stable", () => {
  const rows = [
    row(17),
    { ...row(5), time: at(5) + 86400000 },
    row(8),
    row(8),
  ].reverse();
  const original = JSON.stringify(rows),
    windows = fishingWindows({ hours: rows }, zone, undefined, now);
  assert.equal(JSON.stringify(rows), original);
  assert.ok(windows.every((w) => dateKey(w.time) === dateKey(w.end - 1)));
  assert.equal(windows.flatMap((w) => w.samples).length, 3);
  assert.equal(
    fishingWindows({ hours: rows }, zone, "2026-11-10", now).length,
    1,
  );
});
test("estuary offers moderate daytime windows, highlight belongs to displayed windows", () => {
  const estuary = ZONES.find((z) => z.id === "catembe");
  assert.ok(
    fishingWindows(data, estuary, day, now).every(
      (w) => w.potential === "Moderado",
    ),
  );
  const windows = fishingWindows(data, zone, day, now),
    best = bestWindow(data, zone, day, now);
  assert.ok(windows.some((w) => w.time === best.time && w.end === best.end));
});
