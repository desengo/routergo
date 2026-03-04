import { runDispatchEngine } from "./dispatchEngine";

let running = false;

export function startDispatchLoop() {

  if (running) return;

  running = true;

  setInterval(async () => {

    try {

      await runDispatchEngine();

    } catch (err) {

      console.error("Dispatch loop error", err);

    }

  }, 10000);

}