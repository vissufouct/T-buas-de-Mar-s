const TTL = 60 * 60 * 1000;
const ERROR_TTL = 5 * 60 * 1000;
const MAX_STALE = 6 * 60 * 60 * 1000;
const finite = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
export function mergeHours(weather, marine) {
  const w = weather?.hourly,
    m = marine?.hourly;
  const indexed = new Map((m?.time || []).map((t, i) => [t, i]));
  const times = [...new Set([...(w?.time || []), ...(m?.time || [])])].sort(
    (a, b) => a - b,
  );
  const wi = new Map((w?.time || []).map((t, i) => [t, i]));
  return times.map((t) => {
    const i = wi.get(t),
      j = indexed.get(t);
    return {
      time: t * 1000,
      wind: finite(w?.wind_speed_10m?.[i]),
      gust: finite(w?.wind_gusts_10m?.[i]),
      direction: finite(w?.wind_direction_10m?.[i]),
      rain: finite(w?.precipitation?.[i]),
      temperature: finite(w?.temperature_2m?.[i]),
      wave: finite(m?.wave_height?.[j]),
      period: finite(m?.wave_period?.[j]),
      waveDirection: finite(m?.wave_direction?.[j]),
    };
  });
}
function validate(payload, kind) {
  const h = payload?.hourly;
  if (
    !h ||
    !Array.isArray(h.time) ||
    !h.time.length ||
    h.time.length > 500 ||
    !h.time.every(Number.isFinite)
  )
    throw new Error("Formato de previsão inválido.");
  const fields =
    kind === "weather"
      ? [
          "wind_speed_10m",
          "wind_gusts_10m",
          "wind_direction_10m",
          "precipitation",
          "temperature_2m",
        ]
      : ["wave_height", "wave_period", "wave_direction"];
  for (const f of fields)
    if (!Array.isArray(h[f]) || h[f].length !== h.time.length)
      throw new Error("Previsão incompleta.");
  const units = payload.hourly_units;
  if (
    kind === "weather" &&
    (units?.wind_speed_10m !== "km/h" || units?.precipitation !== "mm")
  )
    throw new Error("Unidades meteorológicas inesperadas.");
  if (
    kind === "marine" &&
    (units?.wave_height !== "m" || units?.wave_period !== "s")
  )
    throw new Error("Unidades marinhas inesperadas.");
  return payload;
}
export function createProvider(fetcher = fetch, clock = Date.now) {
  const cache = new Map(),
    pending = new Map();
  async function request(zone, kind) {
    const url = new URL(
      kind === "weather"
        ? "https://api.open-meteo.com/v1/forecast"
        : "https://marine-api.open-meteo.com/v1/marine",
    );
    const hourly =
      kind === "weather"
        ? "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
        : "wave_height,wave_direction,wave_period";
    url.search = new URLSearchParams({
      latitude: String(zone.lat),
      longitude: String(zone.lon),
      hourly,
      timezone: "Africa/Maputo",
      timeformat: "unixtime",
      forecast_days: "7",
      ...(kind === "weather"
        ? { wind_speed_unit: "kmh" }
        : { cell_selection: "sea" }),
    }).toString();
    const key = `${zone.id}:${zone.lat}:${zone.lon}:${kind}`,
      previous = cache.get(key),
      now = clock();
    if (
      previous &&
      now - previous.attemptedAt < (previous.error ? ERROR_TTL : TTL)
    )
      return previous;
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
      let entry;
      try {
        const response = await fetcher(url, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new Error(`Fornecedor indisponível (HTTP ${response.status}).`);
        const raw = validate(await response.json(), kind);
        entry = {
          raw,
          fetchedAt: now,
          attemptedAt: now,
          error: null,
          url: url.toString(),
        };
      } catch {
        const usable = previous?.raw && now - previous.fetchedAt < MAX_STALE;
        entry = {
          raw: usable ? previous.raw : null,
          fetchedAt: usable ? previous.fetchedAt : null,
          attemptedAt: now,
          error:
            "Não foi possível atualizar esta fonte. Verifique a ligação e tente mais tarde.",
          url: url.toString(),
        };
      }
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, entry);
      return entry;
    })();
    pending.set(key, job);
    try {
      return await job;
    } finally {
      pending.delete(key);
    }
  }
  return async (zone) => {
    const [weather, marine] = await Promise.all([
      request(zone, "weather"),
      request(zone, "marine"),
    ]);
    const sources = [
      ["weather", weather],
      ["marine", marine],
    ].map(([id, e]) => ({
      id,
      label: id === "weather" ? "Open-Meteo Weather" : "Open-Meteo Marine",
      url: e.url,
      kind: "Previsão de modelo",
      fetchedAt: e.fetchedAt,
      error: e.error,
      modelPoint: e.raw ? { lat: e.raw.latitude, lon: e.raw.longitude } : null,
    }));
    return {
      zoneId: zone.id,
      hours: mergeHours(weather.raw, marine.raw),
      sources,
      stale: sources.some((s) => !!s.error),
      checkedAt: clock(),
      nextRefreshAt: Math.min(
        weather.attemptedAt + (weather.error ? ERROR_TTL : TTL),
        marine.attemptedAt + (marine.error ? ERROR_TTL : TTL),
      ),
    };
  };
}
