export type Round = "ROUND_32" | "ROUND_16" | "QUARTERFINAL" | "SEMIFINAL" | "THIRD_PLACE" | "FINAL";

/**
 * Nombre que usan los partidos de la llave cuyos equipos todavía no están
 * definidos (ej. un Octavos cuyo cruce depende de partidos aún no jugados).
 * Se muestran en la llave y se completan solos cuando la fuente externa asigna
 * los equipos reales.
 */
export const PLACEHOLDER_TEAM = "Por definir";

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
