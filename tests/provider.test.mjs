import test from "node:test";
import assert from "node:assert/strict";
import { createProvider, mergeHours } from "../server/provider.mjs";
const zone = { id: "test", lat: -25.8, lon: 32.7 };
// Synthetic payloads only for automated tests; never served in the application.
function kindFor(url) {
  return url.searchParams.has("models")
    ? "ocean"
    : url.hostname.startsWith("marine")
      ? "marine"
      : "weather";
}
function payload(kind) {
  if (kind === "ocean")
    return {
      latitude: zone.lat,
      longitude: zone.lon,
      hourly_units: {
        sea_level_height_msl: "m",
        ocean_current_velocity: "km/h",
        ocean_current_direction: "°",
        sea_surface_temperature: "°C",
      },
      hourly: {
        time: [1000, 4600],
        sea_level_height_msl: [-0.65, 0],
        ocean_current_velocity: [0, 2.3],
        ocean_current_direction: [0, 120],
        sea_surface_temperature: [25.4, null],
      },
    };
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
        json: async () => payload(kindFor(url)),
      };
    },
    () => now,
  );
  const [a, b] = await Promise.all([provider(zone), provider(zone)]);
  assert.equal(calls, 3);
  assert.equal(a.stale, false);
  assert.deepEqual(a, b);
  await provider(zone);
  assert.equal(calls, 3);
  now += 3600001;
  await provider(zone);
  assert.equal(calls, 6);
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
        json: async () => payload(kindFor(url)),
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
      json: async () => payload(kindFor(url)),
    };
  });
  await good(zone);
  await good({ ...zone, lat: -25.5 });
  assert.equal(calls, 6);
});

test("ocean fields preserve negative MSL, zero currents and missing temperature", () => {
  const rows = mergeHours(
    payload("weather"),
    payload("marine"),
    payload("ocean"),
  );
  assert.equal(rows[0].seaLevel, -0.65);
  assert.equal(rows[0].currentSpeed, 0);
  assert.equal(rows[0].currentDirection, 0);
  assert.equal(rows[1].seaLevel, 0);
  assert.equal(rows[1].seaTemperature, null);
});
test("ocean failure leaves the original weather and wave forecast usable", async () => {
  const provider = createProvider(async (url) => {
    if (kindFor(url) === "ocean") throw Error("unavailable");
    return { ok: true, json: async () => payload(kindFor(url)) };
  });
  const result = await provider(zone);
  assert.equal(result.stale, false);
  assert.equal(result.oceanStale, true);
  assert.equal(result.hours[1].wave, 1.2);
  assert.equal(result.hours[1].seaLevel, null);
  assert.ok(result.sources.find((s) => s.id === "ocean").error);
});
test("ocean contract requests explicit model and km/h; wrong units fail ocean only", async () => {
  const provider = createProvider(async (url) => {
    const kind = kindFor(url),
      data = payload(kind);
    if (kind === "ocean") {
      assert.equal(url.searchParams.get("models"), "meteofrance_currents");
      assert.equal(url.searchParams.get("wind_speed_unit"), "kmh");
      data.hourly_units.ocean_current_velocity = "m/s";
    }
    return { ok: true, json: async () => data };
  });
  const result = await provider(zone);
  assert.equal(result.oceanStale, true);
  assert.equal(result.stale, false);
  assert.equal(result.hours[0].currentSpeed, null);
});
