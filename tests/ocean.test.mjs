import test from "node:test";
import assert from "node:assert/strict";
import { oceanExtrema, levelTrend, directionLabel } from "../src/ocean.mjs";
const series = (values) =>
  values.map((seaLevel, i) => ({ time: 100000 + i * 3600000, seaLevel }));
test("model extrema preserve below-MSL troughs and only use future interior samples", () => {
  const h = series([0, 1, 0, -1, 0, 1, 0]);
  assert.deepEqual(
    oceanExtrema(h).map((e) => [e.kind, e.value]),
    [
      ["high", 1],
      ["low", -1],
      ["high", 1],
    ],
  );
  assert.deepEqual(
    oceanExtrema(h, h[3].time).map((e) => e.time),
    [h[3].time, h[5].time],
  );
});
test("gaps, nulls, endpoints and plateaus are not invented turning points", () => {
  assert.deepEqual(oceanExtrema(series([0, null, 0])), []);
  assert.deepEqual(oceanExtrema(series([0, 1, 1, 0])), []);
  const gap = series([0, 1, 0]);
  gap[2].time += 3600000;
  assert.deepEqual(oceanExtrema(gap), []);
  assert.deepEqual(oceanExtrema(series([0, 1])), []);
});
test("trend expires after current hourly sample, handles flat/negative levels", () => {
  const h = series([-1, -0.5, -0.5, -1]);
  assert.equal(levelTrend(h, h[0].time), "Nível a subir");
  assert.equal(levelTrend(h, h[1].time), "Pouca variação prevista");
  assert.equal(levelTrend(h, h[2].time), "Nível a descer");
  assert.equal(levelTrend(h, h[3].time), null);
  assert.equal(directionLabel(90), "E");
  assert.equal(directionLabel(360), "N");
  assert.equal(directionLabel(null), "—");
});
