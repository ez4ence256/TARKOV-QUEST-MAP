// Composant racine : choix du mode, chargement des données, panneau + carte.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMap, Objective, TarkovData, Task } from "./types";
import { GAME_MODES } from "./types";
import { loadTarkovData } from "./api/cache";
import { BUNDLED_CALIBRATION, loadCalibration } from "./map/calibration";
import { MapView, type Placing } from "./map/MapView";
import { exportState, getLastMode, useAppState, type CustomPoint } from "./state/store";
import { QUEST_COLORS } from "./lib/objectiveTypes";
import { buildObjectivePoints, manualPointKey, taskMapIds } from "./lib/points";
import { ModePicker } from "./components/ModePicker";
import { QuestList } from "./components/QuestList";
import { SelectedQuests } from "./components/SelectedQuests";
import { CustomPointsTab } from "./components/CustomPointsTab";
import { SettingsTab } from "./components/SettingsTab";
import { PhotosTab } from "./components/PhotosTab";
import { ResetProgressSection } from "./components/ResetProgressSection";
import { QuestTab } from "./components/QuestTab";

/** Langue des noms de quêtes : français, l'anglais sert de secours (géré par l'API). */
const LANG = "fr";

type Tab = "selection" | "quests" | "quest" | "photos" | "custom" | "settings";
type LoadState =
  | { status: "loading"; data: TarkovData | null }
  | { status: "ready"; data: TarkovData; source: "cache" | "network" | "stale"; error?: string }
  | { status: "error"; data: null; error: string };

const isMobile = () => window.matchMedia("(max-width: 800px)").matches;
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function App() {
  const { state, modeState: mode, dispatch } = useAppState();
  const gameMode = state.gameMode;
  const [load, setLoad] = useState<LoadState>({ status: "loading", data: null });
  const [reloadToken, setReloadToken] = useState(0);
  const [calibration, setCalibration] = useState(BUNDLED_CALIBRATION);
  const [tab, setTab] = useState<Tab>("quests");
  /** Quête affichée dans l'onglet Photos. */
  const [tabTaskId, setTabTaskId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => !isMobile());
  const [placing, setPlacing] = useState<Placing>(null);
  const [focus, setFocus] = useState<{ key: string; n: number } | null>(null);

  // Calibrage des cartes (copie embarquée tout de suite, version en ligne ensuite)
  useEffect(() => {
    loadCalibration().then(setCalibration);
  }, []);

  // Données de l'API : au choix du mode (cache si frais), puis à chaque demande de rechargement (forcé)
  const lastReload = useRef(0);
  useEffect(() => {
    if (!gameMode) return;
    const force = reloadToken !== lastReload.current;
    lastReload.current = reloadToken;
    const controller = new AbortController();
    setLoad((prev) => ({ status: "loading", data: prev.data?.gameMode === gameMode ? prev.data : null }));
    loadTarkovData(gameMode, LANG, { force, signal: controller.signal })
      .then((res) => setLoad({ status: "ready", ...res }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoad({ status: "error", data: null, error: error.message });
      });
    return () => controller.abort();
  }, [gameMode, reloadToken]);

  const data = load.data;
  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const maps = useMemo(() => data?.maps ?? [], [data]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const objectivesById = useMemo(() => {
    const m = new Map<string, Objective>();
    for (const t of tasks) for (const o of t.objectives) m.set(o.id, o);
    return m;
  }, [tasks]);
  const selectedTasks = useMemo(
    () => mode.selected.map((s) => tasksById.get(s.taskId)).filter((t): t is Task => Boolean(t)),
    [mode.selected, tasksById],
  );
  const colorOf = useCallback(
    (taskId: string) => QUEST_COLORS[mode.selected.find((s) => s.taskId === taskId)?.color ?? 0],
    [mode.selected],
  );

  // Map affichée : choix mémorisé, sinon map de la première quête sélectionnée, sinon Customs.
  const currentMap: GameMap | undefined = useMemo(() => {
    const byId = (id: string | null | undefined) => maps.find((m) => m.id === id);
    const fromSelection = selectedTasks.map((t) => [...taskMapIds(t)][0]).find(Boolean);
    return byId(mode.mapId) ?? byId(fromSelection) ?? maps.find((m) => m.normalizedName === "customs") ?? maps[0];
  }, [maps, mode.mapId, selectedTasks]);

  const points = useMemo(
    () => (currentMap ? buildObjectivePoints(selectedTasks, mode, currentMap.id, state.showDone) : []),
    [selectedTasks, mode, currentMap, state.showDone],
  );

  // Nombre de points restants par map (affiché dans le sélecteur de map)
  const pointsPerMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of selectedTasks)
      for (const o of t.objectives) {
        if (mode.done[o.id]) continue;
        for (const l of o.locations) counts.set(l.mapId, (counts.get(l.mapId) ?? 0) + 1);
        const manual = mode.manual[o.id];
        if (o.locations.length === 0 && manual) counts.set(manual.mapId, (counts.get(manual.mapId) ?? 0) + 1);
      }
    return counts;
  }, [selectedTasks, mode.done, mode.manual]);

  const customPoints = useMemo(
    () => mode.customPoints.filter((p) => p.mapId === currentMap?.id),
    [mode.customPoints, currentMap],
  );

  // ouvre l'onglet Quête ou Photos sur une quête (boutons de la liste, du panneau ou d'une popup)
  const showTaskTab = useCallback((taskId: string, which: "quest" | "photos") => {
    setTabTaskId(taskId);
    setTab(which);
    setPanelOpen(true);
  }, []);
  const showPhotos = useCallback((taskId: string) => showTaskTab(taskId, "photos"), [showTaskTab]);
  const showQuest = useCallback((taskId: string) => showTaskTab(taskId, "quest"), [showTaskTab]);

  const showMap = (mapId: string) => {
    dispatch({ type: "setMap", mapId });
    if (isMobile()) setPanelOpen(false);
  };
  const focusPoint = (key: string, mapId: string) => {
    if (mapId !== currentMap?.id) dispatch({ type: "setMap", mapId });
    setFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }));
    if (isMobile()) setPanelOpen(false);
  };
  const startPlacing = (p: Placing) => {
    setPlacing(p);
    if (isMobile()) setPanelOpen(false);
  };

  const onPlace = (pos: { x: number; z: number }) => {
    if (!placing || !currentMap) return;
    if (placing.kind === "manual") {
      dispatch({ type: "setManual", objectiveId: placing.objectiveId, position: { mapId: currentMap.id, ...pos } });
      setFocus((f) => ({ key: manualPointKey(placing.objectiveId), n: (f?.n ?? 0) + 1 }));
    } else {
      const point: CustomPoint = {
        id: newId(),
        mapId: currentMap.id,
        ...pos,
        icon: "star",
        label: "",
        note: "",
        createdAt: Date.now(),
      };
      dispatch({ type: "addCustom", point });
      setFocus((f) => ({ key: `custom:${point.id}`, n: (f?.n ?? 0) + 1 }));
    }
    setPlacing(null);
  };

  // Échap annule le placement en cours
  useEffect(() => {
    if (!placing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlacing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing]);

  if (!gameMode) {
    return <ModePicker last={getLastMode()} onPick={(m) => dispatch({ type: "setGameMode", mode: m })} />;
  }

  const modeLabel = GAME_MODES.find((m) => m.id === gameMode)?.label;
  const sourceLabel =
    load.status === "ready"
      ? load.source === "network"
        ? "Téléchargées à l'instant."
        : load.source === "cache"
          ? "Depuis le cache local (rafraîchi toutes les 6 h)."
          : `API injoignable, dernière version en cache utilisée (${load.error}).`
      : "";

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="btn btn-small panel-toggle"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="side-panel"
        >
          {panelOpen ? "◀ Masquer" : "☰ Quêtes"}
        </button>
        <div className="brand">
          Quest Planner <span className="mode-badge">{modeLabel}</span>
        </div>
        <select
          className="input map-select"
          value={currentMap?.id ?? ""}
          onChange={(e) => showMap(e.target.value)}
          aria-label="Map affichée"
          disabled={maps.length === 0}
        >
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {pointsPerMap.get(m.id) ? ` (${pointsPerMap.get(m.id)})` : ""}
            </option>
          ))}
        </select>
      </header>

      {load.status === "ready" && load.source === "stale" && (
        <div className="alert">
          L'API tarkov.dev ne répond pas : affichage de la dernière version en cache.{" "}
          <button className="link" onClick={() => setReloadToken((n) => n + 1)}>
            Réessayer
          </button>
        </div>
      )}

      <div className="layout">
        <aside id="side-panel" className={`panel ${panelOpen ? "is-open" : ""}`}>
          <nav className="tabs" role="tablist">
            {(
              [
                ["selection", `Sélection${mode.selected.length ? ` (${mode.selected.length})` : ""}`],
                ["quests", "Quêtes"],
                ["quest", "Quête", "📜"],
                ["photos", "Photos", "📷"],
                ["custom", "Mes points"],
                ["settings", "Réglages"],
              ] as [Tab, string, string?][]
            ).map(([id, label, logo]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                aria-label={label}
                title={label}
                className={`tab ${tab === id ? "is-active" : ""}`}
                onClick={() => setTab(id)}
              >
                {logo && (
                  <span className="tab-logo" aria-hidden="true">
                    {logo}
                  </span>
                )}
                {/* sur téléphone, les onglets à logo n'affichent que le logo (voir styles.css) */}
                <span className={logo ? "tab-text" : undefined}>{label}</span>
              </button>
            ))}
          </nav>

          {load.status === "loading" && !data && <div className="tab-body notice muted">Chargement des quêtes…</div>}
          {load.status === "error" && (
            <div className="tab-body notice">
              <p className="error">Impossible de charger les données de tarkov.dev : {load.error}</p>
              <button className="btn" onClick={() => setReloadToken((n) => n + 1)}>
                Réessayer
              </button>
            </div>
          )}

          {data && tab === "quests" && (
            <QuestList
              tasks={tasks}
              traders={data.traders}
              maps={maps}
              mode={mode}
              onToggle={(taskId) => dispatch({ type: "toggleTask", taskId })}
              onPhotos={showPhotos}
            />
          )}
          {data && tab === "selection" && (
            <SelectedQuests
              tasks={tasks}
              traders={data.traders}
              maps={maps}
              mode={mode}
              currentMapId={currentMap?.id ?? null}
              dispatch={dispatch}
              onShowMap={showMap}
              onFocus={focusPoint}
              onStartPlacing={(o) =>
                startPlacing({ kind: "manual", objectiveId: o.id, label: o.description || "objectif" })
              }
              onBrowse={() => setTab("quests")}
              onPhotos={showPhotos}
              onQuest={showQuest}
            />
          )}
          {data && tab === "quest" && (
            <QuestTab
              tasks={tasks}
              traders={data.traders}
              selectedIds={mode.selected.map((s) => s.taskId)}
              taskId={tabTaskId}
              onTaskChange={setTabTaskId}
              done={mode.done}
              onSetDone={(objectiveId, value) => dispatch({ type: "setDone", objectiveId, done: value })}
              onReset={(task) => dispatch({ type: "resetProgress", objectiveIds: task.objectives.map((o) => o.id) })}
              onPhotos={showPhotos}
            />
          )}
          {data && tab === "photos" && (
            <PhotosTab
              tasks={tasks}
              selectedIds={mode.selected.map((s) => s.taskId)}
              taskId={tabTaskId}
              onTaskChange={setTabTaskId}
            />
          )}
          {data && tab === "custom" && (
            <CustomPointsTab
              points={mode.customPoints}
              maps={maps}
              currentMapId={currentMap?.id ?? null}
              onAdd={() => startPlacing({ kind: "custom" })}
              onFocus={(p) => focusPoint(`custom:${p.id}`, p.mapId)}
            />
          )}
          {tab === "settings" && (
            <SettingsTab
              gameMode={gameMode}
              data={data}
              dataSource={sourceLabel}
              showDone={state.showDone}
              onShowDone={(value) => dispatch({ type: "setShowDone", value })}
              onChangeMode={() => dispatch({ type: "setGameMode", mode: null })}
              onRefresh={() => setReloadToken((n) => n + 1)}
              onExport={() => exportState(state)}
              onImport={(imported) => dispatch({ type: "import", state: imported })}
              resetSection={
                <ResetProgressSection
                  tasks={tasks}
                  done={mode.done}
                  modeLabel={modeLabel ?? ""}
                  onResetTask={(task) =>
                    dispatch({ type: "resetProgress", objectiveIds: task.objectives.map((o) => o.id) })
                  }
                  onResetAll={() => dispatch({ type: "resetAllProgress" })}
                  onExport={() => exportState(state)}
                />
              }
            />
          )}
        </aside>

        <main className="map-area">
          {currentMap ? (
            <MapView
              // une carte = un système de coordonnées : on recrée Leaflet à chaque changement
              key={`${currentMap.id}|${calibration[currentMap.normalizedName]?.key ?? "none"}`}
              map={currentMap}
              calibration={calibration[currentMap.normalizedName]}
              points={points}
              customPoints={customPoints}
              tasksById={tasksById}
              objectivesById={objectivesById}
              colorOf={colorOf}
              mode={mode}
              dispatch={dispatch}
              placing={placing}
              onPlace={onPlace}
              focus={focus}
              onPhotos={showPhotos}
              onQuest={showQuest}
            />
          ) : (
            <div className="map-empty muted">{load.status === "loading" ? "Chargement…" : "Aucune map."}</div>
          )}
          {placing && (
            <button className="btn cancel-placing" onClick={() => setPlacing(null)}>
              Annuler le placement
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
