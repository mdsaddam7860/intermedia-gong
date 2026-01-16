import cron from "node-cron";
import { logger, getGongAccessToken } from "../index.js";
import { syncIntermediaToGong } from "../controllers/gong.controller.js";

let isRunning = false; // in-process lock

const startIntermediaPolling = () => {
  // Run Every minute Scheduler (1 * * * *)
  logger.info("Scheduler Imported: Intermedia Poller");
  cron.schedule("0 * * * *", async () => {
    if (isRunning) {
      logger.warn("Intermedia poll skipped: previous run still in progress");
      return;
    }

    isRunning = true;
    logger.info("Intermedia polling started");

    try {
      const token = await getGongAccessToken();
      logger.info(`Gong access token: ${token.slice(0, 10)}...`);
      await syncIntermediaToGong();
      logger.info("Intermedia polling completed successfully");
    } catch (error) {
      logger.error("Intermedia polling failed", error);
    } finally {
      isRunning = false;
    }
  });
};

export { startIntermediaPolling };
