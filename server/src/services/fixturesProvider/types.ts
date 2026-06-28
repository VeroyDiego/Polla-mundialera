export type Round = "ROUND_32" | "ROUND_16" | "QUARTERFINAL" | "SEMIFINAL" | "THIRD_PLACE" | "FINAL";

export type FixtureStatus = "SCHEDULED" | "FINISHED";

/** Forma común a la que cualquier proveedor externo debe traducir sus datos. */
export interface NormalizedFixture {
  /** ID estable de la fuente externa (no de nuestros equipos/nombres). */
  externalId: string;
  round: Round;
  homeTeam: string;
  awayTeam: string;
  /** UTC */
  kickoff: Date;
  status: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
}

export interface FixturesProvider {
  /** Nombre corto del proveedor, usado en logs y en el campo `source` de los partidos. */
  readonly name: string;
  fetchFixtures(): Promise<NormalizedFixture[]>;
}
