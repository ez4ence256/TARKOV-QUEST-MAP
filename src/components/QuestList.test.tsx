import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QuestList } from "./QuestList";
import type { ModeState } from "../state/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mode = { selected: [], done: {}, failed: {}, manual: {}, hideout: {} } as unknown as ModeState;

describe("QuestList : état vide", () => {
  it("« Effacer la recherche et les filtres » remet la recherche et les cases Kappa / Lightkeeper à zéro", async () => {
    const host = document.createElement("div");
    let kappa = true;
    let lk = true;
    const render = () =>
      act(async () =>
        createRoot(host).render(
          <QuestList tasks={[]} traders={[]} maps={[]} mode={mode} onToggle={() => {}} onOpen={() => {}} onPhotos={() => {}} onClearSelection={() => {}} onShowMap={() => {}} onToggleStory={() => {}} onOpenStory={() => {}} kappaOnly={kappa} onKappaOnly={(v) => (kappa = v)} lightkeeperOnly={lk} onLightkeeperOnly={(v) => (lk = v)} />,
        ),
      );
    vi.stubGlobal("fetch", () => Promise.reject(new Error("hors ligne")));
    await render();
    await act(async () => new Promise((r) => setTimeout(r, 50))); // les chapitres �chouent : la liste vide s'affiche
    const clear = host.querySelector<HTMLButtonElement>(".empty-state button");
    expect(clear).not.toBeNull();
    await act(async () => clear!.click());
    expect([kappa, lk]).toEqual([false, false]);
  });
});
