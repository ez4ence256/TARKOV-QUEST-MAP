// Composant racine : choix du mode, chargement des données, panneau + carte.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMap, Objective, TarkovData, Task } from "./types";
import { GAME_MODES } from "./types";
import { loadTarkovData } from "./api/cache";
import { BUNDLED_CALIBRATION, loadCalibration } from "./map/calibration";
import { MapView, type Placing } from "./map/MapView";
import { exportState, getLastMode, useAppState, type CustomPoint } from "./state/store";
import { QUEST_COLORS } from "./lib/objectiveTypes";
import { buildObjectivePoints, manualPointKey, shownObjectives, taskMapIds } from "./lib/points";
import { ModePicker } from "./components/ModePicker";
import { QuestList } from "./components/QuestList";
import { SelectedQuests } from "./components/SelectedQuests";
import { CustomPointsTab } from "./components/CustomPointsTab";
import { SettingsTab } from "./components/SettingsTab";
import { PhotosTab, type ExitPhotosTarget } from "./components/PhotosTab";
import { ResetProgressSection } from "./components/ResetProgressSection";
import { QuestTab } from "./components/QuestTab";
import { CaptureTab } from "./components/CaptureTab";
import { dominantMap } from "./lib/ocrMatch";
import { PanelResizer } from "./components/PanelResizer";
import { getLang, setLang as applyLang, tr, type Lang } from "./lib/i18n";
import { clampPanelWidth, readPanelWidth } from "./lib/panelWidth";
import { storyIdOf } from "./lib/story";
import { useRoom } from "./api/room";
import { buildEventTasks, loadEventEntries, type EventEntry } from "./api/eventQuests";
import { RoomControl } from "./components/RoomControl";
import { MapPicker } from "./components/MapPicker";

type Tab = "selection" | "quests" | "capture" | "quest" | "photos" | "custom" | "settings";

/**
 * Onglets du panneau. `label` : texte visible sur ordinateur (au plus deux mots courts,
 * pour tenir sur deux lignes sans couper de mot) ; `full` : nom complet (lecteur d'écran,
 * infobulle) ; `logo` : seul affiché sur téléphone.
 */
const TABS: { id: Tab; label: [string, string]; full?: [string, string]; logo: string }[] = [
  { id: "selection", label: ["Sélection", "Selection"], logo: "📌" },
  { id: "quests", label: ["Quêtes", "Quests"], full: ["Toutes les quêtes", "All quests"], logo: "📋" },
  { id: "capture", label: ["Capture", "Capture"], full: ["Importer une capture", "Import a screenshot"], logo: "📥" },
  { id: "quest", label: ["Fiche quête", "Quest page"], full: ["Quête sélectionnée", "Selected quest"], logo: "📜" },
  { id: "photos", label: ["Photos", "Photos"], logo: "📷" },
  { id: "custom", label: ["Mes points", "My points"], logo: "📍" },
  { id: "settings", label: ["Réglages", "Settings"], logo: "⚙️" },
];
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
  const room = useRoom(state, dispatch);
  const [load, setLoad] = useState<LoadState>({ status: "loading", data: null });
  const [reloadToken, setReloadToken] = useState(0);
  const [lang, setLang] = useState<Lang>(getLang);
  // i18n d'abord, pour que le rendu suivant lise déjà la nouvelle langue
  const changeLang = (next: Lang) => {
    applyLang(next);
    setLang(next);
  };
  // sorties Scav affichées par défaut ; le choix est retenu dans le navigateur
  const [showScavExits, setShowScavExits] = useState(() => {
    try {
      return localStorage.getItem("tqp:showScavExits") !== "0";
    } catch {
      return true;
    }
  });
  const changeScavExits = (on: boolean) => {
    setShowScavExits(on);
    try {
      localStorage.setItem("tqp:showScavExits", on ? "1" : "0");
    } catch {
      /* préférence non retenue */
    }
  };
  const [calibration, setCalibration] = useState(BUNDLED_CALIBRATION);
  const [tab, setTab] = useState<Tab>("quests");
  /** Quête affichée dans l'onglet Photos. */
  const [tabTaskId, setTabTaskId] = useState<string | null>(null);
  // sortie cliquée sur la carte : l'onglet Photos montre la sienne plutôt que celles d'une quête
  const [photoExit, setPhotoExit] = useState<ExitPhotosTarget | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => !isMobile());
  /** Largeur du panneau sur ordinateur (poignée de redimensionnement, enregistrée). */
  const [panelWidth, setPanelWidth] = useState(() => readPanelWidth(window.innerWidth));
  // fenêtre réduite : la largeur reste dans les bornes (sans écraser la valeur enregistrée)
  useEffect(() => {
    const onResize = () => setPanelWidth((w) => clampPanelWidth(w, window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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
    loadTarkovData(gameMode, lang, { force, signal: controller.signal })
      .then((res) => setLoad({ status: "ready", ...res }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoad({ status: "error", data: null, error: error.message });
      });
    return () => controller.abort();
  }, [gameMode, reloadToken, lang]);

  const data = load.data;
  // Quêtes d'événement du wiki absentes de tarkov.dev : chargées une fois les données prêtes, sans bloquer l'app
  const [eventEntries, setEventEntries] = useState<EventEntry[]>([]);
  const dataReady = Boolean(data);
  useEffect(() => {
    if (!dataReady) return;
    loadEventEntries().then(setEventEntries, (e) => console.warn("Quêtes d'événement du wiki indisponibles :", e));
  }, [dataReady]);
  const tasks = useMemo(() => (data ? [...data.tasks, ...buildEventTasks(eventEntries, data)] : []), [data, eventEntries]);
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

  const oneAtATime = state.oneAtATime !== false;
  const points = useMemo(
    () => (currentMap ? buildObjectivePoints(selectedTasks, mode, currentMap.id, state.showDone, oneAtATime) : []),
    [selectedTasks, mode, currentMap, state.showDone, oneAtATime],
  );

  // Nombre de points restants par map (affiché dans le sélecteur de map)
  const pointsPerMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of selectedTasks)
      for (const o of shownObjectives(t, mode.done, false, oneAtATime)) {
        for (const l of o.locations) counts.set(l.mapId, (counts.get(l.mapId) ?? 0) + 1);
        const manual = mode.manual[o.id];
        if (o.locations.length === 0 && manual) counts.set(manual.mapId, (counts.get(manual.mapId) ?? 0) + 1);
      }
    return counts;
  }, [selectedTasks, mode.done, mode.manual, oneAtATime]);

  const customPoints = useMemo(
    () => mode.customPoints.filter((p) => p.mapId === currentMap?.id),
    [mode.customPoints, currentMap],
  );

  // ouvre l'onglet Quête ou Photos sur une quête (boutons de la liste, du panneau ou d'une popup)
  const showTaskTab = useCallback((taskId: string, which: "quest" | "photos") => {
    setTabTaskId(taskId);
    if (which === "photos") setPhotoExit(null);
    setTab(which);
    setPanelOpen(true);
  }, []);
  const showExitPhotos = useCallback((target: ExitPhotosTarget) => {
    setPhotoExit(target);
    setTab("photos");
    setPanelOpen(true);
  }, []);
  const showPhotos = useCallback((taskId: string) => showTaskTab(taskId, "photos"), [showTaskTab]);
  const showQuest = useCallback((taskId: string) => showTaskTab(taskId, "quest"), [showTaskTab]);

  // Ctrl+V d'une image n'importe où (sauf dans un champ de texte) : import par capture
  const [pastedImage, setPastedImage] = useState<{ blob: Blob; n: number } | null>(null);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el?.isContentEditable ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file", "range"].includes(el.type));
      if (typing) return; // collage de texte normal dans les notes, la recherche…
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
      const blob = item?.getAsFile();
      if (!blob) return;
      e.preventDefault();
      setPastedImage({ blob, n: Date.now() });
      setTab("capture");
      setPanelOpen(true);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // Sélection d'une quête : si rien d'elle n'est sur la map affichée mais qu'il y en a ailleurs, on y va.
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const toggleTask = (taskId: string) => {
    dispatch({ type: "toggleTask", taskId });
    const task = tasksById.get(taskId);
    if (!task || mode.selected.some((s) => s.taskId === taskId) || !currentMap) return;
    const shown = { objectives: shownObjectives(task, mode.done, false, oneAtATime) };
    const target = dominantMap([shown], 0);
    if (!target || target === currentMap.id || shown.objectives.some((o) => o.locations.some((l) => l.mapId === currentMap.id))) return;
    dispatch({ type: "setMap", mapId: target });
    const name = maps.find((m) => m.id === target)?.name ?? "";
    setMapNotice(tr(`Map affichée : ${name} (les points de « ${task.name} » s'y trouvent).`, `Displayed map: ${name} (the points of "${task.name}" are there).`));
  };
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
    return <ModePicker
        last={getLastMode()}
        onPick={(m) => dispatch({ type: "setGameMode", mode: m })}
        lang={lang}
        onLang={changeLang}
      />;
  }

  const modeLabel = GAME_MODES.find((m) => m.id === gameMode)?.label;
  const sourceLabel =
    load.status === "ready"
      ? load.source === "network"
        ? tr("Téléchargées à l'instant.", "Just downloaded.")
        : load.source === "cache"
          ? tr("Depuis le cache local (rafraîchi toutes les 6 h).", "From the local cache (refreshed every 6 h).")
          : tr(
              `API injoignable, dernière version en cache utilisée (${load.error}).`,
              `API unreachable, using the last cached version (${load.error}).`,
            )
      : "";

  return (
    <div className="app" style={{ ["--panel-user-w" as string]: `${panelWidth}px` }}>
      <header className="topbar">
        <button
          className="btn btn-small panel-toggle"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="side-panel"
        >
          {panelOpen ? tr("◀ Masquer", "◀ Hide") : tr("☰ Quêtes", "☰ Quests")}
        </button>
        <div className="brand">
          Quest Planner <span className="mode-badge">{modeLabel}</span>
        </div>
        <MapPicker maps={maps} currentId={currentMap?.id ?? ""} counts={pointsPerMap} onPick={showMap} />
        <RoomControl room={room} />
        <label className="scav-check">
          <input type="checkbox" checked={showScavExits} onChange={(e) => changeScavExits(e.target.checked)} />
          <span className="scav-check-long">{tr("Extracts Scav", "Scav extracts")}</span>
          <span className="scav-check-short" aria-hidden="true">Scav</span>
        </label>
        <select
          className="input lang-select"
          value={lang}
          onChange={(e) => changeLang(e.target.value === "en" ? "en" : "fr")}
          aria-label={tr("Langue", "Language")}
          title={tr("Langue de l'interface et des noms de quêtes, maps et objets", "Language of the interface and of quest, map and item names")}
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
      </header>

      {mapNotice && (
        <div className="alert" role="status">
          {mapNotice}{" "}
          <button className="link" onClick={() => setMapNotice(null)}>
            OK
          </button>
        </div>
      )}

      {room.notice && (
        <div className="alert" role="status">
          {room.notice}{" "}
          <button className="link" onClick={room.dismissNotice}>
            OK
          </button>
        </div>
      )}

      {load.status === "ready" && load.source === "stale" && (
        <div className="alert">
          {tr(
            "L'API tarkov.dev ne répond pas : affichage de la dernière version en cache.",
            "The tarkov.dev API is not responding: showing the last cached version.",
          )}{" "}
          <button className="link" onClick={() => setReloadToken((n) => n + 1)}>
            {tr("Réessayer", "Retry")}
          </button>
        </div>
      )}

      {/* key : recrée tout l'arbre (popups Leaflet comprises) dans la nouvelle langue */}
      <div className="layout" key={lang}>
        <aside id="side-panel" className={`panel ${panelOpen ? "is-open" : ""}`}>
          <nav className="tabs" role="tablist">
            {TABS.map(({ id, label: labelPair, full: fullPair, logo }) => {
              const label = tr(...labelPair);
              const full = fullPair && tr(...fullPair);
              const selectedCount = mode.selected.length + (mode.story?.selected.length ?? 0);
              const count = id === "selection" && selectedCount > 0 ? selectedCount : null;
              const name = `${full ?? label}${count ? ` (${count})` : ""}`;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  aria-label={name}
                  title={name}
                  className={`tab ${tab === id ? "is-active" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {/* ordinateur : texte (deux lignes au plus, sans couper de mot) ; téléphone : logo seul */}
                  <span className="tab-logo" aria-hidden="true">
                    {logo}
                  </span>
                  <span className="tab-text">{label}</span>
                  {count && <span className="tab-count">({count})</span>}
                </button>
              );
            })}
          </nav>

          {load.status === "loading" && !data && <div className="tab-body notice muted">{tr("Chargement des quêtes…", "Loading quests…")}</div>}
          {load.status === "error" && (
            <div className="tab-body notice">
              <p className="error">
                {tr("Impossible de charger les données de tarkov.dev : ", "Unable to load tarkov.dev data: ")}
                {load.error}
              </p>
              <button className="btn" onClick={() => setReloadToken((n) => n + 1)}>
                {tr("Réessayer", "Retry")}
              </button>
            </div>
          )}

          {data && tab === "quests" && (
            <QuestList
              tasks={tasks}
              traders={data.traders}
              maps={maps}
              mode={mode}
              onToggle={toggleTask}
              onPhotos={showPhotos}
              onClearSelection={() => dispatch({ type: "clearSelection" })}
              onShowMap={(mapId) => dispatch({ type: "setMap", mapId })}
              onToggleStory={(chapter) => dispatch({ type: "toggleStory", chapter })}
              onOpenStory={(chapter) => showQuest(storyIdOf(chapter))}
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
                startPlacing({ kind: "manual", objectiveId: o.id, label: o.description || tr("objectif", "objective") })
              }
              onBrowse={() => setTab("quests")}
              onPhotos={showPhotos}
              onQuest={showQuest}
              onStory={(chapter) => showQuest(storyIdOf(chapter))}
            />
          )}
          {data && tab === "quest" && (
            <QuestTab
              tasks={tasks}
              traders={data.traders}
              maps={maps}
              itemNames={data.itemNames ?? {}}
              itemIcons={data.itemIcons ?? {}}
              selectedIds={[...mode.selected.map((s) => s.taskId), ...(mode.story?.selected ?? []).map(storyIdOf)]}
              taskId={tabTaskId}
              onTaskChange={setTabTaskId}
              storyDone={mode.story?.done ?? {}}
              onStoryStep={(chapter, stepKey, value) => dispatch({ type: "setStoryStep", chapter, stepKey, done: value })}
              onStoryReset={(chapter) => dispatch({ type: "resetStory", chapter })}
              done={mode.done}
              onSetDone={(objectiveId, value) => dispatch({ type: "setDone", objectiveId, done: value })}
              onReset={(task) => dispatch({ type: "resetProgress", objectiveIds: task.objectives.map((o) => o.id) })}
              onPhotos={showPhotos}
            />
          )}
          {data && tab === "capture" && (
            <CaptureTab
              tasks={tasks}
              pasted={pastedImage}
              onApply={(taskIds, replace) => {
                dispatch({ type: "selectTasks", taskIds, replace });
                const added = taskIds.map((id) => tasksById.get(id)).filter((t): t is Task => Boolean(t));
                const mapId = dominantMap(added);
                const k = added.length;
                const n = tr(
                  `${k} quête${k > 1 ? "s" : ""} ${replace ? "sélectionnée" : "ajoutée"}${k > 1 ? "s" : ""}.`,
                  `${k} quest${k > 1 ? "s" : ""} ${replace ? "selected" : "added"}.`,
                );
                if (mapId && maps.some((m) => m.id === mapId)) {
                  dispatch({ type: "setMap", mapId });
                  const name = maps.find((m) => m.id === mapId)!.name;
                  return tr(
                    `${n} Map affichée : ${name} (la plupart de leurs points s'y trouvent).`,
                    `${n} Displayed map: ${name} (most of their points are there).`,
                  );
                }
                return tr(
                  `${n} Leurs points sont répartis sur plusieurs maps (ou absents) : la map affichée n'a pas changé.`,
                  `${n} Their points are spread over several maps (or missing): the displayed map did not change.`,
                );
              }}
            />
          )}
          {data && tab === "photos" && (
            <PhotosTab
              tasks={tasks}
              selectedIds={mode.selected.map((s) => s.taskId)}
              taskId={tabTaskId}
              onTaskChange={(id) => {
                setPhotoExit(null);
                setTabTaskId(id);
              }}
              exit={photoExit}
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
              oneAtATime={oneAtATime}
              onOneAtATime={(value) => dispatch({ type: "setOneAtATime", value })}
              onChangeMode={() => dispatch({ type: "setGameMode", mode: null })}
              onRefresh={() => setReloadToken((n) => n + 1)}
              onExport={() => exportState(state)}
              onImport={(imported) => dispatch({ type: "import", state: imported })}
              resetSection={
                <ResetProgressSection
                  tasks={tasks}
                  done={mode.done}
                  storyDone={Object.keys(mode.story?.done ?? {}).length}
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
        {panelOpen && <PanelResizer width={panelWidth} onChange={setPanelWidth} />}

        <main className="map-area">
          {currentMap ? (
            <MapView
              // une carte = un système de coordonnées : on recrée Leaflet à chaque changement
              key={`${currentMap.id}|${calibration[currentMap.normalizedName]?.key ?? "none"}`}
              map={currentMap}
              maps={maps}
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
              showScavExits={showScavExits}
              onPhotos={showPhotos}
              onExit={showExitPhotos}
              onQuest={showQuest}
            />
          ) : (
            <div className="map-empty muted">{load.status === "loading" ? tr("Chargement…", "Loading…") : tr("Aucune map.", "No map.")}</div>
          )}
          {placing && (
            <button className="btn cancel-placing" onClick={() => setPlacing(null)}>
              {tr("Annuler le placement", "Cancel placement")}
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
