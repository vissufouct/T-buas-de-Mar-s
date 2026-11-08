import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
let checks = 0;
const pagesMode = process.env.PAGES_TEST === "1";
const backendRequests = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (pagesMode) {
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/"))
        backendRequests.push(r.url());
    });
    await page.route(/^https:\/\/(api|marine-api)\.open-meteo\.com\//, (r) =>
      r.abort(),
    );
  }
  // Explicit offline fixtures exercise failure UX without relying on network policy.
  await page.route("**/api/forecast/**", (r) =>
    r.fulfill({
      json: { hours: [], sources: [], stale: true, checkedAt: Date.now() },
    }),
  );
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto(base);
  await page
    .getByText("Não foi possível obter todas as previsões.", { exact: false })
    .waitFor();
  for (const name of ["Calanga", "Machubo", "Costa do Sol"])
    assert.ok(
      await page.getByRole("heading", { name, exact: true }).isVisible(),
    );
  assert.equal(await page.locator(".status.good").count(), 0);
  checks++;
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  await page
    .getByLabel("Nome do grupo", { exact: true })
    .fill("Pesca em família");
  await page
    .getByLabel("Tags, separadas por vírgulas")
    .fill("família, fim-de-semana, Família");
  await page
    .getByRole("button", { name: "Guardar grupo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar pino", exact: true })
    .click();
  await page.getByLabel("Nome do pino", { exact: true }).fill("Meu canal");
  await page.getByLabel("Latitude do novo pino").fill("-25.81");
  await page.getByLabel("Longitude do novo pino").fill("32.75");
  await page
    .getByLabel("Grupo do novo pino")
    .selectOption({ label: "Pesca em família" });
  await page.getByRole("button", { name: "Guardar pino", exact: true }).click();
  await page.getByRole("heading", { name: "Meu canal", exact: true }).waitFor();
  assert.ok(
    await page.getByRole("checkbox", { name: /Pesca em família/ }).isChecked(),
  );
  checks++;
  await page
    .getByRole("button", { name: "Minhas zonas", exact: false })
    .click();
  await page
    .getByLabel("Filtrar por grupo")
    .selectOption({ label: "Pesca em família" });
  assert.equal(await page.locator(".zone-card").count(), 1);
  await page.getByLabel("Filtrar por tag").selectOption("família");
  assert.equal(await page.locator(".zone-card").count(), 1);
  await page.reload();
  await page.getByRole("heading", { name: "Meu canal", exact: true }).waitFor();
  await page
    .getByLabel("Filtrar por grupo")
    .selectOption({ label: "Pesca em família" });
  assert.equal(await page.locator(".zone-card").count(), 1);
  checks++;
  await page
    .getByRole("button", { name: "Explorar costa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar grupo Pesca em família", exact: true })
    .click();
  await page
    .getByLabel("Nome do grupo", { exact: true })
    .fill("Amigos da costa");
  await page.getByLabel("Tags, separadas por vírgulas").fill("spinning, praia");
  await page
    .getByRole("button", { name: "Guardar alterações", exact: true })
    .click();
  await page.getByLabel("Filtrar por tag").selectOption("spinning");
  await page
    .getByRole("button", {
      name: "Eliminar grupo Amigos da costa",
      exact: true,
    })
    .click();
  assert.ok(
    await page
      .locator(".picker-select")
      .filter({ hasText: "Meu canal" })
      .isVisible(),
  );
  checks++;
  await page.getByRole("button", { name: "Calendário", exact: true }).click();
  await page.locator(".day-cell").nth(2).click();
  await page
    .getByRole("button", { name: "Guardar dia às 06:00", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Saídas guardadas", exact: true })
    .click();
  assert.equal(await page.locator(".trip").count(), 1);
  await page.reload();
  await page
    .getByRole("button", { name: "Saídas guardadas", exact: true })
    .click();
  assert.equal(await page.locator(".trip").count(), 1);
  checks++;
  await page
    .getByRole("button", { name: "Minhas zonas", exact: false })
    .click();
  await page.locator(".card-link").first().click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  checks++;
  assert.deepEqual(errors, []);
  await context.close();
  const online = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const p = await online.newPage();
  // Synthetic forecast integration fixture, not a validation of the real provider.
  await p.route("**/api/forecast/**", (r) => {
    const start = Math.floor(Date.now() / 3600000) * 3600000;
    const hours = Array.from({ length: 168 }, (_, i) => ({
      time: start + i * 3600000,
      wind: 12,
      gust: 20,
      wave: 1,
      period: 8,
      rain: 0,
      temperature: 25,
      direction: 90,
      waveDirection: 120,
      seaLevel: Math.cos((i * Math.PI) / 6),
      currentSpeed: 1.8,
      currentDirection: 90,
      seaTemperature: 26.4,
    }));
    return r.fulfill({
      json: {
        hours,
        stale: false,
        oceanStale: false,
        sources: [
          {
            id: "ocean",
            label: "Synthetic ocean fixture",
            url: "https://example.test",
            kind: "Test fixture",
            fetchedAt: Date.now(),
            error: null,
          },
          {
            id: "weather",
            label: "Synthetic test fixture",
            url: "https://example.test",
            kind: "Test fixture",
            fetchedAt: Date.now(),
            error: null,
          },
        ],
        checkedAt: Date.now(),
      },
    });
  });
  if (pagesMode) {
    p.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/"))
        backendRequests.push(r.url());
    });
    await p.route(/^https:\/\/(api|marine-api)\.open-meteo\.com\//, (r) => {
      const url = new URL(r.request().url());
      const marine = url.hostname.startsWith("marine"),
        ocean = url.searchParams.get("models") === "meteofrance_currents";
      const time = Array.from(
        { length: 168 },
        (_, i) => Math.floor(Date.now() / 3600000) * 3600 + i * 3600,
      );
      const fill = (v) => time.map(() => v);
      const json = {
        latitude: Number(url.searchParams.get("latitude")),
        longitude: Number(url.searchParams.get("longitude")),
        hourly_units: ocean
          ? {
              sea_level_height_msl: "m",
              ocean_current_velocity: "km/h",
              ocean_current_direction: "°",
              sea_surface_temperature: "°C",
            }
          : marine
            ? { wave_height: "m", wave_period: "s" }
            : { wind_speed_10m: "km/h", precipitation: "mm" },
        hourly: ocean
          ? {
              time,
              sea_level_height_msl: time.map((_, i) =>
                Math.cos((i * Math.PI) / 6),
              ),
              ocean_current_velocity: fill(1.8),
              ocean_current_direction: fill(90),
              sea_surface_temperature: fill(26.4),
            }
          : marine
            ? {
                time,
                wave_height: fill(1),
                wave_period: fill(8),
                wave_direction: fill(120),
              }
            : {
                time,
                wind_speed_10m: fill(12),
                wind_gusts_10m: fill(20),
                wind_direction_10m: fill(90),
                precipitation: fill(0),
                temperature_2m: fill(25),
              },
      };
      return r.fulfill({
        json,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    });
  }
  await p.goto(base);
  await p.getByText("Previsões atualizadas", { exact: true }).waitFor();
  await p.getByRole("button", { name: "Calendário", exact: true }).click();
  await p.locator(".day-cell").nth(1).click();
  await p
    .getByRole("button", { name: "Guardar janela", exact: true })
    .waitFor();
  assert.ok(await p.locator(".recommendation").isVisible());
  checks++;
  await p.screenshot({
    path: "test-results/calendar-fixture.png",
    fullPage: true,
  });
  await p
    .getByRole("heading", { name: "Nível do mar e correntes", exact: true })
    .waitFor();
  assert.ok((await p.locator(".ocean-metrics").innerText()).includes("26,4"));
  assert.ok((await p.locator(".ocean-extrema").innerText()).includes("-1"));
  assert.ok(
    await p.getByRole("img", { name: /Nível do mar previsto/ }).isVisible(),
  );
  checks++;
  await p.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.screenshot({
    path: "test-results/ocean-mobile-fixture.png",
    fullPage: true,
  });
  checks++;
  if (pagesMode) {
    await p.route(/^https:\/\/marine-api\.open-meteo\.com\//, (r) =>
      new URL(r.request().url()).searchParams.has("models")
        ? r.abort()
        : r.fallback(),
    );
    await p.reload();
    await p.getByText("Previsões atualizadas", { exact: true }).waitFor();
    assert.ok(
      (await p.locator(".ocean-card-note").first().innerText()).includes(
        "indisponível",
      ),
    );
    await p.getByRole("button", { name: "Calendário", exact: true }).click();
    await p.locator(".day-cell").nth(1).click();
    await p
      .getByRole("button", { name: "Guardar janela", exact: true })
      .waitFor();
    assert.ok(
      (await p.locator(".ocean-panel").innerText()).includes(
        "Previsão oceanográfica indisponível",
      ),
    );
    checks++;
  }
  await online.close();
  if (pagesMode)
    assert.deepEqual(
      backendRequests,
      [],
      "Pages must not depend on /api endpoints",
    );
  console.log(
    `${checks} browser flows passed (offline and synthetic forecast fixtures).`,
  );
} finally {
  await browser.close();
}
