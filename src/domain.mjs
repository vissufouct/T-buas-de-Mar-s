import SunCalc from "suncalc";

export const ZONES = [
  {
    id: "costa-sol",
    name: "Costa do Sol",
    region: "Cidade de Maputo",
    type: "Estuário",
    lat: -25.913,
    lon: 32.652,
    description:
      "Ponto de referência na praia da Costa do Sol, na Baía de Maputo. Os modelos oceânicos não representam todos os baixios e canais locais.",
  },
  {
    id: "calanga",
    name: "Calanga",
    region: "Província de Maputo",
    type: "Praia aberta",
    lat: null,
    lon: null,
    description:
      "Zona incluída. Falta confirmar o ponto costeiro de pesca para consultar uma previsão representativa.",
  },
  {
    id: "machubo",
    name: "Machubo",
    region: "Província de Maputo",
    type: "Praia aberta",
    lat: null,
    lon: null,
    description:
      "Zona incluída. Falta confirmar o ponto costeiro de pesca para consultar uma previsão representativa.",
  },
  {
    id: "catembe",
    name: "Catembe",
    region: "Baía de Maputo",
    type: "Estuário",
    lat: -26.015,
    lon: 32.568,
    description:
      "Margem sul da baía. Os modelos de ondas em mar aberto podem não representar as condições dentro da baía.",
  },
  {
    id: "macaneta",
    name: "Macaneta",
    region: "Marracuene",
    type: "Praia aberta",
    lat: -25.792,
    lon: 32.738,
    description:
      "Praia exposta ao Índico, próxima da foz do Incomáti. Observe os canais e as correntes antes de entrar na água.",
  },
  {
    id: "bilene",
    name: "Bilene · costa oceânica",
    region: "Gaza",
    type: "Praia aberta",
    lat: -25.301,
    lon: 33.285,
    description:
      "Ponto de referência na costa oceânica de Bilene. Não representa as condições da lagoa.",
  },
  {
    id: "xai-xai",
    name: "Praia do Xai-Xai",
    region: "Gaza",
    type: "Praia com recife",
    lat: -25.119,
    lon: 33.739,
    description:
      "Costa com recife. As ondas e o acesso variam muito entre o lado protegido e o lado exposto.",
  },
  {
    id: "chidenguele",
    name: "Chidenguele",
    region: "Gaza",
    type: "Praia com recife",
    lat: -24.943,
    lon: 34.193,
    description:
      "Praia com bancos e recifes. Confirme as condições e a possibilidade de regresso com a subida da água.",
  },
  {
    id: "malongane",
    name: "Ponta Malongane",
    region: "Matutuíne",
    type: "Praia aberta",
    lat: -26.79,
    lon: 32.89,
    description:
      "Costa exposta. Confirme as regras de pesca e os limites das áreas de conservação.",
  },
  {
    id: "ponta-ouro",
    name: "Ponta do Ouro",
    region: "Matutuíne",
    type: "Praia aberta",
    lat: -26.842,
    lon: 32.889,
    description:
      "Baía e praia oceânica com exposição variável. Confirme as regras de pesca e as áreas permitidas.",
  },
];
export const TZ = "Africa/Maputo";
export const dateKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const timeLabel = (value) =>
  value == null
    ? "—"
    : new Intl.DateTimeFormat("pt-PT", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
export const dayLabel = (value) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(value));
export function lunar(value) {
  const { phase, fraction } = SunCalc.getMoonIllumination(new Date(value));
  const springDistance = Math.min(phase, Math.abs(phase - 0.5), 1 - phase);
  const neapDistance = Math.min(Math.abs(phase - 0.25), Math.abs(phase - 0.75));
  const tide =
    springDistance < 0.08
      ? "Vivas"
      : neapDistance < 0.08
        ? "Mortas"
        : "Intermédias";
  const names = [
    "Lua nova",
    "Lua crescente",
    "Quarto crescente",
    "Gibosa crescente",
    "Lua cheia",
    "Gibosa minguante",
    "Quarto minguante",
    "Lua minguante",
  ];
  return { phase, fraction, tide, name: names[Math.round(phase * 8) % 8] };
}
export function solar(value, zone) {
  if (!isNumber(zone.lat) || !isNumber(zone.lon))
    return { sunrise: null, sunset: null };
  // Use local midday so the astronomical day is stable across server timezones.
  const d = new Date(`${dateKey(value)}T12:00:00+02:00`);
  const t = SunCalc.getTimes(d, zone.lat, zone.lon);
  return { sunrise: t.sunrise.toISOString(), sunset: t.sunset.toISOString() };
}
export const isNumber = (x) => typeof x === "number" && Number.isFinite(x);
export function evaluate(row, zone, stale = false) {
  if (!isNumber(zone.lat) || !isNumber(zone.lon))
    return {
      state: "unknown",
      label: "Localização por confirmar",
      rank: 0,
      reasons: ["Confirme o ponto costeiro desta zona para obter previsões."],
    };
  if (!row || stale)
    return {
      state: "unknown",
      label: "Dados insuficientes",
      rank: 0,
      reasons: [
        stale
          ? "Previsão desatualizada. Atualize antes de planear."
          : "A aguardar previsões de vento e ondas.",
      ],
    };
  const reasons = [];
  const wind = row.wind,
    wave = row.wave,
    rain = row.rain;
  // Conservative screening only, never a declaration of safety.
  if (
    (isNumber(wind) && wind >= 30) ||
    (isNumber(wave) && wave >= 2.5) ||
    (isNumber(row.gust) && row.gust >= 45) ||
    (isNumber(rain) && rain >= 5)
  ) {
    if (wind >= 30 || row.gust >= 45)
      reasons.push("Vento forte ou rajadas intensas previstas.");
    if (wave >= 2.5) reasons.push("Ondulação elevada prevista em mar aberto.");
    if (rain >= 5) reasons.push("Precipitação intensa prevista.");
    return { state: "caution", label: "Condições adversas", rank: 1, reasons };
  }
  if (![wind, wave, rain, row.period, row.gust].every(isNumber))
    return {
      state: "unknown",
      label: "Dados insuficientes",
      rank: 0,
      reasons: ["Faltam variáveis essenciais de vento, ondas ou chuva."],
    };
  const sun = solar(row.time, zone);
  const at = new Date(row.time).getTime();
  const rise = new Date(sun.sunrise).getTime(),
    set = new Date(sun.sunset).getTime();
  const daylight = at >= rise && at <= set;
  const lightWindow =
    daylight && Math.min(Math.abs(at - rise), Math.abs(at - set)) <= 90 * 60000;
  if (wind <= 18) reasons.push("Vento até 18 km/h.");
  else
    reasons.push(
      "Vento moderado a forte pode dificultar a apresentação da isca.",
    );
  if (wave <= 1.5)
    reasons.push("Ondas previstas até 1,5 m; a exposição local pode variar.");
  else reasons.push("Ondulação acima de 1,5 m exige atenção à exposição.");
  if (rain >= 1)
    reasons.push(
      "Chuva prevista pode reduzir o conforto e a qualidade da janela.",
    );
  if (row.period >= 12)
    reasons.push(
      "Ondulação de período longo pode aumentar o alcance das ondas.",
    );
  if (lightWindow)
    reasons.push("Janela próxima do amanhecer ou do entardecer.");
  if (!daylight)
    reasons.push("Período noturno: fora das janelas sugeridas nesta versão.");
  if (zone.type === "Estuário")
    reasons.push(
      "Modelo marinho de representatividade limitada dentro da baía.",
    );
  const good =
    wind <= 18 &&
    wave <= 1.5 &&
    rain < 1 &&
    row.period < 12 &&
    daylight &&
    zone.type !== "Estuário";
  return {
    state: good ? "good" : "fair",
    label: good ? "Promissoras · parcial" : "Razoáveis · parcial",
    rank: good ? (lightWindow ? 4 : 3) : 2,
    reasons,
  };
}
export function currentRow(data, now = Date.now()) {
  return data?.hours.find((h) => h.time <= now && h.time + 3600000 > now);
}
// Group every eligible future hourly forecast by day and qualitative class.
// Never bridge missing hours, adverse conditions or a change in class.
export function fishingWindows(data, zone, day, now = Date.now()) {
  if (!data || data.stale || !isNumber(zone.lat) || !isNumber(zone.lon))
    return [];
  const windows = [];
  const rows = [...data.hours].sort((a, b) => a.time - b.time);
  const seen = new Set();
  for (const row of rows) {
    if (!isNumber(row.time) || seen.has(row.time)) continue;
    seen.add(row.time);
    if (row.time < now || (day && dateKey(row.time) !== day)) continue;
    const sun = solar(row.time, zone);
    const rise = new Date(sun.sunrise).getTime(),
      sunset = new Date(sun.sunset).getTime();
    if (row.time < rise || row.time >= sunset) continue;
    const evaluation = evaluate(row, zone);
    if (!["good", "fair"].includes(evaluation.state)) continue;
    const end = Math.min(
      row.time + 3600000,
      Math.floor(sunset / 60000) * 60000,
    );
    if (end <= row.time) continue;
    const potential =
      evaluation.rank === 4
        ? "Alto"
        : evaluation.rank === 3
          ? "Bom"
          : "Moderado";
    const previous = windows.at(-1);
    if (
      previous &&
      previous.end === row.time &&
      dateKey(previous.time) === dateKey(row.time) &&
      previous.potential === potential
    ) {
      previous.end = end;
      previous.samples.push(row);
      previous.evaluation.reasons = [
        ...new Set([...previous.evaluation.reasons, ...evaluation.reasons]),
      ];
    } else
      windows.push({
        ...row,
        end,
        potential,
        evaluation: { ...evaluation, reasons: [...evaluation.reasons] },
        samples: [row],
      });
  }
  return windows;
}
export function bestWindow(data, zone, day, now = Date.now()) {
  return (
    fishingWindows(data, zone, day, now).sort(
      (a, b) => b.evaluation.rank - a.evaluation.rank || a.time - b.time,
    )[0] || null
  );
}
export function calendarDays(start, count) {
  const base = new Date(`${dateKey(start)}T12:00:00+02:00`);
  return Array.from(
    { length: count },
    (_, i) => new Date(base.getTime() + i * 86400000),
  );
}
