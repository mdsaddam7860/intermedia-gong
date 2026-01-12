import { logger } from "./utils/winstonLogger.js";
import {
  fetchIntermediaCallRecordings,
  downloadIntermediaRecording,
  removeTempRecordingsDir,
} from "./services/intermedia.service.js";

import {
  getGongAccessToken,
  fetchIntermediaToken,
} from "./services/auth/tokenManager.js";
import { gongAxios, intermediaAxios } from "./configs/gongAxios.config.js";
import {
  createGongCall,
  getGongUsers,
  getGongUser,
  uploadMediaToGong,
} from "./services/gong.service.js";
import {
  mapIntermediaCallToGongPayload,
  buildUserIdMap,
} from "./utils/mapFunction.util.js";
import {
  cleanupRecordingFile,
  getLastCheckpoint,
  saveCheckpoint,
  getSyncedIds,
  markAsSynced,
} from "./utils/helper.util.js";
import { syncIntermediaToGongHistoricRecords } from "./controllers/historicReccordsSync.controller.js";
import { getJob, updateJob } from "./utils/jobStore.js";
// import { withRetry, isRetryableError } from "./utils/retry.util.js";
import {
  Throttle,
  throttle,
  withRetry,
  isRetryableError,
  createRequestExecutor,
} from "./utils/requestExecutor.js";
// import {} from ""

export {
  removeTempRecordingsDir,
  Throttle,
  throttle,
  createRequestExecutor,
  isRetryableError,
  withRetry,
  getJob,
  updateJob,
  syncIntermediaToGongHistoricRecords,
  getSyncedIds,
  markAsSynced,
  getLastCheckpoint,
  saveCheckpoint,
  uploadMediaToGong,
  downloadIntermediaRecording,
  buildUserIdMap,
  logger,
  mapIntermediaCallToGongPayload,
  intermediaAxios,
  fetchIntermediaCallRecordings,
  getGongAccessToken,
  gongAxios,
  createGongCall,
  getGongUsers,
  getGongUser,
  fetchIntermediaToken,
  cleanupRecordingFile,
};
