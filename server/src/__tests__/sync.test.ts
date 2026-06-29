import { describe, expect, it } from "vitest";
import { computeSyncPlan, type ExistingMatchRecord } from "../services/sync.js";
import type { NormalizedFixture } from "../services/fixturesProvider/types.js";

function seedMatch(overrides: Partial<ExistingMatchRecord> = {}): ExistingMatchRecord {
  return {
    id: "seed-1",
    externalId: null,
    round: "ROUND_32",
    homeTeam: "Sudáfrica",
    awayTeam: "Canadá",
    kickoff: new Date("2026-06-28T19:00:00Z"),
    homeScore: null,
    awayScore: null,
    status: "SCHEDULED",
    manuallyFixed: false,
    ...overrides
  };
}

function fixture(overrides: Partial<NormalizedFixture> = {}): NormalizedFixture {
  return {
    externalId: "football-data:1001",
    round: "ROUND_32",
    homeTeam: "South Africa",
    awayTeam: "Canada",
    kickoff: new Date("2026-06-28T19:00:00Z"),
    status: "SCHEDULED",
    ...overrides
  };
}

describe("computeSyncPlan", () => {
  it("crea un partido nuevo cuando no hay nada parecido en la base", () => {
    const plan = computeSyncPlan([], [fixture()]);
    expect(plan.creates).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates[0]).toMatchObject({
      externalId: "football-data:1001",
      homeTeam: "Sudáfrica",
      awayTeam: "Canadá",
      round: "ROUND_32"
    });
  });

  it("reclama un partido semilla sin externalId emparejando por ronda + equipos traducidos", () => {
    const plan = computeSyncPlan([seedMatch()], [fixture()]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({
      id: "seed-1",
      data: { externalId: "football-data:1001" }
    });
  });

  it("crea un partido de la llave con equipos por definir (placeholder)", () => {
    const plan = computeSyncPlan(
      [],
      [fixture({ externalId: "football-data:2001", round: "ROUND_16", homeTeam: "Por definir", awayTeam: "Por definir" })]
    );
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]).toMatchObject({ round: "ROUND_16", homeTeam: "Por definir", awayTeam: "Por definir" });
  });

  it("completa los nombres cuando un partido 'Por definir' ya tiene equipos", () => {
    const placeholder = seedMatch({
      id: "m16",
      externalId: "football-data:2001",
      round: "ROUND_16",
      homeTeam: "Por definir",
      awayTeam: "Por definir"
    });
    const plan = computeSyncPlan(
      [placeholder],
      [fixture({ externalId: "football-data:2001", round: "ROUND_16", homeTeam: "Brazil", awayTeam: "Japan" })]
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].data).toMatchObject({ homeTeam: "Brasil", awayTeam: "Japón" });
  });

  it("nunca baja un nombre real a 'Por definir'", () => {
    const real = seedMatch({
      id: "m16",
      externalId: "football-data:2001",
      round: "ROUND_16",
      homeTeam: "Brasil",
      awayTeam: "Japón"
    });
    const plan = computeSyncPlan(
      [real],
      [fixture({ externalId: "football-data:2001", round: "ROUND_16", homeTeam: "Por definir", awayTeam: "Por definir" })]
    );
    expect(plan.updates).toHaveLength(0);
  });

  it("no toca los nombres de un partido fijado a mano", () => {
    const manual = seedMatch({
      id: "m16",
      externalId: "football-data:2001",
      round: "ROUND_16",
      homeTeam: "Por definir",
      awayTeam: "Por definir",
      manuallyFixed: true
    });
    const plan = computeSyncPlan(
      [manual],
      [fixture({ externalId: "football-data:2001", round: "ROUND_16", homeTeam: "Brazil", awayTeam: "Japan" })]
    );
    expect(plan.updates).toHaveLength(0);
  });

  it("es idempotente: correr el mismo fixture dos veces sobre el resultado ya aplicado no genera cambios", () => {
    const claimed = seedMatch({ externalId: "football-data:1001" });
    const plan = computeSyncPlan([claimed], [fixture()]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
  });

  it("no duplica un partido aunque corra dos veces seguidas sobre el mismo estado inicial", () => {
    const existing = seedMatch();
    const firstRun = computeSyncPlan([existing], [fixture()]);
    const afterFirstRun: ExistingMatchRecord = { ...existing, externalId: firstRun.updates[0].data.externalId! };
    const secondRun = computeSyncPlan([afterFirstRun], [fixture()]);
    expect(secondRun.creates).toHaveLength(0);
    expect(secondRun.updates).toHaveLength(0);
  });

  it("completa el resultado cuando el partido termina y no estaba cargado", () => {
    const existing = seedMatch({ externalId: "football-data:1001" });
    const finished = fixture({ status: "FINISHED", homeScore: 2, awayScore: 1 });
    const plan = computeSyncPlan([existing], [finished]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].data).toMatchObject({ homeScore: 2, awayScore: 1, status: "FINISHED" });
  });

  it("no pisa un resultado marcado como fijado manualmente, incluso si la fuente trae otro marcador", () => {
    const existing = seedMatch({
      externalId: "football-data:1001",
      homeScore: 9,
      awayScore: 9,
      status: "FINISHED",
      manuallyFixed: true
    });
    const finished = fixture({ status: "FINISHED", homeScore: 2, awayScore: 1 });
    const plan = computeSyncPlan([existing], [finished]);
    expect(plan.updates).toHaveLength(0);
  });

  it("sigue actualizando el kickoff de un partido fijado manualmente si la fuente lo corrige", () => {
    const existing = seedMatch({
      externalId: "football-data:1001",
      homeScore: 2,
      awayScore: 1,
      status: "FINISHED",
      manuallyFixed: true
    });
    const rescheduled = fixture({ kickoff: new Date("2026-06-28T20:00:00Z"), status: "FINISHED", homeScore: 5, awayScore: 5 });
    const plan = computeSyncPlan([existing], [rescheduled]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].data).toEqual({ kickoff: new Date("2026-06-28T20:00:00Z") });
  });

  it("no incluye el campo de predicciones ni lo necesita como input: el merge sólo opera sobre partidos", () => {
    const existing = seedMatch({ externalId: "football-data:1001" });
    const plan = computeSyncPlan([existing], [fixture()]);
    for (const update of plan.updates) {
      expect(update.data).not.toHaveProperty("predictions");
    }
  });

  it("no degrada un partido FINISHED a SCHEDULED si la fuente vuelve a reportarlo como programado", () => {
    const existing = seedMatch({ externalId: "football-data:1001", homeScore: 2, awayScore: 1, status: "FINISHED" });
    const staleScheduled = fixture({ status: "SCHEDULED" });
    const plan = computeSyncPlan([existing], [staleScheduled]);
    expect(plan.updates).toHaveLength(0);
  });

  it("actualiza el kickoff cuando la fuente lo corrige para un partido no fijado manualmente", () => {
    const existing = seedMatch({ externalId: "football-data:1001" });
    const rescheduled = fixture({ kickoff: new Date("2026-06-28T21:30:00Z") });
    const plan = computeSyncPlan([existing], [rescheduled]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].data).toEqual({ kickoff: new Date("2026-06-28T21:30:00Z") });
  });

  it("distingue partidos distintos en la misma ronda sin mezclarlos", () => {
    const seedA = seedMatch({ id: "seed-a", homeTeam: "Sudáfrica", awayTeam: "Canadá" });
    const seedB = seedMatch({
      id: "seed-b",
      homeTeam: "Brasil",
      awayTeam: "Japón",
      kickoff: new Date("2026-06-29T17:00:00Z")
    });
    const fixtureB = fixture({
      externalId: "football-data:1002",
      homeTeam: "Brazil",
      awayTeam: "Japan",
      kickoff: new Date("2026-06-29T17:00:00Z")
    });
    const plan = computeSyncPlan([seedA, seedB], [fixtureB]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe("seed-b");
  });

  it("crea partidos nuevos de rondas futuras aún no confirmadas sin afectar los existentes", () => {
    const existing = seedMatch({ externalId: "football-data:1001" });
    const quarterFinal = fixture({
      externalId: "football-data:2001",
      round: "QUARTERFINAL",
      homeTeam: "Brazil",
      awayTeam: "Germany",
      kickoff: new Date("2026-07-10T18:00:00Z")
    });
    const plan = computeSyncPlan([existing], [quarterFinal]);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0].round).toBe("QUARTERFINAL");
    expect(plan.updates).toHaveLength(0);
  });
});
