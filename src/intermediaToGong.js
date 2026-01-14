import "dotenv/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), "../.env"),
});

import { app } from "./app.js";
import { logger } from "./index.js";
import { startIntermediaPolling } from "./schedulers/intermedia.poller.js";

const PORT = process.env.PORT || 5000;

logger.info(`CWD: ${process.cwd()}`);
logger.info(`PORT from env: ${process.env.PORT} `);

app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  startIntermediaPolling();
});
