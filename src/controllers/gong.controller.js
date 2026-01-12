import {
  logger,
  fetchIntermediaCallRecordings,
  mapIntermediaCallToGongPayload,
  createGongCall,
  buildUserIdMap,
  downloadIntermediaRecording,
  cleanupRecordingFile,
  uploadMediaToGong,
  getSyncedIds,
  markAsSynced,
  getLastCheckpoint,
  isRetryableError,
  withRetry,
  getJob,
  updateJob,
  removeTempRecordingsDir,
} from "../index.js";
import { intermediaExecutor, gongExecutor } from "../utils/executors.js";
import path from "path";
import fs from "fs";

const USER_PATH = path.join(process.cwd(), "intermedia-users.json");

const lastCheckpoint = getLastCheckpoint(); // may be null
const syncedIds = getSyncedIds();
let newestProcessedDate = lastCheckpoint;

async function syncIntermediaToGong() {
  try {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
    // const oneDayAgo = new Date(Date.now() - 5 * 24 * ONE_HOUR_MS);

    logger.info(
      `Syncing recordings created after: ${oneHourAgo.toISOString()}`
    );
    // fetch user recordings from intermedia and sync to gong as recordings
    const userData = JSON.parse(fs.readFileSync(USER_PATH, "utf8"));

    logger.info(`User Data: ${userData.results.length}`);

    for (const user of userData.results) {
      try {
        const gongId = buildUserIdMap(user.displayName);

        if (!gongId) {
          logger.info(`No Gong Id found for user: ${user.displayName}`);
          continue;
        }

        let recordings = [];

        recordings = await intermediaExecutor(
          () => fetchIntermediaCallRecordings(user.id, oneHourAgo),

          { userId: user.id }
        );
        if (!recordings) {
          logger.info(`No recording found for userId : ${user.id}`);
          continue;
        }

        logger.info(
          `Recordings: ${recordings.length} for User : ${user.displayName}`
        );

        const filesToCleanup = new Set();
        let userFullySynced = true;

        for (const [index, recording] of recordings.entries()) {
          try {
            logger.info(
              `Processing recording ${index + 1} of ${
                recordings.length
              } for User : ${user.displayName}`
            );

            const job = getJob(recording.id);
            if (job?.status === "DONE") {
              logger.info(`Skipping completed job ${recording.id}`);
              continue;
            }

            const payload = mapIntermediaCallToGongPayload(recording, gongId);

            let gongCallId = job?.gongCallId;
            if (!gongCallId) {
              const gongRecording = await gongExecutor(
                () => createGongCall(payload),
                { recordingId: recording.id }
              );

              gongCallId = gongRecording?.callId;

              if (!gongCallId) continue;

              updateJob(recording.id, {
                status: "CALL_CREATED",
                gongCallId,
              });
            }

            let filePath = job?.filePath;
            if (!filePath || !fs.existsSync(filePath)) {
              filePath = await intermediaExecutor(
                () => downloadIntermediaRecording(recording.id),

                { recordingId: recording.id }
              );
              updateJob(recording.id, {
                status: "DOWNLOADED",
                filePath,
                createdAt: recording.createdAt,
              });

              // Save to remove later
              if (filePath && fs.existsSync(filePath)) {
                filesToCleanup.add(filePath);
              }
            }

            if (job?.status !== "UPLOADED") {
              const uploadRecording = await gongExecutor(
                () => uploadMediaToGong(gongCallId, filePath),
                { recordingId: recording.id }
              );
              logger.info(
                `Media uploaded to Gong: ${JSON.stringify(
                  uploadRecording,
                  null,
                  2
                )}`
              );
              updateJob(recording.id, { status: "UPLOADED" });
            }

            markAsSynced(recording.id);
            updateJob(recording.id, { status: "DONE" });

            // ----------- Recording loop End Here -----------

            // const createdAt = new Date(recording.createdAt);
            // if (!newestProcessedDate || createdAt > newestProcessedDate) {
            //   newestProcessedDate = createdAt;
            // }
          } catch (err) {
            logger.error(
              `Job failed for User ${user.id} - ${user.displayName} : recording ${recording.id}`,
              err
            );
            userFullySynced = false;
            // updateJob(recording.id, { status: "DONE" });
            // break; // stop processing this user
          }
        }

        // ✅ User-level finalization
        // if (userFullySynced) {
        // markUserAsProcessed(user.id);

        // if (fs.existsSync(SYNCED_RECORDINGS_PATH)) {
        //   fs.unlinkSync(SYNCED_RECORDINGS_PATH);
        //   logger.info("synced-recording.json deleted");
        // }

        // Delete uploaded recordings
        for (const file of filesToCleanup) {
          try {
            fs.unlinkSync(file);
            logger.info(`Deleted local recording file: ${file}`);
          } catch (err) {
            logger.warn(`Failed to delete file ${file}`, err);
          }
        }

        // ----------- Recording loop End Here -----------
      } catch (error) {
        logger.error("Error syncing to Gong:", error);
      }
    }

    // if (newestProcessedDate) {
    //   saveCheckpoint(newestProcessedDate);
    //   logger.info(`Checkpoint updated to ${newestProcessedDate.toISOString()}`);
    // }
  } catch (error) {
    logger.error("Error syncing to Gong:", error);
  } finally {
    removeTempRecordingsDir();
  }
}

export { syncIntermediaToGong };
