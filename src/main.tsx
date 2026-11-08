import { oceanExtrema, levelTrend, directionLabel } from "./ocean.mjs";
import { createProvider } from "./provider.mjs";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Waves,
  LayoutDashboard,
  Map,
  CalendarDays,
  Bookmark,
  ArrowUpRight,
  ArrowRight,
  Wind,
  RefreshCw,
  MapPin,
  Star,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Navigation,
  Check,
  CloudRain,
  Clock,
  ExternalLink,
  Search,
  Fish,
  FolderPlus,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ZONES,
  lunar,
  solar,
  evaluate,
  currentRow,
  bestWindow,
  calendarDays,
  dateKey,
  dayLabel,
  timeLabel,
  isNumber,
} from "./domain.mjs";
import "./style.css";
const directForecast = createProvider();
const directMode = import.meta.env.VITE_FORECAST_MODE === "direct";
async function loadForecast(z: {
  id: string;
  lat: number | null;
  lon: number | null;
}) {
  if (directMode) return (await directForecast(z)) as Forecast;
  const params =
    ["calanga", "machubo"].includes(z.id) || z.id.startsWith("pin-")
      ? `?lat=${z.lat}&lon=${z.lon}`
      : "";
  const r = await fetch(
    `/api/forecast/${z.id.startsWith("pin-") ? "custom" : z.id}${params}`,
    { signal: AbortSignal.timeout(20000) },
  );
  if (!r.ok) throw new Error("Fonte indisponível");
  return (await r.json()) as Forecast;
}
type Zone = (typeof ZONES)[number];
type Group = { id: string; name: string; tags: string[] };
type Hour = {
  time: number;
  wind: number | null;
  gust: number | null;
  direction: number | null;
  wave: number | null;
  period: number | null;
  rain: number | null;
  temperature: number | null;
  waveDirection: number | null;
  seaLevel: number | null;
  currentSpeed: number | null;
  currentDirection: number | null;
  seaTemperature: number | null;
};
type Source = {
  id: string;
  label: string;
  url: string;
  kind: string;
  fetchedAt: number | null;
  error: string | null;
  modelPoint: { lat: number; lon: number } | null;
};
type Forecast = {
  zoneId: string;
  hours: Hour[];
  sources: Source[];
  stale: boolean;
  oceanStale: boolean;
  checkedAt: number;
  nextRefreshAt: number;
};
type Trip = { id: string; zone: string; time: number };
type Tab = "dashboard" | "map" | "calendar" | "trips";
const fmt = (v: unknown, digits = 1) =>
  isNumber(v)
    ? (Math.abs(Number(v)) < 0.5 * 10 ** -digits ? 0 : Number(v)).toLocaleString("pt-PT", { maximumFractionDigits: digits })
    : "—";
const titleDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Africa/Maputo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
function useStored<T>(
  key: string,
  fallback: T,
  validate: (x: unknown) => x is T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return validate(v) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [key, value]);
  return [value, setValue, failed] as const;
}
function MoonDisc({ phase, size = 40 }: { phase: number; size?: number }) {
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  return (
    <span
      className="moon-disc"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${phase < 0.5 ? 90 : 270}deg, #4b6565 ${100 - illumination * 100}%, #e4e9d5 ${100 - illumination * 100}%)`,
      }}
      aria-hidden="true"
    />
  );
}
function Status({ evaluation }: { evaluation: ReturnType<typeof evaluate> }) {
  return (
    <span className={`status ${evaluation.state}`}>
      <i />
      {evaluation.label}
    </span>
  );
}
function CoastMap({
  selected,
  onSelect,
  favorites,
  zones,
  onLocate,
  placing,
}: {
  selected: string;
  onSelect: (id: string) => void;
  favorites: string[];
  zones: Zone[];
  placing: boolean;
  onLocate: (lat: number, lon: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const m = L.map(ref.current, { scrollWheelZoom: false }).setView(
      [-25.87, 33.2],
      7,
    );
    map.current = m;
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 16,
      },
    ).addTo(m);
    tiles.on("tileerror", () => setUnavailable(true));
    zones
      .filter((z) => isNumber(z.lat) && isNumber(z.lon))
      .forEach((z) => {
        const marker = L.circleMarker([z.lat!, z.lon!], {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: z.id === selected ? "#edb875" : "#1c6460",
          fillOpacity: 1,
        }).addTo(m);
        const tooltip = document.createElement("span");
        tooltip.textContent = z.name;
        marker.bindTooltip(tooltip, { direction: "top" });
        marker.on("click", () => onSelect(z.id));
      });
    if (placing || !isNumber(zones.find((z) => z.id === selected)?.lat))
      m.on("click", (e) =>
        onLocate(
          Number(e.latlng.lat.toFixed(4)),
          Number(e.latlng.lng.toFixed(4)),
        ),
      );
    return () => {
      m.remove();
      map.current = null;
    };
  }, [selected, onSelect, zones, onLocate, placing]);
  return (
    <div className="map-wrap">
      <div
        ref={ref}
        className="leaflet-map"
        role="region"
        aria-label="Mapa dos pesqueiros no sul de Moçambique"
      />
      {unavailable && (
        <div className="map-notice">
          Mapa base indisponível. Escolha uma zona na lista; os favoritos
          continuam a funcionar.
        </div>
      )}
      <div className="map-caption">
        <MapPin size={14} /> {zones.length} zonas · {favorites.length} favoritas
      </div>
    </div>
  );
}
function SparkChart({
  hours,
  field,
  label,
  unit,
}: {
  hours: Hour[];
  field: "wave" | "wind" | "seaLevel";
  label: string;
  unit: string;
}) {
  const max = Math.max(
    field === "wind" ? 10 : 1,
    ...hours.map((h) => h[field] ?? 0),
  );
  const min =
    field === "seaLevel"
      ? Math.min(0, ...hours.map((h) => h.seaLevel ?? 0))
      : 0;
  const valid = hours.some((h) => isNumber(h[field]));
  const duration = Math.max(
    1,
    (hours.at(-1)?.time ?? 0) - (hours[0]?.time ?? 0),
  );
  const points = hours.map((h, i) => ({
    x: 35 + ((h.time - hours[0].time) / duration) * 525,
    y: 75 - (((h[field] ?? 0) - min) / (max - min)) * 60,
    valid: isNumber(h[field]),
  }));
  const path = points
    .map((p, i) =>
      p.valid
        ? `${i === 0 || !points[i - 1].valid || hours[i].time - hours[i - 1].time !== 3600000 ? "M" : "L"}${p.x},${p.y}`
        : "",
    )
    .join(" ");
  return (
    <div className="spark-chart">
      <div className="chart-heading">
        <span>{label}</span>
        <small>{unit} · previsão</small>
      </div>
      {valid ? (
        <svg
          viewBox="0 0 580 110"
          role="img"
          aria-label={`${label} nas próximas horas; valores disponíveis na tabela abaixo`}
        >
          <text x="0" y="18">
            {fmt(max)}
          </text>
          <text x="12" y="79">
            {fmt(min)}
          </text>
          <path d="M35 15H560 M35 75H560" stroke="#e3e9e6" fill="none" />
          <path
            d={path}
            stroke={field === "wind" ? "#b7864c" : "#1c6460"}
            strokeWidth="2.5"
            fill="none"
          />
          {hours
            .filter((_, i) => i % 6 === 0)
            .map((h) => (
              <text
                key={h.time}
                x={35 + ((h.time - hours[0].time) / duration) * 525}
                y="102"
                textAnchor="middle"
              >
                {timeLabel(h.time)}
              </text>
            ))}
        </svg>
      ) : (
        <div className="chart-empty">
          Sem previsão de {label.toLowerCase()} disponível.
        </div>
      )}
    </div>
  );
}
function App() {
  const [locations, setLocations, locationError] = useStored<
    Record<string, { lat: number; lon: number }>
  >(
    "mares:locations:v1",
    {},
    (v): v is Record<string, { lat: number; lon: number }> =>
      !!v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.entries(v).every(
        ([id, p]: [string, any]) =>
          ["calanga", "machubo"].includes(id) &&
          typeof p?.lat === "number" &&
          p.lat >= -27 &&
          p.lat <= -23 &&
          typeof p?.lon === "number" &&
          p.lon >= 32 &&
          p.lon <= 36,
      ),
  );
  const [pins, setPins, pinError] = useStored<Zone[]>(
    "mares:pins:v1",
    [],
    (v): v is Zone[] =>
      Array.isArray(v) &&
      v.length <= 50 &&
      v.every(
        (p) =>
          p &&
          typeof p.id === "string" &&
          p.id.startsWith("pin-") &&
          typeof p.name === "string" &&
          p.name.length <= 80 &&
          typeof p.region === "string" &&
          typeof p.type === "string" &&
          typeof p.description === "string" &&
          typeof p.lat === "number" &&
          p.lat >= -27 &&
          p.lat <= -23 &&
          typeof p.lon === "number" &&
          p.lon >= 32 &&
          p.lon <= 36,
      ),
  );
  const [groups, setGroups, groupError] = useStored<Group[]>(
    "mares:groups:v1",
    [],
    (v): v is Group[] =>
      Array.isArray(v) &&
      v.length <= 30 &&
      v.every(
        (g) =>
          g &&
          typeof g.id === "string" &&
          typeof g.name === "string" &&
          g.name.length <= 60 &&
          Array.isArray(g.tags) &&
          g.tags.length <= 10 &&
          g.tags.every((t: unknown) => typeof t === "string" && t.length <= 30),
      ),
  );
  const [assignments, setAssignments, assignmentError] = useStored<
    Record<string, string[]>
  >(
    "mares:assignments:v1",
    {},
    (v): v is Record<string, string[]> =>
      !!v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.values(v).every(
        (ids) =>
          Array.isArray(ids) && ids.every((id) => typeof id === "string"),
      ),
  );
  const [groupFilter, setGroupFilter] = useState("all"),
    [tagFilter, setTagFilter] = useState("all"),
    [groupEditor, setGroupEditor] = useState(false),
    [editingGroup, setEditingGroup] = useState<string | null>(null),
    [groupName, setGroupName] = useState(""),
    [groupTags, setGroupTags] = useState("");
  const [addingPin, setAddingPin] = useState(false),
    [pinName, setPinName] = useState(""),
    [pinType, setPinType] = useState("Praia aberta"),
    [pinGroup, setPinGroup] = useState("");
  const zones = React.useMemo(
    () => [
      ...ZONES.map((z) => (locations[z.id] ? { ...z, ...locations[z.id] } : z)),
      ...pins,
    ],
    [locations, pins],
  );
  const [locationDraft, setLocationDraft] = useState({ lat: "", lon: "" });
  const locate = React.useCallback(
    (lat: number, lon: number) =>
      setLocationDraft({ lat: String(lat), lon: String(lon) }),
    [],
  );
  const [tab, setTab] = useState<Tab>("dashboard");
  const [favorites, setFavorites, storageError] = useStored<string[]>(
    "mares:favorites:v1",
    ["costa-sol", "calanga", "machubo", "macaneta", "bilene", "ponta-ouro"],
    (v): v is string[] =>
      Array.isArray(v) && v.every((id) => zones.some((z) => z.id === id)),
  );
  const [trips, setTrips, tripsError] = useStored<Trip[]>(
    "mares:trips:v1",
    [],
    (v): v is Trip[] =>
      Array.isArray(v) &&
      v.every(
        (t) =>
          t &&
          typeof t.id === "string" &&
          zones.some((z) => z.id === t.zone) &&
          Number.isFinite(t.time),
      ),
  );
  const [selected, setSelected] = useState("macaneta"),
    [detail, setDetail] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, Forecast>>({}),
    [loading, setLoading] = useState(true),
    [fetchError, setFetchError] = useState(false);
  const [now, setNow] = useState(Date.now()),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("opportunity"),
    [sources, setSources] = useState(false),
    [toast, setToast] = useState("");
  const [calendarOffset, setCalendarOffset] = useState(0),
    [selectedDay, setSelectedDay] = useState(dateKey(now));
  const refreshing = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    setLocationDraft({ lat: "", lon: "" });
  }, [selected]);
  const zone = zones.find((z) => z.id === selected)!;
  const liveData = (id: string) =>
    data[id]
      ? {
          ...data[id],
          oceanStale:
            data[id].oceanStale ||
            !data[id].sources.some(
              (s) =>
                s.id === "ocean" &&
                !s.error &&
                s.fetchedAt !== null &&
                now - s.fetchedAt <= 90 * 60000,
            ),
          stale:
            data[id].stale ||
            data[id].sources
              .filter((s) => s.id !== "ocean")
              .some((s) => !s.fetchedAt || now - s.fetchedAt > 90 * 60000),
        }
      : undefined;
  async function refresh() {
    const generation = ++refreshing.current;
    setLoading(true);
    setFetchError(false);
    try {
      const results = await Promise.allSettled(
        zones
          .filter((z) => isNumber(z.lat) && isNumber(z.lon))
          .map(async (z) => {
            const forecast = await loadForecast(z);
            if (
              !Array.isArray(forecast.hours) ||
              !Array.isArray(forecast.sources)
            )
              throw new Error("Resposta inválida");
            if (mounted.current && generation === refreshing.current)
              setData((old) => ({ ...old, [z.id]: forecast }));
          }),
      );
      if (mounted.current && generation === refreshing.current)
        setFetchError(results.some((r) => r.status === "rejected"));
    } finally {
      if (mounted.current && generation === refreshing.current) {
        setLoading(false);
        setNow(Date.now());
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    refresh();
    const timer = setInterval(() => refresh(), 15 * 60 * 1000),
      clock = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [locations, pins]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetail(null);
        setSources(false);
        setGroupEditor(false);
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);
  const toggle = (id: string) =>
    setFavorites((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
  const saveTrip = (id: string, time: number) => {
    const key = `${id}:${time}`;
    setTrips((t) =>
      t.some((x) => x.id === key) ? t : [...t, { id: key, zone: id, time }],
    );
    setToast("Saída guardada neste dispositivo.");
  };
  const moon = lunar(now),
    sun = solar(now, zone),
    days = calendarDays(now, 30).slice(calendarOffset, calendarOffset + 14);
  const visibleZone = (z: Zone) =>
    (groupFilter === "all" ||
      (assignments[z.id] || []).includes(groupFilter)) &&
    (tagFilter === "all" ||
      groups.some(
        (g) =>
          (assignments[z.id] || []).includes(g.id) &&
          g.tags.includes(tagFilter),
      ));
  const mapZones = React.useMemo(
    () => zones.filter(visibleZone),
    [zones, assignments, groups, groupFilter, tagFilter],
  );
  const favoriteZones = zones.filter(
    (z) => favorites.includes(z.id) && visibleZone(z),
  );
  const filtered = zones
    .filter(visibleZone)
    .filter((z) =>
      `${z.name} ${z.region}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    );
  const sorted = [...favoriteZones].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : evaluate(currentRow(liveData(b.id), now), b, liveData(b.id)?.stale)
          .rank -
        evaluate(currentRow(liveData(a.id), now), a, liveData(a.id)?.stale)
          .rank,
  );
  const forecastCount = favoriteZones.filter((z) => {
    const d = liveData(z.id);
    return d && !d.stale && evaluate(currentRow(d, now), z).state !== "unknown";
  }).length;
  const windows = favoriteZones
    .map((z) => ({
      zone: z,
      window: bestWindow(liveData(z.id), z, undefined, now),
    }))
    .filter((x) => x.window)
    .sort(
      (a, b) =>
        b.window!.evaluation.rank - a.window!.evaluation.rank ||
        a.window!.time - b.window!.time,
    );
  const best = windows[0];
  const hasLive = Object.values(data).some((d) => d.hours.length && !d.stale);
  const dayHours =
    liveData(selected)?.hours.filter((h) => dateKey(h.time) === selectedDay) ||
    [];
  const dateBest = bestWindow(liveData(selected), zone, selectedDay, now);
  const tabs = [
    { id: "dashboard" as Tab, label: "Minhas zonas", icon: LayoutDashboard },
    { id: "map" as Tab, label: "Explorar costa", icon: Map },
    { id: "calendar" as Tab, label: "Calendário", icon: CalendarDays },
    { id: "trips" as Tab, label: "Saídas guardadas", icon: Bookmark },
  ];
  const title = {
    dashboard: "O mar, antes de sair.",
    map: "Encontre o seu próximo pesqueiro.",
    calendar: "Escolha o dia. Conheça as condições.",
    trips: "As suas próximas saídas.",
  }[tab];
  function ZoneCard({ z }: { z: Zone }) {
    const d = liveData(z.id),
      hour = currentRow(d, now),
      ev = evaluate(hour, z, d?.stale),
      win = bestWindow(d, z, undefined, now);
    return (
      <article className="zone-card">
        <div className={`coast-art art-${z.id}`}>
          <div className="coast-lines" />
          <span className="place-type">
            <MapPin size={12} />
            {z.type}
          </span>
          <button
            className={`star-button ${favorites.includes(z.id) ? "active" : ""}`}
            aria-label={`${favorites.includes(z.id) ? "Remover" : "Adicionar"} ${z.name} ${favorites.includes(z.id) ? "dos" : "aos"} favoritos`}
            onClick={() => toggle(z.id)}
          >
            <Star
              size={17}
              fill={favorites.includes(z.id) ? "currentColor" : "none"}
            />
          </button>
          <div className="art-caption">
            {z.region}
            <h3>{z.name}</h3>
          </div>
        </div>
        <div className="zone-body">
          <Status evaluation={ev} />
          <div className="conditions">
            <div>
              <Wind size={16} />
              <b>
                {fmt(hour?.wind, 0)} <small>km/h</small>
              </b>
              <span>Vento previsto</span>
            </div>
            <div>
              <Waves size={16} />
              <b>
                {fmt(hour?.wave)} <small>m</small>
              </b>
              <span>Ondas previstas</span>
            </div>
            <div>
              <Moon size={16} />
              <b>{moon.tide}</b>
              <span>Ciclo estimado</span>
            </div>
          </div>
          <div
            className="ocean-card-values"
            aria-label="Previsão oceanográfica"
          >
            <div>
              <span>Nível do mar · MSL</span>
              <strong>
                {fmt(d?.oceanStale ? null : hour?.seaLevel)} <small>m</small>
              </strong>
            </div>
            <div>
              <span>Água</span>
              <strong>
                {fmt(d?.oceanStale ? null : hour?.seaTemperature)}{" "}
                <small>°C</small>
              </strong>
            </div>
            <div>
              <span>Corrente</span>
              <strong>
                {fmt(d?.oceanStale ? null : hour?.currentSpeed)}{" "}
                <small>km/h</small>
              </strong>
            </div>
          </div>
          <p className="ocean-card-note">
            {d?.oceanStale
              ? "Modelo oceânico indisponível ou desatualizado"
              : levelTrend(d?.hours || [], now) ||
                "Nível do mar modelado · referência global"}
          </p>
          <div className="window">
            <Clock size={16} />
            <div>
              <span>Próxima janela sugerida</span>
              <strong>
                {win
                  ? `${dayLabel(win.time)} · ${timeLabel(win.time)}–${timeLabel(win.time + 3600000)}`
                  : "A aguardar condições suficientes"}
              </strong>
            </div>
          </div>
          <button
            className="text-button card-link"
            onClick={() => setDetail(z.id)}
          >
            Ver condições e motivos <ArrowUpRight size={17} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("dashboard");
          }}
        >
          <span className="brand-icon">
            <Waves size={27} />
          </span>
          <span>
            marés<span className="brand-dot">.</span>
            <small>MOÇAMBIQUE</small>
          </span>
        </a>
        <div className="sidebar-label">O SEU PLANO DE PESCA</div>
        <nav>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "nav-active" : ""}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={19} />
              <span>{t.label}</span>
              {t.id === "dashboard" && <b>{favorites.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="region-note">
            <Navigation size={18} />
            <div>
              Costa sul<small>Maputo · Gaza</small>
            </div>
          </div>
          <button className="source-button" onClick={() => setSources(true)}>
            <Info size={17} /> Fontes e metodologia <ArrowUpRight size={15} />
          </button>
          <p>
            Feito para olhar o mar
            <br />
            com mais informação.
          </p>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            <span className="breadcrumb">Pesca de costa</span>
            <span className="slash">/</span>
            {tabs.find((t) => t.id === tab)?.label}
          </span>
          <div className="top-actions">
            <span className={`connection ${hasLive ? "connected" : ""}`}>
              <i />
              {loading
                ? "A atualizar…"
                : hasLive
                  ? "Previsões atualizadas"
                  : "Sem ligação às previsões"}
            </span>
            <button
              className="icon-button"
              aria-label="Atualizar previsões"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? "spinning" : ""} />
            </button>
            <span className="avatar" aria-hidden="true">
              <Fish size={19} />
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {titleDate(new Date(now))} <span>· CAT / UTC+2</span>
              </div>
              <h1>{title}</h1>
              <p>
                {tab === "dashboard"
                  ? "Os seus lugares favoritos, as condições e a próxima oportunidade."
                  : tab === "map"
                    ? "Explore as zonas do sul de Moçambique e guarde as suas favoritas."
                    : tab === "calendar"
                      ? "Planeie com previsões de 7 dias e um calendário lunar de 30 dias."
                      : "Planos guardados apenas neste navegador, sem conta nem subscrição."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => setTab(tab === "map" ? "dashboard" : "map")}
            >
              <MapPin size={17} />
              {tab === "map" ? "Ver favoritas" : "Escolher zonas"}
              <ArrowUpRight size={16} />
            </button>
          </div>
          {(storageError ||
            tripsError ||
            locationError ||
            pinError ||
            groupError ||
            assignmentError) && (
            <div className="notice">
              O navegador não permite guardar dados. As alterações duram apenas
              nesta sessão.
            </div>
          )}
          {!loading && (!hasLive || fetchError) && (
            <div className="notice" role="status">
              <Info size={18} />
              <span>
                Não foi possível obter todas as previsões. O calendário lunar
                continua disponível. Não mostramos condições inventadas.
              </span>
              <button onClick={refresh}>Tentar novamente</button>
            </div>
          )}
          {(tab === "dashboard" || tab === "map") && (
            <div className="groups-toolbar">
              <div className="group-filters">
                <label>
                  <Bookmark size={15} />
                  Grupo
                  <select
                    aria-label="Filtrar por grupo"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                  >
                    <option value="all">Todos os grupos</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <Tag size={15} />
                  Tag
                  <select
                    aria-label="Filtrar por tag"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                  >
                    <option value="all">Todas as tags</option>
                    {[...new Set(groups.flatMap((g) => g.tags))]
                      .sort()
                      .map((t) => (
                        <option key={t} value={t}>
                          #{t}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="group-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setEditingGroup(null);
                    setGroupName("");
                    setGroupTags("");
                    setGroupEditor(true);
                  }}
                >
                  <FolderPlus size={15} />
                  Criar grupo
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setTab("map");
                    setAddingPin(true);
                    setPinGroup(groupFilter === "all" ? "" : groupFilter);
                    setLocationDraft({ lat: "", lon: "" });
                  }}
                >
                  <Plus size={15} />
                  Adicionar pino
                </button>
              </div>
            </div>
          )}
          {tab === "map" && groups.length > 0 && (
            <div className="group-chips">
              {groups.map((g) => (
                <div className="group-chip" key={g.id}>
                  <button
                    onClick={() =>
                      setGroupFilter(groupFilter === g.id ? "all" : g.id)
                    }
                  >
                    <Bookmark size={13} />
                    {g.name}
                    <small>
                      {
                        zones.filter((z) =>
                          (assignments[z.id] || []).includes(g.id),
                        ).length
                      }{" "}
                      pontos · {g.tags.map((t) => "#" + t).join(" ")}
                    </small>
                  </button>
                  <button
                    aria-label={`Editar grupo ${g.name}`}
                    onClick={() => {
                      setEditingGroup(g.id);
                      setGroupName(g.name);
                      setGroupTags(g.tags.join(", "));
                      setGroupEditor(true);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    aria-label={`Eliminar grupo ${g.name}`}
                    onClick={() => {
                      setGroups((gs) => gs.filter((x) => x.id !== g.id));
                      setAssignments((a) =>
                        Object.fromEntries(
                          Object.entries(a).map(([id, gs]) => [
                            id,
                            gs.filter((x) => x !== g.id),
                          ]),
                        ),
                      );
                      setGroupFilter("all");
                      setTagFilter("all");
                      setToast("Grupo eliminado. Os pinos foram mantidos.");
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {tab === "dashboard" && (
            <>
              <section className="overview">
                <div className="opportunity-panel">
                  <div className="panel-eyebrow">
                    <span className="small-dot" />
                    PLANEIE A PRÓXIMA SAÍDA
                  </div>
                  <h2>
                    {best
                      ? best.zone.name
                      : "Uma boa saída começa com boas condições."}
                  </h2>
                  <p>
                    {best
                      ? `${dayLabel(best.window!.time)} · ${timeLabel(best.window!.time)}. ${best.window!.evaluation.reasons[0]}`
                      : "Compare vento, ondas e luz nas suas zonas. As janelas aparecem quando temos previsões suficientes."}
                  </p>
                  <button
                    onClick={() =>
                      best ? setDetail(best.zone.id) : setTab("calendar")
                    }
                  >
                    {best ? "Explorar esta janela" : "Explorar o calendário"}{" "}
                    <ArrowRight size={17} />
                  </button>
                  <div className="hero-wave" aria-hidden="true">
                    ≋
                  </div>
                  <div className="opportunity-foot">
                    Avaliação parcial · marés sem validação local
                  </div>
                </div>
                <div className="moon-panel">
                  <div className="panel-eyebrow">O CICLO DO MAR</div>
                  <div className="moon-row">
                    <MoonDisc phase={moon.phase} size={64} />
                    <div>
                      <h2>Marés {moon.tide.toLowerCase()}</h2>
                      <p>
                        {moon.name} · {Math.round(moon.fraction * 100)}%
                        iluminada
                      </p>
                    </div>
                  </div>
                  <div className="lunar-scale">
                    <span className={moon.tide === "Vivas" ? "chosen" : ""}>
                      Vivas
                    </span>
                    <span
                      className={moon.tide === "Intermédias" ? "chosen" : ""}
                    >
                      Intermédias
                    </span>
                    <span className={moon.tide === "Mortas" ? "chosen" : ""}>
                      Mortas
                    </span>
                  </div>
                  <p className="fine-print">
                    Estimativa astronómica. A amplitude e os horários reais
                    dependem do local.
                  </p>
                </div>
              </section>
              <section className="summary-strip">
                <div>
                  <MapPin size={19} />
                  <span>
                    <b>{favoriteZones.length}</b> zonas neste filtro
                  </span>
                </div>
                <div>
                  <Wind size={19} />
                  <span>
                    <b>
                      {forecastCount}/{favoriteZones.length}
                    </b>{" "}
                    com previsão suficiente
                  </span>
                </div>
                <div>
                  <Sun size={19} />
                  <span>
                    Nascer do sol <b>{timeLabel(sun.sunrise)}</b>
                    <small> · {zone.name}</small>
                  </span>
                </div>
              </section>
              <div className="section-heading">
                <div>
                  <h2>
                    As suas zonas{" "}
                    <span>
                      {favoriteZones.length.toString().padStart(2, "0")}
                    </span>
                  </h2>
                  <p>
                    Condições previstas para a hora atual, em cada pesqueiro.
                  </p>
                </div>
                <label className="sort">
                  Ordenar por{" "}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="opportunity">Oportunidade</option>
                    <option value="name">Nome da zona</option>
                  </select>
                </label>
              </div>
              <section className="zone-grid">
                {sorted.map((z) => (
                  <ZoneCard z={z} key={z.id} />
                ))}
              </section>
              {!favoriteZones.length && (
                <div className="empty">
                  <Star />
                  <h2>A sua costa começa aqui.</h2>
                  <p>Adicione uma zona para acompanhar as condições.</p>
                  <button className="primary" onClick={() => setTab("map")}>
                    Explorar zonas
                  </button>
                </div>
              )}
              <div className="bottom-note">
                <Info size={16} />
                <p>
                  Uma oportunidade é uma avaliação das condições, não uma
                  previsão de capturas. Confirme o estado do mar e as regras
                  locais antes de sair.
                </p>
                <button onClick={() => setSources(true)}>
                  Como avaliamos <ArrowUpRight size={15} />
                </button>
              </div>
            </>
          )}
          {tab === "map" && (
            <section className="explore-layout">
              <div className="zone-picker">
                {addingPin && (
                  <form
                    className="location-form new-pin"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (pins.length >= 50) {
                        setToast("Limite de 50 pinos neste dispositivo.");
                        return;
                      }
                      const lat = Number(locationDraft.lat),
                        lon = Number(locationDraft.lon);
                      if (
                        !pinName.trim() ||
                        !locationDraft.lat ||
                        !locationDraft.lon ||
                        !Number.isFinite(lat) ||
                        !Number.isFinite(lon) ||
                        lat < -27 ||
                        lat > -23 ||
                        lon < 32 ||
                        lon > 36
                      ) {
                        setToast("Defina um nome e um ponto na costa sul.");
                        return;
                      }
                      const id = "pin-" + crypto.randomUUID();
                      setPins((ps) => [
                        ...ps,
                        {
                          id,
                          name: pinName.trim(),
                          lat,
                          lon,
                          type: pinType,
                          region: "Pino pessoal",
                          description:
                            "Ponto definido por si. A previsão representa a célula do modelo mais próxima; confirme as condições no local.",
                        },
                      ]);
                      setFavorites((fs) => [...fs, id]);
                      if (pinGroup)
                        setAssignments((a) => ({ ...a, [id]: [pinGroup] }));
                      setSelected(id);
                      setAddingPin(false);
                      setPinName("");
                      setLocationDraft({ lat: "", lon: "" });
                      setToast("Pino criado e adicionado aos favoritos.");
                    }}
                  >
                    <div className="form-heading">
                      <h3>Novo pino</h3>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Cancelar novo pino"
                        onClick={() => setAddingPin(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p>
                      Toque no mapa para preencher as coordenadas ou
                      introduza-as abaixo.
                    </p>
                    <label>
                      Nome do pino
                      <input
                        required
                        maxLength={80}
                        value={pinName}
                        onChange={(e) => setPinName(e.target.value)}
                      />
                    </label>
                    <label>
                      Latitude do novo pino
                      <input
                        required
                        type="number"
                        step="any"
                        min="-27"
                        max="-23"
                        value={locationDraft.lat}
                        onChange={(e) =>
                          setLocationDraft({
                            ...locationDraft,
                            lat: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Longitude do novo pino
                      <input
                        required
                        type="number"
                        step="any"
                        min="32"
                        max="36"
                        value={locationDraft.lon}
                        onChange={(e) =>
                          setLocationDraft({
                            ...locationDraft,
                            lon: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Tipo de pesqueiro
                      <select
                        value={pinType}
                        onChange={(e) => setPinType(e.target.value)}
                      >
                        <option>Praia aberta</option>
                        <option>Praia com recife</option>
                        <option>Estuário</option>
                      </select>
                    </label>
                    <label>
                      Grupo do novo pino
                      <select
                        value={pinGroup}
                        onChange={(e) => setPinGroup(e.target.value)}
                      >
                        <option value="">Sem grupo</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="primary" type="submit">
                      <MapPin size={16} />
                      Guardar pino
                    </button>
                  </form>
                )}
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Pesquisar praia ou região"
                    aria-label="Pesquisar zonas"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="picker-list">
                  {filtered.map((z) => (
                    <div
                      className={`picker-row ${z.id === selected ? "selected" : ""}`}
                      key={z.id}
                    >
                      <button
                        className="picker-select"
                        onClick={() => setSelected(z.id)}
                      >
                        <span className="map-pin">
                          <MapPin size={18} />
                        </span>
                        <span>
                          <strong>{z.name}</strong>
                          <small>
                            {z.region} ·{" "}
                            {isNumber(z.lat)
                              ? z.type
                              : "Localização por confirmar"}
                          </small>
                        </span>
                      </button>
                      <button
                        className={`icon-button ${favorites.includes(z.id) ? "favorite" : ""}`}
                        aria-label={`${favorites.includes(z.id) ? "Remover" : "Adicionar"} ${z.name} ${favorites.includes(z.id) ? "dos" : "aos"} favoritos`}
                        onClick={() => toggle(z.id)}
                      >
                        <Star
                          size={18}
                          fill={
                            favorites.includes(z.id) ? "currentColor" : "none"
                          }
                        />
                      </button>
                    </div>
                  ))}
                  {!filtered.length && (
                    <p className="empty">
                      Nenhuma zona corresponde à pesquisa.
                    </p>
                  )}
                </div>
                <div className="selected-place">
                  <h3>{zone.name}</h3>
                  <p>{zone.description}</p>
                  {["calanga", "machubo"].includes(zone.id) && (
                    <form
                      className="location-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const lat = Number(locationDraft.lat),
                          lon = Number(locationDraft.lon);
                        if (
                          !locationDraft.lat ||
                          !locationDraft.lon ||
                          !Number.isFinite(lat) ||
                          !Number.isFinite(lon) ||
                          lat < -27 ||
                          lat > -23 ||
                          lon < 32 ||
                          lon > 36
                        ) {
                          setToast(
                            "Escolha um ponto na costa sul: latitude −27 a −23, longitude 32 a 36.",
                          );
                          return;
                        }
                        setLocations((old) => ({
                          ...old,
                          [zone.id]: { lat, lon },
                        }));
                        setData((old) => {
                          const next = { ...old };
                          delete next[zone.id];
                          return next;
                        });
                        setToast(
                          "Ponto guardado. A obter previsões para esta localização.",
                        );
                      }}
                    >
                      <p>
                        {isNumber(zone.lat)
                          ? "Ponto definido por si. Pode ajustar as coordenadas."
                          : "Toque no mapa para escolher o ponto de pesca, ou introduza coordenadas."}
                      </p>
                      <label>
                        Latitude
                        <input
                          aria-label="Latitude do pesqueiro"
                          type="number"
                          step="any"
                          min="-27"
                          max="-23"
                          required
                          value={locationDraft.lat}
                          onChange={(e) =>
                            setLocationDraft({
                              ...locationDraft,
                              lat: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Longitude
                        <input
                          aria-label="Longitude do pesqueiro"
                          type="number"
                          step="any"
                          min="32"
                          max="36"
                          required
                          value={locationDraft.lon}
                          onChange={(e) =>
                            setLocationDraft({
                              ...locationDraft,
                              lon: e.target.value,
                            })
                          }
                        />
                      </label>
                      <button className="secondary" type="submit">
                        Guardar ponto
                      </button>
                    </form>
                  )}
                  {groups.length > 0 && (
                    <fieldset className="group-assign">
                      <legend>Grupos deste ponto</legend>
                      {groups.map((g) => (
                        <label key={g.id}>
                          <input
                            type="checkbox"
                            checked={(assignments[zone.id] || []).includes(
                              g.id,
                            )}
                            onChange={(e) =>
                              setAssignments((a) => ({
                                ...a,
                                [zone.id]: e.target.checked
                                  ? [...new Set([...(a[zone.id] || []), g.id])]
                                  : (a[zone.id] || []).filter(
                                      (id) => id !== g.id,
                                    ),
                              }))
                            }
                          />
                          <span>
                            {g.name}
                            <small>
                              {g.tags.map((t) => "#" + t).join(" ")}
                            </small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {zone.id.startsWith("pin-") && (
                    <button
                      className="delete-pin"
                      onClick={() => {
                        const removed = zone;
                        setPins((ps) => ps.filter((p) => p.id !== removed.id));
                        setFavorites((fs) =>
                          fs.filter((id) => id !== removed.id),
                        );
                        setTrips((ts) =>
                          ts.filter((t) => t.zone !== removed.id),
                        );
                        setAssignments((a) => {
                          const next = { ...a };
                          delete next[removed.id];
                          return next;
                        });
                        setSelected("macaneta");
                        setToast(
                          "Pino eliminado, incluindo as saídas associadas.",
                        );
                      }}
                    >
                      <Trash2 size={14} />
                      Eliminar pino e saídas associadas
                    </button>
                  )}
                  <small>
                    {isNumber(zone.lat)
                      ? `${zone.lat!.toFixed(3)}°, ${zone.lon!.toFixed(3)}° · ponto de referência`
                      : "Coordenadas pendentes · previsões suspensas"}
                  </small>
                  <button
                    className="primary"
                    onClick={() => setDetail(zone.id)}
                  >
                    Ver condições <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
              <CoastMap
                selected={selected}
                onSelect={setSelected}
                favorites={favorites}
                zones={mapZones}
                onLocate={locate}
                placing={addingPin}
              />
            </section>
          )}
          {tab === "calendar" && (
            <>
              <div className="calendar-controls">
                <label>
                  Zona de pesca{" "}
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <button
                    className="icon-button"
                    disabled={!calendarOffset}
                    aria-label="Dias anteriores"
                    onClick={() =>
                      setCalendarOffset(Math.max(0, calendarOffset - 14))
                    }
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span>
                    {dayLabel(days[0])} — {dayLabel(days[days.length - 1])}
                  </span>
                  <button
                    className="icon-button"
                    disabled={calendarOffset >= 28}
                    aria-label="Dias seguintes"
                    onClick={() =>
                      setCalendarOffset(Math.min(28, calendarOffset + 14))
                    }
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              <div className="calendar-grid">
                {days.map((d) => {
                  const m = lunar(d),
                    key = dateKey(d),
                    win = bestWindow(liveData(selected), zone, key, now);
                  return (
                    <button
                      key={key}
                      className={`day-cell ${selectedDay === key ? "selected" : ""}`}
                      onClick={() => setSelectedDay(key)}
                    >
                      <span className="weekday">
                        {new Intl.DateTimeFormat("pt-PT", {
                          weekday: "short",
                          timeZone: "Africa/Maputo",
                        }).format(d)}
                      </span>
                      <strong>
                        {new Intl.DateTimeFormat("pt-PT", {
                          day: "numeric",
                          timeZone: "Africa/Maputo",
                        }).format(d)}
                      </strong>
                      <MoonDisc phase={m.phase} size={27} />
                      <span>{m.tide}</span>
                      <small className={win ? "has-window" : ""}>
                        {win ? "Janela sugerida" : "Ciclo lunar"}
                      </small>
                    </button>
                  );
                })}
              </div>
              <p className="calendar-disclaimer">
                <Info size={15} /> Vivas e mortas são estimativas pelo ciclo
                lunar. A previsão meteorológica termina onde terminam os dados;
                não extrapolamos o tempo para 30 dias.
              </p>
              <section className="day-detail">
                <div className="section-heading">
                  <div>
                    <h2>
                      {zone.name} · {dayLabel(`${selectedDay}T12:00:00+02:00`)}
                    </h2>
                    <p>
                      {lunar(`${selectedDay}T12:00:00+02:00`).name} · horários
                      em Moçambique
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      saveTrip(
                        selected,
                        dateBest?.time ??
                          new Date(`${selectedDay}T06:00:00+02:00`).getTime(),
                      )
                    }
                  >
                    <Bookmark size={16} />
                    Guardar {dateBest ? "janela" : "dia às 06:00"}
                  </button>
                </div>
                {dateBest ? (
                  <div className="recommendation">
                    <Check size={19} />
                    <div>
                      <strong>
                        Janela sugerida: {timeLabel(dateBest.time)}–
                        {timeLabel(dateBest.time + 3600000)}
                      </strong>
                      <p>
                        {dateBest.evaluation.reasons.join(" ")} Confiança
                        limitada: marés sem validação local.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="notice">
                    Sem janela recomendada com os dados disponíveis para este
                    dia. Pode guardar a data para voltar a verificar as
                    condições.
                  </div>
                )}
                <OceanPanel
                  hours={dayHours}
                  stale={liveData(selected)?.oceanStale ?? true}
                  now={now}
                  source={liveData(selected)?.sources.find(
                    (s) => s.id === "ocean",
                  )}
                />
                <ForecastView
                  hours={dayHours}
                  stale={liveData(selected)?.stale ?? true}
                />
              </section>
            </>
          )}
          {tab === "trips" && (
            <section className="trips">
              {trips.length === 0 ? (
                <div className="empty">
                  <Bookmark size={35} />
                  <h2>A próxima saída ainda está por escolher.</h2>
                  <p>Guarde um dia no calendário para o encontrar aqui.</p>
                  <button
                    className="primary"
                    onClick={() => setTab("calendar")}
                  >
                    Abrir calendário <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                [...trips]
                  .sort((a, b) => a.time - b.time)
                  .map((t) => {
                    const z = zones.find((x) => x.id === t.zone)!,
                      d = liveData(t.zone),
                      h = d?.hours.find((x) => x.time === t.time),
                      past = t.time < now;
                    return (
                      <article className="trip" key={t.id}>
                        <div className="trip-date">
                          <CalendarDays />
                          <strong>{dayLabel(t.time)}</strong>
                          <span>{timeLabel(t.time)}</span>
                        </div>
                        <div>
                          <h3>{z.name}</h3>
                          {past ? (
                            <span className="status unknown">
                              Saída passada
                            </span>
                          ) : (
                            <Status evaluation={evaluate(h, z, d?.stale)} />
                          )}
                          <p>
                            {past
                              ? "Registo guardado neste dispositivo."
                              : "Volte a verificar as condições antes de sair."}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setDetail(z.id)}
                        >
                          Ver zona <ArrowUpRight size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Eliminar saída para ${z.name}`}
                          onClick={() =>
                            setTrips((ts) => ts.filter((x) => x.id !== t.id))
                          }
                        >
                          <X size={18} />
                        </button>
                      </article>
                    );
                  })
              )}
            </section>
          )}
          <footer>
            <span>
              <Waves size={16} /> marés.{" "}
              <span>Conhecer as condições. Escolher melhor.</span>
            </span>
            <button onClick={() => setSources(true)}>
              Open-Meteo · Astronomia local <ExternalLink size={12} />
            </button>
          </footer>
        </main>
      </div>
      {groupEditor && (
        <Modal
          title={editingGroup ? "Editar grupo" : "Criar grupo"}
          onClose={() => setGroupEditor(false)}
        >
          <form
            className="group-form"
            onSubmit={(e) => {
              e.preventDefault();
              const name = groupName.trim();
              if (!name) return;
              if (!editingGroup && groups.length >= 30) {
                setToast("Limite de 30 grupos neste dispositivo.");
                return;
              }
              const tags = [
                ...new Set(
                  groupTags
                    .split(",")
                    .map((t) => t.trim().replace(/^#+/, "").toLocaleLowerCase())
                    .filter(Boolean),
                ),
              ]
                .slice(0, 10)
                .map((t) => t.slice(0, 30));
              const id = editingGroup || "group-" + crypto.randomUUID();
              setGroups((gs) =>
                editingGroup
                  ? gs.map((g) => (g.id === id ? { id, name, tags } : g))
                  : [...gs, { id, name, tags }],
              );
              setGroupEditor(false);
              setToast(
                editingGroup
                  ? "Grupo atualizado."
                  : "Grupo criado. Associe os pontos na página Explorar costa.",
              );
            }}
          >
            <label>
              Nome do grupo
              <input
                required
                maxLength={60}
                placeholder="Ex.: Pesca de fim de semana"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </label>
            <label>
              Tags, separadas por vírgulas
              <input
                maxLength={350}
                placeholder="Ex.: família, praia, spinning"
                value={groupTags}
                onChange={(e) => setGroupTags(e.target.value)}
              />
            </label>
            <p>
              Até 10 tags por grupo. Um ponto pode pertencer a vários grupos.
              Grupos e pinos ficam neste navegador.
            </p>
            <button className="primary" type="submit">
              {editingGroup ? "Guardar alterações" : "Guardar grupo"}
            </button>
          </form>
        </Modal>
      )}
      {detail && (
        <Detail
          zone={zones.find((z) => z.id === detail)!}
          data={liveData(detail)}
          now={now}
          onClose={() => setDetail(null)}
          onSave={saveTrip}
          onCalendar={() => {
            setSelected(detail);
            setDetail(null);
            setTab("calendar");
          }}
        />
      )}
      {sources && (
        <Modal title="Fontes e metodologia" onClose={() => setSources(false)}>
          <p>
            Esta versão usa previsões gratuitas e cálculos astronómicos. Não
            recebe observações de boias ou marégrafos.
          </p>
          <h3>Previsões meteorológicas e marinhas</h3>
          <p>
            {directMode
              ? "GitHub Pages: o seu navegador consulta diretamente os fornecedores. A cache dura nesta sessão; recarregar a página inicia uma nova cache. As coordenadas consultadas são enviadas ao Open-Meteo."
              : "Modo servidor: as consultas e a cache são partilhadas pelo servidor da aplicação."}
          </p>
          <p>
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            : vento em km/h, precipitação em mm/h, ondas em metros e período em
            segundos. Dados de modelo, recolhidos no máximo uma vez por hora por
            zona e fonte. Em falhas, a nova tentativa é espaçada por 5 minutos.
            A interface consulta atualizações a cada 15 minutos.
          </p>
          <p>
            Dados meteorológicos sob CC BY 4.0. O acesso gratuito à API
            destina-se a utilização não comercial, sujeito aos limites e termos
            do fornecedor.{" "}
            <a
              href="https://open-meteo.com/en/terms"
              target="_blank"
              rel="noreferrer"
            >
              Consultar condições
            </a>
            .
          </p>
          <h3>O que significa uma oportunidade?</h3>
          <p>
            Regras iniciais, ainda sem validação por capturas locais.
            “Promissoras · parcial”: luz diurna, vento até 18 km/h, ondas até
            1,5 m, período inferior a 12 s e chuva inferior a 1 mm/h.
            Priorizamos os 90 minutos após o nascer e antes do pôr do sol. As
            janelas são de uma hora, limitadas aos dados disponíveis.
          </p>
          <p>
            Vento ≥30 km/h, rajadas ≥45 km/h, ondas ≥2,5 m ou chuva ≥5 mm/h
            produzem “Condições adversas”. Outros valores completos são
            “Razoáveis · parcial”. Dados ausentes ou com mais de 90 minutos
            desde a recolha impedem recomendações. Estes limites não certificam
            segurança e não consideram a direção relativa à costa nem a espécie
            nesta versão.
          </p>
          <h3>Nível do mar, correntes e temperatura</h3>
          <p>
            Open-Meteo disponibiliza o modelo Météo-France SMOC, gerado com
            informação do{" "}
            <a
              href="https://doi.org/10.48670/moi-00016"
              target="_blank"
              rel="noreferrer"
            >
              Copernicus Marine Service
            </a>
            . Grelha de cerca de 8 km, atualização diária. Nível em metros
            relativamente ao nível médio global (MSL), incluindo marés e efeitos
            meteorológicos: não é uma altura sobre o zero hidrográfico. Valores
            negativos são válidos. A direção da corrente indica para onde a água
            se desloca. A temperatura representa a superfície do mar.
          </p>
          <p>
            Os máximos/mínimos são amostras horárias superiores/inferiores às
            duas amostras vizinhas. Não interpolamos lacunas nem apresentamos
            horas exatas de preia-mar/baixa-mar. A precisão é limitada em
            praias, canais e baías. Estes dados são informativos e ainda não
            alteram a classificação de oportunidade. A sua indisponibilidade não
            elimina as previsões de vento e ondas.
          </p>
          <h3>Marés vivas e mortas</h3>
          <p>
            SunCalc calcula a fase lunar. Uma distância de fase inferior a 0,08
            ciclos da Lua nova/cheia indica “Vivas”; dos quartos, “Mortas”; os
            restantes dias são “Intermédias”. É uma aproximação astronómica: não
            prevê a amplitude, corrente, enchente, vazante ou horas de preia-mar
            e baixa-mar. Sem uma fonte local validada, esses valores não são
            apresentados.
          </p>
          <h3>Localização e privacidade</h3>
          <p>
            Os pontos são referências aproximadas de zonas, não acessos
            verificados. O modelo marinho usa uma célula de mar próxima e pode
            representar mal baías, recifes e canais. Favoritos e saídas ficam
            neste navegador; não são sincronizados. Mapas © OpenStreetMap
            contributors; os pedidos de mosaicos são enviados ao servidor de
            mapas.
          </p>
          <h3>Últimas recolhas</h3>
          {zones.map((z) => (
            <div className="source-row" key={z.id}>
              <strong>{z.name}</strong>
              {data[z.id]?.sources.map((s) => (
                <p key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>{" "}
                  ·{" "}
                  {s.fetchedAt
                    ? `${dayLabel(s.fetchedAt)}, ${timeLabel(s.fetchedAt)}`
                    : "sem dados"}
                  {s.error ? " · atualização falhou" : ""}
                  {s.modelPoint
                    ? ` · célula ${s.modelPoint.lat.toFixed(3)}, ${s.modelPoint.lon.toFixed(3)}`
                    : ""}
                </p>
              )) || <p>Ainda sem recolha.</p>}
            </div>
          ))}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function OceanPanel({
  hours,
  stale,
  now,
  source,
}: {
  hours: Hour[];
  stale: boolean;
  now: number;
  source?: Source;
}) {
  const row =
    currentRow({ hours }, now) ?? hours.find((h) => h.time >= now) ?? hours[0];
  const usable = hours.some(
    (h) =>
      isNumber(h.seaLevel) ||
      isNumber(h.currentSpeed) ||
      isNumber(h.seaTemperature),
  );
  const events = stale ? [] : oceanExtrema(hours, now);
  const nextHigh = events.find((e) => e.kind === "high"),
    nextLow = events.find((e) => e.kind === "low");
  return (
    <section className="ocean-panel" aria-label="Nível do mar e correntes">
      <div className="section-heading">
        <div>
          <h3>Nível do mar e correntes</h3>
          <p>Open-Meteo · Météo-France SMOC / Copernicus Marine</p>
        </div>
        <span className="model-badge">MODELO · ~8 KM</span>
      </div>
      {!usable ? (
        <div className="notice">
          Previsão oceanográfica indisponível para este ponto ou período. Tente
          atualizar mais tarde.
        </div>
      ) : (
        <>
          {stale && (
            <div className="notice">
              Dados oceanográficos desatualizados. Os valores abaixo pertencem à
              última recolha; os extremos previstos foram suspensos.
            </div>
          )}
          <div className="ocean-metrics">
            <div>
              <span>Nível do mar · MSL</span>
              <strong>
                {fmt(row?.seaLevel, 2)} <small>m</small>
              </strong>
              <small>
                {!stale
                  ? levelTrend(hours, row?.time) || "Sem tendência suficiente"
                  : "Última recolha"}
              </small>
            </div>
            <div>
              <span>Corrente oceânica</span>
              <strong>
                {fmt(row?.currentSpeed)} <small>km/h</small>
              </strong>
              <small>
                Para {directionLabel(row?.currentDirection)} ·{" "}
                {fmt(row?.currentDirection, 0)}°
              </small>
            </div>
            <div>
              <span>Temperatura da água</span>
              <strong>
                {fmt(row?.seaTemperature)} <small>°C</small>
              </strong>
              <small>Superfície do mar</small>
            </div>
          </div>
          {row && (
            <p className="ocean-time">
              Valores previstos para {dayLabel(row.time)}, {timeLabel(row.time)}{" "}
              CAT
            </p>
          )}
          <SparkChart
            hours={hours}
            field="seaLevel"
            label="Nível do mar previsto"
            unit="m · referência MSL"
          />
          <div className="ocean-extrema">
            {[
              ["Próximo máximo do modelo", nextHigh],
              ["Próximo mínimo do modelo", nextLow],
            ].map(([label, event]) => {
              const e = event as { time: number; value: number } | undefined;
              return (
                <div key={String(label)}>
                  <span>{String(label)}</span>
                  <strong>
                    {e
                      ? `${dayLabel(e.time)} · ${timeLabel(e.time)} · ${fmt(e.value, 2)} m`
                      : "Sem extremo identificado neste período"}
                  </strong>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="ocean-disclaimer">
        Nível relativo ao nível médio global, não ao zero hidrográfico. Inclui
        marés e efeitos meteorológicos. Extremos estimados em amostras de uma
        hora, sem validação local; não são uma tábua de marés oficial.
      </p>
      {source && (
        <p className="ocean-source">
          <a href={source.url} target="_blank" rel="noreferrer">
            Consultar dados da fonte <ExternalLink size={11} />
          </a>
          {source.fetchedAt
            ? ` · recolhidos ${dayLabel(source.fetchedAt)} às ${timeLabel(source.fetchedAt)}`
            : " · sem recolha disponível"}
          {source.modelPoint
            ? ` · célula ${source.modelPoint.lat.toFixed(3)}°, ${source.modelPoint.lon.toFixed(3)}°`
            : ""}
        </p>
      )}
    </section>
  );
}
function ForecastView({ hours, stale }: { hours: Hour[]; stale: boolean }) {
  return (
    <>
      {stale && hours.length > 0 && (
        <p className="notice">
          Previsão desatualizada ou incompleta. Não utilizada para recomendar
          saídas.
        </p>
      )}
      <div className="charts">
        <SparkChart hours={hours} field="wind" label="Vento" unit="km/h" />
        <SparkChart hours={hours} field="wave" label="Ondulação" unit="m" />
      </div>
      <details className="hourly-table">
        <summary>Ver valores por hora e direção</summary>
        {hours.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Vento km/h</th>
                  <th>Rajadas km/h</th>
                  <th>Direção °</th>
                  <th>Ondas m</th>
                  <th>Período s</th>
                  <th>Chuva mm/h</th>
                  <th>Nível MSL m</th>
                  <th>Corrente km/h</th>
                  <th>Corrente para °</th>
                  <th>Água °C</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => (
                  <tr key={h.time}>
                    <td>
                      {dayLabel(h.time)} {timeLabel(h.time)}
                    </td>
                    <td>{fmt(h.wind)}</td>
                    <td>{fmt(h.gust)}</td>
                    <td>{fmt(h.direction, 0)}</td>
                    <td>{fmt(h.wave)}</td>
                    <td>{fmt(h.period)}</td>
                    <td>{fmt(h.rain)}</td>
                    <td>{fmt(h.seaLevel)}</td>
                    <td>{fmt(h.currentSpeed)}</td>
                    <td>{fmt(h.currentDirection, 0)}</td>
                    <td>{fmt(h.seaTemperature)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Não existem valores disponíveis para este período.</p>
        )}
      </details>
    </>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          autoFocus
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={22} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
function Detail({
  zone,
  data,
  now,
  onClose,
  onSave,
  onCalendar,
}: {
  zone: Zone;
  data: Forecast | undefined;
  now: number;
  onClose: () => void;
  onSave: (id: string, time: number) => void;
  onCalendar: () => void;
}) {
  const z = zone,
    id = z.id,
    h = currentRow(data, now),
    ev = evaluate(h, z, data?.stale),
    sun = solar(now, z),
    win = bestWindow(data, z, undefined, now),
    moon = lunar(now);
  return (
    <Modal title={z.name} onClose={onClose}>
      <p className="detail-location">
        <MapPin size={15} />
        {z.region} · {z.type}
      </p>
      <p>{z.description}</p>
      <Status evaluation={ev} />
      <ul className="reasons">
        {ev.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <div className="detail-facts">
        <div>
          <Moon size={20} />
          <strong>{moon.tide}</strong>
          <small>Ciclo estimado · {moon.name}</small>
        </div>
        <div>
          <Sun size={20} />
          <strong>
            {timeLabel(sun.sunrise)} / {timeLabel(sun.sunset)}
          </strong>
          <small>Nascer / pôr do sol · CAT</small>
        </div>
      </div>
      <div className="notice">
        <Info size={17} /> Ainda sem tábua de marés local validada. O nível do
        mar e as correntes abaixo são previsões de modelo; a avaliação das
        condições permanece parcial.
      </div>
      {win && (
        <div className="recommendation">
          <div>
            <strong>
              Próxima janela: {dayLabel(win.time)} · {timeLabel(win.time)}–
              {timeLabel(win.time + 3600000)}
            </strong>
            <p>{win.evaluation.reasons.join(" ")}</p>
          </div>
          <button className="secondary" onClick={() => onSave(id, win.time)}>
            <Bookmark size={16} />
            Guardar
          </button>
        </div>
      )}
      <OceanPanel
        hours={(data?.hours || []).filter(
          (h) => h.time >= now - 3600000 && h.time < now + 25 * 3600000,
        )}
        stale={data?.oceanStale ?? true}
        now={now}
        source={data?.sources.find((s) => s.id === "ocean")}
      />
      <h3>Vento e ondas · próximas 24 horas</h3>
      <ForecastView
        hours={(data?.hours || []).filter(
          (h) => h.time >= now - 3600000 && h.time < now + 23 * 3600000,
        )}
        stale={data?.stale ?? true}
      />
      <button className="primary" onClick={onCalendar}>
        <CalendarDays size={17} /> Comparar datas
      </button>
      <div className="detail-sources">
        <h3>Fontes desta zona</h3>
        {data?.sources.map((s) => (
          <p key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>{" "}
            · {s.kind} ·{" "}
            {s.fetchedAt
              ? `recolhido ${dayLabel(s.fetchedAt)} às ${timeLabel(s.fetchedAt)}`
              : "indisponível"}
            {s.error ? " · falha na atualização" : ""}
          </p>
        )) || <p>A aguardar recolha.</p>}
      </div>
    </Modal>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
