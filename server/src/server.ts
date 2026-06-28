import { createApp } from "./app.js";
import { env } from "./env.js";
import { scheduleSyncJob } from "./jobs/syncJob.js";

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`Polla Mundial 26 API escuchando en puerto ${env.PORT}`);
});

scheduleSyncJob();
