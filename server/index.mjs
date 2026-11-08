import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ZONES, isNumber } from "../src/domain.mjs";
import { createProvider } from "./provider.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = express(),
  forecast = createProvider();
app.disable("x-powered-by");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
let budget = { at: Date.now(), count: 0 };
app.use("/api/forecast", (req, res, next) => {
  if (Date.now() - budget.at >= 60000) budget = { at: Date.now(), count: 0 };
  if (++budget.count > 120) {
    res.set("Retry-After", "60");
    return res
      .status(429)
      .json({ error: "Demasiados pedidos. Tente daqui a um minuto." });
  }
  next();
});
app.get("/api/forecast/:zone", async (req, res) => {
  let zone =
    req.params.zone === "custom"
      ? { id: "custom", lat: null, lon: null }
      : ZONES.find((z) => z.id === req.params.zone);
  if (!zone) return res.status(404).json({ error: "Zona desconhecida." });
  if (
    ["calanga", "machubo", "custom"].includes(zone.id) &&
    (req.query.lat !== undefined || req.query.lon !== undefined)
  ) {
    const lat = Number(req.query.lat),
      lon = Number(req.query.lon);
    if (
      typeof req.query.lat !== "string" ||
      typeof req.query.lon !== "string" ||
      !isNumber(lat) ||
      !isNumber(lon) ||
      lat < -27 ||
      lat > -23 ||
      lon < 32 ||
      lon > 36
    )
      return res.status(400).json({ error: "Coordenadas fora da costa sul." });
    zone = {
      ...zone,
      lat: Math.round(lat * 1000) / 1000,
      lon: Math.round(lon * 1000) / 1000,
    };
  }
  if (!isNumber(zone.lat) || !isNumber(zone.lon))
    return res.status(422).json({ error: "Localização por confirmar." });
  res.set("Cache-Control", "no-store");
  res.json(await forecast(zone));
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Recurso desconhecido." }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(resolve(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(
  Number(process.env.PORT) || 3000,
  "0.0.0.0",
  (error) => {
    if (error) {
      console.error(
        `Não foi possível iniciar o servidor: ${error.code || error.message}`,
      );
      process.exit(1);
    }
    console.log(
      "Marés disponível na porta " + (Number(process.env.PORT) || 3000),
    );
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
