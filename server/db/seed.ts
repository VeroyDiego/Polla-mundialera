import { pool } from "../src/db.js";

const SEED_ROUND_32_MATCHES = [
  { homeTeam: "Sudáfrica", awayTeam: "Canadá", kickoff: "2026-06-28T19:00:00Z" },
  { homeTeam: "Brasil", awayTeam: "Japón", kickoff: "2026-06-29T17:00:00Z" },
  { homeTeam: "Alemania", awayTeam: "Paraguay", kickoff: "2026-06-29T20:30:00Z" },
  { homeTeam: "Países Bajos", awayTeam: "Marruecos", kickoff: "2026-06-30T01:00:00Z" },
  { homeTeam: "Costa de Marfil", awayTeam: "Noruega", kickoff: "2026-06-30T17:00:00Z" },
  { homeTeam: "Francia", awayTeam: "Suecia", kickoff: "2026-06-30T21:00:00Z" },
  { homeTeam: "México", awayTeam: "Ecuador", kickoff: "2026-07-01T01:00:00Z" },
  { homeTeam: "Inglaterra", awayTeam: "R.D. del Congo", kickoff: "2026-07-01T16:00:00Z" },
  { homeTeam: "Bélgica", awayTeam: "Senegal", kickoff: "2026-07-01T20:00:00Z" },
  { homeTeam: "Estados Unidos", awayTeam: "Bosnia y Herzegovina", kickoff: "2026-07-02T00:00:00Z" }
];

async function main() {
  for (const m of SEED_ROUND_32_MATCHES) {
    const existing = await pool.query(
      "SELECT id FROM matches WHERE round = 'ROUND_32' AND home_team = $1 AND away_team = $2",
      [m.homeTeam, m.awayTeam]
    );
    if (existing.rows.length > 0) {
      console.log(`Ya existe: ${m.homeTeam} vs ${m.awayTeam}, se omite`);
      continue;
    }
    await pool.query(
      `INSERT INTO matches (round, home_team, away_team, kickoff, status, source)
       VALUES ('ROUND_32', $1, $2, $3, 'SCHEDULED', 'SEED')`,
      [m.homeTeam, m.awayTeam, m.kickoff]
    );
    console.log(`Creado: ${m.homeTeam} vs ${m.awayTeam}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
