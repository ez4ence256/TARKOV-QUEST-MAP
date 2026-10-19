// Composant racine : choix du mode, chargement des données, panneau + carte.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMap, Objective, TarkovData, Task } from "./types";
import { GAME_MODES } from "./types";
import { loadTarkovData } from "./api/cache";
import { BUNDLED_CALIBRATION, loadCalibration } from "./map/calibration";
import { MapView, type Placing } from "./map/MapView";
import type { ItemSpotMarker } from "./map/ItemSpotsLayer";
import { exportState, getLastMode, useAppState, type CustomPoint } from "./state/store";
import { QUEST_COLORS } from "./lib/objectiveTypes";
import { buildObjectivePoints, isTaskFinished, manualPointKey, questsUnlockedBy, shownObjectives, taskMapIds } from "./lib/points";
import { ModePicker } from "./components/ModePicker";
import { QuestList } from "./components/QuestList";
import { SelectedQuests } from "./components/SelectedQuests";
import { CustomPointsTab } from "./components/CustomPointsTab";
import { SettingsTab } from "./components/SettingsTab";
import { PhotosTab, type ExitPhotosTarget, type StoryPhotosTarget } from "./components/PhotosTab";
import { ResetProgressSection } from "./components/ResetProgressSection";
import { QuestTab } from "./components/QuestTab";
import { CaptureTab } from "./components/CaptureTab";
import { dominantMap } from "./lib/ocrMatch";
import { PanelResizer } from "./components/PanelResizer";
import { getLang, setLang as applyLang, tr, type Lang } from "./lib/i18n";
import { clampPanelWidth, readPanelWidth } from "./lib/panelWidth";
import { storyIdOf, storyStepId } from "./lib/story";
import { chaptersWithPositions, currentStoryPoints, pointsOnMap } from "./lib/storyPoints";
import { chapterName, useStoryItems } from "./components/StoryView";
import { inRoom, useRoom } from "./api/room";
import { branchFailures, prerequisiteChanges } from "./lib/questChain";
import { computeNeeds } from "./lib/itemNeeds";
import { loadHideout, type HideoutStation } from "./api/itemList";
import { buildEventTasks, loadEventEntries, type EventEntry } from "./api/eventQuests";
import { RoomControl } from "./components/RoomControl";
import { MapPicker } from "./components/MapPicker";
import { Rail, type RailGroup } from "./components/Rail";
import { RaidCard } from "./components/RaidCard";
import { FirstVisitHelp, helpWanted, resetHelp } from "./components/FirstVisitHelp";
import { ItemFinder } from "./components/ItemFinder";
import { TraderWindow } from "./components/TraderWindow";
import { Lightbox } from "./components/Lightbox";
import { UnlockToast } from "./components/UnlockToast";

type Tab = "selection" | "quests" | "capture" | "quest" | "photos" | "custom" | "settings";

const TABS: Tab[] = ["selection", "quests", "capture", "quest", "photos", "custom", "settings"];
/** Groupe de la barre latérale auquel appartient chaque vue du panneau. */
const TAB_GROUP: Record<Tab, RailGroup> = { selection: "selection", quests: "add", capture: "add", quest: "detail", photos: "detail", custom: "custom", settings: "settings" };
const GROUP_FIRST: Record<RailGroup, Tab> = { selection: "selection", add: "quests", detail: "quest", custom: "custom", settings: "settings" };
/** Groupes à deux vues : petit sélecteur en haut du panneau. */
const SUBS: Partial<Record<RailGroup, [Tab, [string, string]][]>> = {
  add: [["quests", ["Rechercher", "Search"]], ["capture", ["Capture (Ctrl+V)", "Capture (Ctrl+V)"]]],
  detail: [["quest", ["Infos", "Info"]], ["photos", ["Photos", "Photos"]]],
};
const readTab = (): Tab => {
  try {
    const t = localStorage.getItem("tqp:tab");
    return TABS.find((x) => x === t) ?? "selection";
  } catch {
    return "selection";
  }
};
type LoadState =
  | { status: "loading"; data: TarkovData | null }
  | { status: "ready"; data: TarkovData; source: "cache" | "network" | "stale"; error?: string }
  | { status: "error"; data: null; error: string };

const NO_NAMES: Record<string, string> = {};
const NO_DONE: Record<string, true> = {};
const raidSaved = () => {
  try {
    return localStorage.getItem("tqp:raid") === "1";
  } catch {
    return false;
  }
};
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
  const [tab, setTab] = useState<Tab>(readTab);
  // dernière vue utilisée dans chaque groupe de la barre latérale ; la vue courante est retenue entre deux visites
  const lastTab = useRef<Partial<Record<RailGroup, Tab>>>({});
  useEffect(() => {
    lastTab.current[TAB_GROUP[tab]] = tab;
    try {
      localStorage.setItem("tqp:tab", tab);
    } catch {
      /* préférence non retenue */
    }
  }, [tab]);
  /** Quête affichée dans l'onglet Photos. */
  const [tabTaskId, setTabTaskId] = useState<string | null>(null);
  // sortie cliquée sur la carte : l'onglet Photos montre la sienne plutôt que celles d'une quête
  const [photoExit, setPhotoExit] = useState<ExitPhotosTarget | null>(null);
  const [photoStory, setPhotoStory] = useState<StoryPhotosTarget | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => !isMobile() && !raidSaved());
  /** Largeur du panneau sur ordinateur (poignée de redimensionnement, enregistrée). */
  const [panelWidth, setPanelWidth] = useState(() => readPanelWidth(window.innerWidth));
  // fenêtre réduite : la largeur reste dans les bornes (sans écraser la valeur enregistrée)
  useEffect(() => {
    const onResize = () => setPanelWidth((w) => clampPanelWidth(w, window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // mode raid : carte flottante des objectifs de la map, panneau fermé ; retenu dans le navigateur
  const [raid, setRaid] = useState(raidSaved);
  const changeRaid = (on: boolean) => {
    setRaid(on);
    if (on) setPanelOpen(false);
    try {
      localStorage.setItem("tqp:raid", on ? "1" : "0");
    } catch {
      /* préférence non retenue */
    }
  };
  const [placing, setPlacing] = useState<Placing>(null);
  const [focus, setFocus] = useState<{ key: string; n: number } | null>(null);
  // meilleurs spots d'un objet (item finder) affichés sur la carte, jusqu'à ce qu'on les retire
  const [itemSpots, setItemSpots] = useState<ItemSpotMarker[]>([]);

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

  // une quête vient d'être terminée -> proposer celles qu'elle débloque (petite fenêtre en haut à droite)
  const finishedIds = useMemo(() => new Set(tasks.filter((t) => isTaskFinished(t, mode.done)).map((t) => t.id)), [tasks, mode.done]);
  const muteUnlock = useRef(false);
  const prevFinished = useRef<{ key: string; ids: Set<string> } | null>(null);
  const [unlockOffer, setUnlockOffer] = useState<{ done: Task; next: Task[] } | null>(null);
  useEffect(() => {
    const key = `${gameMode}|${tasks.length}`;
    const prev = prevFinished.current;
    prevFinished.current = { key, ids: finishedIds };
    // prérequis grisés par l'app (activation d'une quête) : jamais de proposition
    if (muteUnlock.current) {
      muteUnlock.current = false;
      return;
    }
    // premier calcul (chargement, autre mode) : rien à proposer ; plusieurs d'un coup (import, room) : non plus
    if (!prev || prev.key !== key) return;
    const newly = tasks.filter((t) => finishedIds.has(t.id) && !prev.ids.has(t.id));
    if (newly.length !== 1) return;
    const selected = new Set(mode.selected.map((s) => s.taskId));
    const next = questsUnlockedBy(newly[0], tasks, mode.done).filter((t) => !selected.has(t.id));
    setUnlockOffer(next.length ? { done: newly[0], next } : null);
  }, [finishedIds]);
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

  // Nombre de points restants par map (affiché dans le sélecteur de map), et quêtes qui y ont ces points
  const { pointsPerMap, questsPerMap } = useMemo(() => {
    const counts = new Map<string, number>();
    const quests = new Map<string, Set<string>>();
    const add = (mapId: string, taskId: string) => {
      counts.set(mapId, (counts.get(mapId) ?? 0) + 1);
      quests.set(mapId, (quests.get(mapId) ?? new Set()).add(taskId));
    };
    for (const t of selectedTasks)
      for (const o of shownObjectives(t, mode.done, false, oneAtATime)) {
        for (const l of o.locations) add(l.mapId, t.id);
        const manual = mode.manual[o.id];
        if (o.locations.length === 0 && manual) add(manual.mapId, t.id);
      }
    return { pointsPerMap: counts, questsPerMap: quests };
  }, [selectedTasks, mode.done, mode.manual, oneAtATime]);

  // Main story : case en cours des chapitres choisis qui ont une position relevée sur le wiki
  const storyIds = useMemo(() => (mode.story?.selected ?? []).filter((c) => chaptersWithPositions().includes(c)), [mode.story?.selected]);
  const { items: storyItems, chapters: storyChapters } = useStoryItems(storyIds, data?.itemNames ?? NO_NAMES);
  const storyDone = mode.story?.done ?? NO_DONE;
  const storyPointsAll = useMemo(() => storyIds.flatMap((c) => currentStoryPoints(c, storyItems[c] ?? [], storyDone)), [storyIds, storyItems, storyDone]);
  const storyPoints = useMemo(() => pointsOnMap(storyPointsAll, currentMap?.normalizedName), [storyPointsAll, currentMap]);
  // la case en cours de la Main story compte aussi dans le sélecteur de map
  const { mapCounts, questsOnMap } = useMemo(() => {
    const counts = new Map(pointsPerMap);
    const onMap = new Map([...questsPerMap].map(([id, s]) => [id, new Set(s)]));
    for (const p of storyPointsAll) {
      const id = maps.find((m) => m.normalizedName === p.map)?.id;
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      onMap.set(id, (onMap.get(id) ?? new Set()).add(storyIdOf(p.chapter)));
    }
    return { mapCounts: counts, questsOnMap: onMap };
  }, [pointsPerMap, questsPerMap, storyPointsAll, maps]);
  const storyName = useCallback((chapter: string) => chapterName(storyChapters, chapter), [storyChapters]);
  const setStoryStep = (chapter: string, stepKey: string, value: boolean) => dispatch({ type: "setStoryStep", chapter, stepKey, done: value });

  // chapitre qui vient d'être choisi ou dont une case vient d'être cochée : si sa case en cours est sur une autre map, on y va
  const pendingStory = useRef(new Set<string>());
  const prevStory = useRef<{ mode: string | null; selected: string[]; done: Record<string, true> } | null>(null);
  useEffect(() => {
    const cur = { mode: gameMode, selected: mode.story?.selected ?? [], done: storyDone };
    const prev = prevStory.current;
    prevStory.current = cur;
    if (!prev || prev.mode !== cur.mode) return; // premier rendu ou changement de mode : rien à suivre
    const count = (done: Record<string, true>, c: string) => Object.keys(done).filter((k) => k.startsWith(storyStepId(c, ""))).length;
    for (const c of cur.selected)
      if (chaptersWithPositions().includes(c) && (!prev.selected.includes(c) || count(prev.done, c) !== count(cur.done, c))) pendingStory.current.add(c);
  }, [gameMode, mode.story?.selected, storyDone]);
  useEffect(() => {
    if (pendingStory.current.size === 0 || !currentMap) return;
    for (const c of [...pendingStory.current]) {
      if (!storyIds.includes(c)) pendingStory.current.delete(c);
      else if (storyItems[c]) {
        pendingStory.current.delete(c);
        const mine = storyPointsAll.filter((p) => p.chapter === c);
        const target = mine.length > 0 && !mine.some((p) => p.map === currentMap.normalizedName) ? maps.find((m) => m.normalizedName === mine[0].map) : undefined;
        if (!target) continue;
        dispatch({ type: "setMap", mapId: target.id });
        setMapNotice(tr(`Map affichée : ${target.name} (le point de « ${storyName(c)} » s'y trouve).`, `Displayed map: ${target.name} (the point of "${storyName(c)}" is there).`));
      }
    }
  }, [storyIds, storyItems, storyPointsAll, currentMap, maps, storyName]);

  const customPoints = useMemo(
    () => mode.customPoints.filter((p) => p.mapId === currentMap?.id),
    [mode.customPoints, currentMap],
  );

  // ouvre l'onglet Quête ou Photos sur une quête (boutons de la liste, du panneau ou d'une popup)
  const showTaskTab = useCallback((taskId: string, which: "quest" | "photos") => {
    setTabTaskId(taskId);
    if (which === "photos") {
      setPhotoExit(null);
      setPhotoStory(null);
    }
    setTab(which);
    setPanelOpen(true);
  }, []);
  const showExitPhotos = useCallback((target: ExitPhotosTarget) => {
    setPhotoExit(target);
    setPhotoStory(null);
    setTab("photos");
    setPanelOpen(true);
  }, []);
  // photos de la case en cours d'un chapitre (bulle d'un point de la Main story) : seulement la
  // sous-partie de l'étape où le wiki place la carte dont vient le point (ex. « Woods »), si on la trouve
  const showStoryPhotos = (chapter: string, stepKey: string, source?: string) => {
    const item = storyItems[chapter]?.find((i) => i.key === stepKey);
    const all = item?.photos ?? [];
    const sameFile = (a: string, b: string) => a.replace(/_/g, " ").toLowerCase() === b.replace(/_/g, " ").toLowerCase();
    const section = source ? all.find((p) => sameFile(p.file, source))?.section : undefined;
    const photos = section === undefined ? all : all.filter((p) => p.section === section);
    setPhotoStory({ title: `${storyName(chapter)} - ${item?.title ?? stepKey}`, photos, sections: item?.sections, pageUrl: item?.pageUrl, pageTitle: item?.pageTitle });
    setPhotoExit(null);
    setTab("photos");
    setPanelOpen(true);
  };
  const showPhotos = useCallback((taskId: string) => showTaskTab(taskId, "photos"), [showTaskTab]);
  const showQuest = useCallback((taskId: string) => showTaskTab(taskId, "quest"), [showTaskTab]);

  // Ctrl+V d'une image n'importe où (sauf dans un champ de texte, et sauf quand l'item finder est ouvert : il lit la capture lui-même) : import par capture
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
  const [showHelp, setShowHelp] = useState(helpWanted);
  const failed = mode.failed ?? NO_DONE;
  // objets à garder : quêtes pas faites (+ prochains niveaux de la planque si l'option est active)
  const includeHideout = state.includeHideout === true;
  const [stationsLoad, setStationsLoad] = useState<{ stations: HideoutStation[] | null; error: boolean }>({ stations: null, error: false });
  const wantStations = includeHideout;
  useEffect(() => {
    if (!gameMode || !wantStations) return;
    let cancelled = false;
    setStationsLoad({ stations: null, error: false });
    loadHideout(gameMode, lang).then(
      (h) => !cancelled && setStationsLoad({ stations: h.stations, error: false }),
      () => !cancelled && setStationsLoad({ stations: null, error: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [gameMode, lang, wantStations]);
  const needs = useMemo(
    () =>
      computeNeeds({
        tasks,
        done: mode.done,
        failed: mode.failed,
        faction: mode.faction,
        ...(includeHideout && stationsLoad.stations ? { stations: stationsLoad.stations, hideoutLevels: mode.hideout ?? {} } : {}),
      }),
    [tasks, mode.done, mode.failed, mode.faction, mode.hideout, includeHideout, stationsLoad.stations],
  );
  // information avec « Annuler » après un grisage automatique (prérequis, branches exclusives)
  const [chainNotice, setChainNotice] = useState<{ text: string; undo?: () => void } | null>(null);
  useEffect(() => setChainNotice(null), [gameMode]);
  /**
   * Une seule action : coche les objectifs des quêtes `complete`, marque `fail` échouées, les sort de la sélection.
   * `replace` : la sélection est remplacée (rien à retirer ni à rétablir). Retourne rien si rien ne change.
   */
  const applyGrey = (complete: string[], fail: string[], text: (k: number, f: number) => string, replace = false) => {
    const ticks = complete.flatMap((id) => (tasksById.get(id)?.objectives ?? []).filter((o) => !mode.done[o.id]).map((o) => o.id));
    const newFail = fail.filter((id) => !failed[id]);
    const sel = new Set(replace ? [] : mode.selected.map((s) => s.taskId));
    const deselect = [...new Set([...complete, ...newFail])].filter((id) => sel.has(id));
    if (!ticks.length && !newFail.length) return;
    if (ticks.length) muteUnlock.current = true;
    dispatch({ type: "applyQuestStatus", done: ticks, failed: newFail, deselect });
    setChainNotice({
      text: text(complete.length, newFail.length),
      undo: () => dispatch({ type: "applyQuestStatus", done: [], undone: ticks, failed: [], unfailed: newFail, select: deselect }),
    });
  };
  // Grise les prérequis des quêtes qu'on vient d'activer. Actions locales seulement (jamais au chargement,
  // à l'import ni via une room : les cases cochées y seraient envoyées à tout le groupe).
  const greyPrerequisites = (added: Task[], replace = false) => {
    const addedIds = new Set(added.map((t) => t.id));
    const complete = new Set<string>();
    const fail = new Set<string>();
    for (const t of added) {
      const c = prerequisiteChanges(t.id, tasks, mode.done, failed);
      c.complete.forEach((id) => complete.add(id));
      c.failed.forEach((id) => fail.add(id));
    }
    for (const id of [...addedIds, ...complete]) fail.delete(id);
    for (const id of addedIds) complete.delete(id);
    if (!complete.size && !fail.size) return;
    if (inRoom()) {
      setChainNotice({
        text: tr(
          "Room en cours : les prérequis ne sont pas grisés automatiquement (tes quêtes resteraient mélangées avec celles du groupe).",
          "Room in progress: prerequisites are not greyed out automatically (your quests would get mixed with the group's).",
        ),
      });
      return;
    }
    applyGrey([...complete], [...fail], (k, f) => tr(`${k + f} quête(s) prérequise(s) grisée(s) (${k} terminée(s), ${f} échouée(s)).`, `${k + f} prerequisite quest(s) greyed out (${k} completed, ${f} failed).`), replace);
  };
  const toggleTask = (taskId: string) => {
    const adding = !mode.selected.some((s) => s.taskId === taskId);
    dispatch({ type: "toggleTask", taskId });
    const task = tasksById.get(taskId);
    if (task && adding) greyPrerequisites([task]);
    if (!task || !adding || !currentMap) return;
    const shown = { objectives: shownObjectives(task, mode.done, false, oneAtATime) };
    const target = dominantMap([shown], 0);
    if (!target || target === currentMap.id || shown.objectives.some((o) => o.locations.some((l) => l.mapId === currentMap.id))) return;
    dispatch({ type: "setMap", mapId: target });
    const name = maps.find((m) => m.id === target)?.name ?? "";
    setMapNotice(tr(`Map affichée : ${name} (les points de « ${task.name} » s'y trouvent).`, `Displayed map: ${name} (the points of "${task.name}" are there).`));
  };
  // marque tous les objectifs faits, puis retire la quête de la sélection (l'UnlockToast propose la suite)
  // (et fait échouer ses branches exclusives, hors room : la sélection y est partagée)
  const completeTask = (task: Task) => {
    const ticks = task.objectives.filter((o) => !mode.done[o.id]).map((o) => o.id);
    const branch = inRoom() ? [] : branchFailures([task.id], tasks, mode.done, failed, new Set([task.id]));
    const sel = new Set(mode.selected.map((s) => s.taskId));
    const deselect = [task.id, ...branch].filter((id) => sel.has(id));
    dispatch({ type: "applyQuestStatus", done: ticks, failed: branch, deselect });
    if (branch.length)
      setChainNotice({
        text: tr(`${branch.length} quête(s) de branche exclusive marquée(s) échouée(s).`, `${branch.length} quest(s) of an exclusive branch marked as failed.`),
        undo: () => dispatch({ type: "applyQuestStatus", done: [], undone: ticks, failed: [], unfailed: branch, select: deselect }),
      });
  };
  const failTask = (task: Task) =>
    dispatch({ type: "applyQuestStatus", done: [], failed: [task.id], deselect: mode.selected.some((s) => s.taskId === task.id) ? [task.id] : [] });
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
      <Lightbox />
      <Rail
        modeLabel={modeLabel}
        onModeBadge={() => dispatch({ type: "setGameMode", mode: null })}
        active={panelOpen ? TAB_GROUP[tab] : null}
        selectedCount={mode.selected.length + (mode.story?.selected.length ?? 0)}
        onGroup={(g) => {
          if (panelOpen && TAB_GROUP[tab] === g) setPanelOpen(false); // comme VS Code : reclic = fermer
          else {
            setTab(lastTab.current[g] ?? GROUP_FIRST[g]);
            setPanelOpen(true);
          }
        }}
        raid={raid}
        onRaid={() => changeRaid(!raid)}
        lang={lang}
        onLang={changeLang}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((o) => !o)}
        finder={
          <ItemFinder variant="rail" gameMode={gameMode} lang={lang} tasks={tasks} traders={data?.traders ?? []} maps={maps} itemNames={data?.itemNames ?? NO_NAMES} itemIcons={data?.itemIcons ?? NO_NAMES} onShowQuest={showQuest}
            done={mode.done}
            failed={failed}
            needs={needs}
            onAddPoint={(pt) => {
              const point = { ...pt, id: newId(), createdAt: Date.now() };
              dispatch({ type: "addCustom", point });
              // en fond, la carte passe sur la map du point et le centre (le finder reste ouvert)
              focusPoint(`custom:${point.id}`, point.mapId);
            }}
            onShowSpots={(spots, spot) => {
              setItemSpots(spots);
              focusPoint(spot.key, spot.mapId);
            }}
          />
        }
        traders={<TraderWindow variant="rail" gameMode={gameMode} lang={lang} traders={data?.traders ?? []} tasks={tasks} itemIcons={data?.itemIcons ?? NO_NAMES} />}
        room={<RoomControl variant="rail" room={room} />}
      />

      {/* key : recrée tout l'arbre (popups Leaflet comprises) dans la nouvelle langue */}
      <div className="layout" key={lang}>
        <aside id="side-panel" className={`panel ${panelOpen ? "is-open" : ""}`}>
          {SUBS[TAB_GROUP[tab]] && (
            <div className="subswitch" role="tablist">
              {SUBS[TAB_GROUP[tab]]!.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={`subswitch-btn${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>
                  {tr(...label)}
                </button>
              ))}
            </div>
          )}

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
              onOpen={showQuest}
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
              mapCounts={mapCounts}
              questsOnMap={questsOnMap}
              onComplete={completeTask}
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
              onStoryStep={setStoryStep}
              onStoryReset={(chapter) => dispatch({ type: "resetStory", chapter })}
              done={mode.done}
              failed={failed}
              onActivate={(task) => toggleTask(task.id)}
              onDeactivate={(task) => dispatch({ type: "toggleTask", taskId: task.id })}
              onFail={failTask}
              onSetDone={(objectiveId, value) => dispatch({ type: "setDone", objectiveId, done: value })}
              onReset={(task) => dispatch({ type: "resetProgress", objectiveIds: task.objectives.map((o) => o.id), taskId: task.id })}
              onComplete={completeTask}
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
                greyPrerequisites(added.filter((t) => replace || !mode.selected.some((s) => s.taskId === t.id)), replace);
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
              story={photoStory}
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
              onShowHelp={() => {
                resetHelp();
                setShowHelp(true);
              }}
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
                    dispatch({ type: "resetProgress", objectiveIds: task.objectives.map((o) => o.id), taskId: task.id })
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
          <div className="map-floating">
            <MapPicker maps={maps} currentId={currentMap?.id ?? ""} counts={mapCounts} onPick={showMap} />
            <label className="scav-check">
              <input type="checkbox" checked={showScavExits} onChange={(e) => changeScavExits(e.target.checked)} />
              <span className="scav-check-long">{tr("Extracts Scav", "Scav extracts")}</span>
              <span className="scav-check-short" aria-hidden="true">Scav</span>
            </label>
          </div>
          <div className="map-alerts">
          {unlockOffer && (
            <UnlockToast
              done={unlockOffer.done}
              next={unlockOffer.next}
              onYes={() => {
                dispatch({ type: "selectTasks", taskIds: unlockOffer.next.map((t) => t.id), replace: false });
                // la fiche quête montre la (première) quête débloquée
                setTabTaskId(unlockOffer.next[0].id);
                greyPrerequisites(unlockOffer.next);
                setUnlockOffer(null);
              }}
              onNo={() => setUnlockOffer(null)}
            />
          )}
          {chainNotice && (
            <div className="alert" role="status">
              {chainNotice.text}{" "}
              {chainNotice.undo && (
                <button
                  className="link"
                  onClick={() => {
                    chainNotice.undo!();
                    setChainNotice(null);
                  }}
                >
                  {tr("Annuler", "Undo")}
                </button>
              )}{" "}
              <button className="link" onClick={() => setChainNotice(null)}>
                OK
              </button>
            </div>
          )}
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
          </div>
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
              storyPoints={storyPoints}
              storyName={storyName}
              onStoryDone={(chapter, stepKey) => setStoryStep(chapter, stepKey, true)}
              onStoryOpen={(chapter) => showQuest(storyIdOf(chapter))}
              onStoryPhotos={showStoryPhotos}
              itemSpots={itemSpots}
              onClearItemSpots={() => setItemSpots([])}
              onPhotos={showPhotos}
              onExit={showExitPhotos}
              onQuest={showQuest}
            />
          ) : (
            <div className="map-empty muted">{load.status === "loading" ? tr("Chargement…", "Loading…") : tr("Aucune map.", "No map.")}</div>
          )}
          {raid && currentMap && (
            <RaidCard
              key={currentMap.id}
              mapName={currentMap.name}
              points={points}
              tasksById={tasksById}
              objectivesById={objectivesById}
              colorOf={colorOf}
              done={mode.done}
              onSetDone={(objectiveId, value) => dispatch({ type: "setDone", objectiveId, done: value })}
              storyPoints={storyPoints}
              storyName={storyName}
              onStoryDone={(chapter, stepKey) => setStoryStep(chapter, stepKey, true)}
              onQuit={() => changeRaid(false)}
            />
          )}
          {showHelp && !raid && <FirstVisitHelp onClose={() => setShowHelp(false)} />}
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
