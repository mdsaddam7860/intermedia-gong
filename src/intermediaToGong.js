import "dotenv/config";
import { app } from "./app.js";
import { logger } from "./index.js";
import { startIntermediaPolling } from "./schedulers/intermedia.poller.js";

const PORT = process.env.PORT || 5000;
logger.info(`PORT from env: ${process.env.PORT} `);

app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  startIntermediaPolling();
});
