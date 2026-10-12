import { describe, expect, it } from "vitest";
import { infoboxImage } from "./mapImages";

describe("infoboxImage", () => {
  it("lit l'image de l'infobox", () => {
    expect(infoboxImage("{{Infobox location\n|image              =Customs Banner.png\n|image size         =\n}}")).toBe("Customs Banner.png");
    expect(infoboxImage("{{Infobox location\n| image = File:banner woods.png\n}}")).toBe("banner woods.png");
  });
  it("renvoie null sans image", () => {
    expect(infoboxImage("{{Infobox location\n|image =\n|image size =\n}}")).toBeNull();
  });
});
