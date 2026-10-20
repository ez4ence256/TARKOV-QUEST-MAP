import { describe, expect, it } from "vitest";
import { isStaleBuildError } from "./staleBuild";

describe("page ouverte avant une mise à jour du site", () => {
  it("reconnaît l'échec de chargement d'un module (Chrome, Firefox, Safari)", () => {
    expect(isStaleBuildError(new TypeError("Failed to fetch dynamically imported module: https://tarkov.aprilox.fr/assets/ocr-DdHdfv1C.js"))).toBe(true);
    expect(isStaleBuildError(new TypeError("error loading dynamically imported module: https://x/assets/ocr.js"))).toBe(true);
    expect(isStaleBuildError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleBuildError(new Error("Network error"))).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
  });
});
