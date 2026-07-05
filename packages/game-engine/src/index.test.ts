import { describe, expect, it } from "vitest";
import { gameEnginePackage } from "./index";

describe("game engine package", () => {
  it("is scaffolded without game rules", () => {
    expect(gameEnginePackage.name).toBe("@shaxda/game-engine");
  });
});
