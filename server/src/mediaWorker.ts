import { processNextMediaJob } from "./services/mediaJobProcessor.js";

let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

async function main() {
  while (!stopping) {
    const processed = await processNextMediaJob();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

void main();
