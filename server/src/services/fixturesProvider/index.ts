import { env } from "../../env.js";
import { FootballDataProvider } from "./footballDataProvider.js";
import { OpenFootballProvider } from "./openFootballProvider.js";
import type { FixturesProvider } from "./types.js";

export * from "./types.js";

export function createFixturesProvider(onWarning?: (message: string) => void): FixturesProvider {
  if (env.FIXTURES_PROVIDER === "openfootball") {
    return new OpenFootballProvider({ onWarning });
  }
  return new FootballDataProvider({
    apiToken: env.FOOTBALL_DATA_API_TOKEN,
    competitionCode: env.FOOTBALL_DATA_COMPETITION_CODE,
    onWarning
  });
}
