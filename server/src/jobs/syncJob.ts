import cron from "node-cron";
import { env } from "../env.js";
import { createFixturesProvider } from "../services/fixturesProvider/index.js";
import { computeSyncPlan } from "../services/sync.js";
import { createMatchFromSync, insertSyncLog, listAllMatchesForSync, updateMatchFromSync } from "../repo.js";

export interface SyncRunResult {
  success: boolean;
  newMatches: number;
  updatedMatches: number;
  warnings: string[];
  errorMessage?: string;
}

/**
 * Corre una sincronización completa: trae fixtures del proveedor activo,
 * calcula el plan de merge contra el estado actual y lo aplica.
 * Cualquier error (timeout, rate limit, JSON vacío) se atrapa acá: nunca
 * lanza hacia arriba, sólo devuelve `success: false` para que el caller
 * lo registre y reintente en la siguiente corrida.
 */
export async function runSync(): Promise<SyncRunResult> {
  const warnings: string[] = [];
  const provider = createFixturesProvider((msg) => warnings.push(msg));

  try {
    const fixtures = await provider.fetchFixtures();
    const existing = await listAllMatchesForSync();
    const plan = computeSyncPlan(existing, fixtures);

    for (const create of plan.creates) {
      await createMatchFromSync(create);
    }
    for (const update of plan.updates) {
      await updateMatchFromSync(update.id, update.data);
    }

    await insertSyncLog({
      success: true,
      newMatches: plan.creates.length,
      updatedMatches: plan.updates.length,
      warnings: warnings.length > 0 ? warnings.join("; ") : null,
      errorMessage: null
    });

    return { success: true, newMatches: plan.creates.length, updatedMatches: plan.updates.length, warnings };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await insertSyncLog({
      success: false,
      newMatches: 0,
      updatedMatches: 0,
      warnings: warnings.length > 0 ? warnings.join("; ") : null,
      errorMessage
    });
    return { success: false, newMatches: 0, updatedMatches: 0, warnings, errorMessage };
  }
}

export function scheduleSyncJob(): void {
  const intervalMinutes = Math.max(1, env.SYNC_INTERVAL_MINUTES);
  const expression = `*/${intervalMinutes} * * * *`;

  cron.schedule(expression, () => {
    runSync().catch((err) => {
      // No debería llegar acá (runSync atrapa sus propios errores), pero por si acaso
      // no se cae el proceso por un fallo inesperado del job programado.
      console.error("Error inesperado en el job de sincronización:", err);
    });
  });

  console.log(`Job de sincronización programado cada ${intervalMinutes} minuto(s).`);
}
