import { describe, expect, it } from "vitest";
import { computePoints, isCorrectOutcome, isExactMatch } from "../services/scoring.js";

const DEFAULT_SETTINGS = { exactScorePoints: 3, resultOnlyPoints: 1 };

describe("computePoints", () => {
  it("otorga los puntos de marcador exacto cuando la predicción coincide 1 a 1", () => {
    const points = computePoints({ homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 1 }, DEFAULT_SETTINGS);
    expect(points).toBe(3);
  });

  it("otorga los puntos de marcador exacto en un empate exacto", () => {
    const points = computePoints({ homeScore: 1, awayScore: 1 }, { homeScore: 1, awayScore: 1 }, DEFAULT_SETTINGS);
    expect(points).toBe(3);
  });

  it("otorga los puntos de resultado correcto cuando acierta el ganador pero no el marcador", () => {
    const points = computePoints({ homeScore: 3, awayScore: 1 }, { homeScore: 1, awayScore: 0 }, DEFAULT_SETTINGS);
    expect(points).toBe(1);
  });

  it("otorga los puntos de resultado correcto cuando acierta el empate sin el marcador exacto", () => {
    const points = computePoints({ homeScore: 1, awayScore: 1 }, { homeScore: 2, awayScore: 2 }, DEFAULT_SETTINGS);
    expect(points).toBe(1);
  });

  it("otorga 0 puntos cuando predice ganador local y el visitante gana", () => {
    const points = computePoints({ homeScore: 2, awayScore: 0 }, { homeScore: 0, awayScore: 1 }, DEFAULT_SETTINGS);
    expect(points).toBe(0);
  });

  it("otorga 0 puntos cuando predice empate y el partido no termina en empate", () => {
    const points = computePoints({ homeScore: 1, awayScore: 1 }, { homeScore: 2, awayScore: 1 }, DEFAULT_SETTINGS);
    expect(points).toBe(0);
  });

  it("respeta valores de puntaje configurados distintos del default", () => {
    const settings = { exactScorePoints: 5, resultOnlyPoints: 2 };
    expect(computePoints({ homeScore: 0, awayScore: 0 }, { homeScore: 0, awayScore: 0 }, settings)).toBe(5);
    expect(computePoints({ homeScore: 0, awayScore: 1 }, { homeScore: 0, awayScore: 3 }, settings)).toBe(2);
  });
});

describe("isExactMatch / isCorrectOutcome", () => {
  it("distingue marcador exacto de solo resultado correcto", () => {
    const result = { homeScore: 2, awayScore: 0 };
    expect(isExactMatch({ homeScore: 2, awayScore: 0 }, result)).toBe(true);
    expect(isExactMatch({ homeScore: 1, awayScore: 0 }, result)).toBe(false);
    expect(isCorrectOutcome({ homeScore: 1, awayScore: 0 }, result)).toBe(true);
    expect(isCorrectOutcome({ homeScore: 0, awayScore: 1 }, result)).toBe(false);
  });
});
