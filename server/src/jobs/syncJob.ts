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
  const intervalMinutes = Number.isFinite(env.SYNC_INTERVAL_MINUTES)
    ? Math.max(1, Math.floor(env.SYNC_INTERVAL_MINUTES))
    : 45;

  // setInterval en vez de una expresión cron `*/N`: el campo de minutos de cron
  // sólo va de 0 a 59, así que `*/45` dispararía en :00 y :45 (no cada 45 min) y
  // cualquier N > 60 degradaría a una vez por hora. setInterval respeta "cada N
  // minutos" para cualquier valor configurado.
  const safeRun = () => {
    runSync().catch((err) => {
      // runSync atrapa sus propios errores; esto es sólo un cinturón extra para
      // que un fallo inesperado nunca tumbe el proceso.
      console.error("Error inesperado en el job de sincronización:", err);
    });
  };

  // Una corrida inicial poco después de arrancar deja la base al día sin esperar
  // el primer intervalo (útil cuando el hosting free duerme y despierta por tráfico).
  setTimeout(safeRun, 10_000);
  setInterval(safeRun, intervalMinutes * 60_000);

  console.log(`Job de sincronización programado cada ${intervalMinutes} minuto(s).`);
}
