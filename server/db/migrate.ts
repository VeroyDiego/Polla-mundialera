import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Esquema aplicado correctamente.");
  await pool.end();
}

main().catch((err) => {
  console.error("Error aplicando el esquema:", err);
  process.exit(1);
});
