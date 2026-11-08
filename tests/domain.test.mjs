import test from "node:test";
import assert from "node:assert/strict";
import {
  lunar,
  solar,
  evaluate,
  currentRow,
  bestWindow,
  dateKey,
  ZONES,
} from "../src/domain.mjs";
const zone = ZONES.find((z) => z.id === "macaneta");
const row = {
  time: Date.parse("2026-11-09T07:00:00+02:00"),
  wind: 12,
  gust: 20,
  wave: 1,
  period: 8,
  rain: 0,
};
test("new and full moons suggest spring cycle; quarter suggests neap", () => {
  assert.equal(lunar("2024-04-08T18:00:00Z").tide, "Vivas");
  assert.equal(lunar("2024-04-23T23:00:00Z").tide, "Vivas");
  assert.equal(lunar("2024-04-15T19:00:00Z").tide, "Mortas");
});
test("Maputo date and solar day independent of machine timezone", () => {
  assert.equal(dateKey("2026-11-08T23:00:00Z"), "2026-11-09");
  assert.equal(
    dateKey(solar("2026-11-08T23:00:00Z", zone).sunrise),
    "2026-11-09",
  );
});
test("missing, stale and pending locations never receive positive recommendations", () => {
  assert.equal(evaluate({ ...row, wave: null }, zone).state, "unknown");
  assert.equal(evaluate(row, zone, true).state, "unknown");
  assert.equal(
    evaluate(
      row,
      ZONES.find((z) => z.id === "calanga"),
    ).state,
    "unknown",
  );
  assert.equal(evaluate({ ...row, gust: null }, zone).state, "unknown");
});
test("dangerous known conditions still warn if another source is missing", () => {
  assert.equal(
    evaluate({ ...row, wind: 35, wave: null }, zone).state,
    "caution",
  );
  assert.equal(evaluate({ ...row, gust: 50 }, zone).state, "caution");
  assert.equal(evaluate({ ...row, period: 14 }, zone).state, "fair");
});
test("calm daylight has a partial recommendation, bay and night do not", () => {
  assert.equal(evaluate(row, zone).state, "good");
  assert.equal(
    evaluate(
      row,
      ZONES.find((z) => z.id === "catembe"),
    ).state,
    "fair",
  );
  assert.equal(
    evaluate({ ...row, time: Date.parse("2026-11-09T23:00:00+02:00") }, zone)
      .state,
    "fair",
  );
});
test("best window excludes past dates and stale data, current hour has bounded validity", () => {
  const data = {
    hours: [row, { ...row, time: row.time + 86400000 }],
    stale: false,
  };
  assert.equal(
    bestWindow(data, zone, undefined, row.time + 1).time,
    row.time + 86400000,
  );
  assert.equal(
    bestWindow({ ...data, stale: true }, zone, undefined, row.time - 1),
    null,
  );
  assert.equal(bestWindow(data, zone, "2026-11-09", row.time + 1), null);
  assert.equal(currentRow(data, row.time + 3600000), undefined);
  assert.equal(currentRow(data, row.time + 10), row);
});
test("all requested named zones are included, unverified points remain empty", () => {
  for (const id of ["costa-sol", "calanga", "machubo"])
    assert.ok(ZONES.some((z) => z.id === id));
  assert.equal(ZONES.find((z) => z.id === "machubo").lat, null);
});
