import test from "node:test";
import assert from "node:assert/strict";
import { createProvider, mergeHours } from "../server/provider.mjs";
const zone = { id: "test", lat: -25.8, lon: 32.7 };
// Synthetic payloads only for automated tests; never served in the application.
function payload(kind) {
  return {
    latitude: zone.lat,
    longitude: zone.lon,
    hourly_units:
      kind === "weather"
        ? { wind_speed_10m: "km/h", precipitation: "mm" }
        : { wave_height: "m", wave_period: "s" },
    hourly:
      kind === "weather"
        ? {
            time: [1000, 4600],
            wind_speed_10m: [0, 12],
            wind_gusts_10m: [2, 20],
            wind_direction_10m: [0, 180],
            temperature_2m: [25, 26],
            precipitation: [0, 0],
          }
        : {
            time: [4600],
            wave_height: [1.2],
            wave_period: [8],
            wave_direction: [90],
          },
  };
}
test("time join preserves missingness and real zeroes", () => {
  const hours = mergeHours(payload("weather"), payload("marine"));
  assert.equal(hours[0].wind, 0);
  assert.equal(hours[0].wave, null);
  assert.equal(hours[1].wave, 1.2);
  assert.equal(hours[1].time, 4600000);
});
test("parallel requests deduplicate, cache serves repeat calls and refreshes after TTL", async () => {
  let now = 100000,
    calls = 0;
  const provider = createProvider(
    async (url) => {
      calls++;
      return {
        ok: true,
        json: async () =>
          payload(url.hostname.startsWith("marine") ? "marine" : "weather"),
      };
    },
    () => now,
  );
  const [a, b] = await Promise.all([provider(zone), provider(zone)]);
  assert.equal(calls, 2);
  assert.equal(a.stale, false);
  assert.deepEqual(a, b);
  await provider(zone);
  assert.equal(calls, 2);
  now += 3600001;
  await provider(zone);
  assert.equal(calls, 4);
});
test("provider failure returns missing data, caches errors briefly and marks retained data stale", async () => {
  let now = 100000,
    fail = false,
    calls = 0;
  const provider = createProvider(
    async (url) => {
      calls++;
      if (fail) throw Error("offline");
      return {
        ok: true,
        json: async () =>
          payload(url.hostname.startsWith("marine") ? "marine" : "weather"),
      };
    },
    () => now,
  );
  await provider(zone);
  fail = true;
  now += 3600001;
  const stale = await provider(zone);
  assert.equal(stale.stale, true);
  assert.ok(stale.hours.length);
  const n = calls;
  await provider(zone);
  assert.equal(calls, n);
  now += 6 * 3600000;
  const expired = await provider(zone);
  assert.equal(expired.hours.length, 0);
  assert.equal(expired.sources[0].fetchedAt, null);
});
test("malformed units fail closed and coordinates are part of cache identity", async () => {
  const bad = createProvider(async () => ({
    ok: true,
    json: async () => ({ hourly: { time: [1] } }),
  }));
  assert.equal((await bad(zone)).hours.length, 0);
  let calls = 0;
  const good = createProvider(async (url) => {
    calls++;
    return {
      ok: true,
      json: async () =>
        payload(url.hostname.startsWith("marine") ? "marine" : "weather"),
    };
  });
  await good(zone);
  await good({ ...zone, lat: -25.5 });
  assert.equal(calls, 4);
});
