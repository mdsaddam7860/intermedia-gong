import dotenv from "dotenv";
dotenv.config();
import { app } from "./app.js";
import { logger, syncIntermediaToGongHistoricRecords } from "./index.js";
import { syncIntermediaToGong } from "./controllers/gong.controller.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
});

syncIntermediaToGongHistoricRecords();
