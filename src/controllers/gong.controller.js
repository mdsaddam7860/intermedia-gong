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
} from "../index.js";
import path from "path";
import fs from "fs";

const USER_PATH = path.join(process.cwd(), "intermedia-users.json");

const ONE_HOUR_MS = 60 * 60 * 1000;
const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
const oneDayAgo = new Date(Date.now() - 20 * 24 * ONE_HOUR_MS);

logger.info(`Syncing recordings created after: ${oneHourAgo.toISOString()}`);

const lastCheckpoint = getLastCheckpoint(); // may be null
const syncedIds = getSyncedIds();
let newestProcessedDate = lastCheckpoint;

async function syncIntermediaToGong() {
  try {
    // fetch user recordings from intermedia and sync to gong as recordings
    const userData = JSON.parse(fs.readFileSync(USER_PATH, "utf8"));

    logger.info(`User Data: ${userData.results.length}`);

    let filePath = "";

    for (const user of userData.results) {
      try {
        // logger.info(`User Data: ${JSON.stringify(user, null, 2)}`);

        const gongId = buildUserIdMap(user.displayName);

        if (!gongId) {
          logger.info(`No Gong Id found for user: ${user.displayName}`);
          continue;
        }

        // logger.info(`Gong Id: ${gongId}`);

        // const recordings = await fetchIntermediaCallRecordings(
        //   user.id,
        //   oneHourAgo //  This is where I am using to return early in pagination
        // );

        let recordings = [];

        await withRetry(
          () =>
            (recordings = fetchIntermediaCallRecordings(user.id, oneHourAgo)),

          {
            retries: 5,
            baseDelay: 500,
            maxDelay: 10_000,
            jitter: true,
            shouldRetry: isRetryableError,
            onRetry: (err, attempt) =>
              logger.warn(
                `Retrying Intermedia call | attempt=${attempt} | status=${err?.response?.status}`
              ),
          }
        );
        if (!recordings) {
          logger.info(`No recording found for userId : ${user.id}`);
          continue;
        }

        logger.info(`Recordings: ${recordings.length}`);
        // return; // TODO Remove After Testing pagination

        for (const recording of recordings) {
          try {
            logger.info(
              `Recording Data: ${JSON.stringify(recording, null, 2)}`
            );

            // const recordingCreatedAt = new Date(recording.whenCreated);

            // if (recordingCreatedAt <= oneHourAgo) {
            //   logger.info(
            //     `Skipping old recording ${recording.id} — created at ${recording.whenCreated}`
            //   );
            //   continue;
            // }

            // Idempotency
            if (syncedIds.has(recording.id)) {
              logger.info(`Skipping already synced recording ${recording.id}`);
              continue;
            }

            // if (recording.duration < 60) {
            //   logger.info(
            //     `Skipping call ${recording.id} — duration ${recording.duration}s < 60s`
            //   );
            //   continue;
            // }

            const payload = mapIntermediaCallToGongPayload(
              recording,
              user,
              gongId
            );

            filePath = await downloadIntermediaRecording(recording.id);
            // logger.info(
            //   `Media Stream: ${JSON.stringify(mediaStream, null, 2)}`
            // );

            // return; // TODO Remove after testing

            logger.info(`Payload: ${JSON.stringify(payload, null, 2)}`);

            const gongRecording = await createGongCall(payload);

            if (!gongRecording) {
              logger.warn(
                `Gong recording could not created ${JSON.stringify(
                  payload,
                  null,
                  2
                )}`
              );
              // return; // TODO Remove after testing
              continue;
            }
            logger.info(
              `Gong Recording created: ${JSON.stringify(
                gongRecording,
                null,
                2
              )}`
            );

            if (gongRecording.callId && filePath) {
              const uploadMedia = await uploadMediaToGong(
                gongRecording.callId,
                filePath
              );
              if (uploadMedia) {
                logger.info(
                  `Media uploaded to Gong: ${JSON.stringify(
                    uploadMedia,
                    null,
                    2
                  )}`
                );
              }
            }

            markAsSynced(recording.id);

            // Track newest timestamp
            if (!newestProcessedDate || createdAt > newestProcessedDate) {
              newestProcessedDate = createdAt;
            }

            if (filePath?.includes("intermedia-recordings")) {
              cleanupRecordingFile(filePath);
            }
          } catch (error) {
            logger.error("Error syncing to Gong:", error);
          } finally {
            if (filePath?.includes("intermedia-recordings")) {
              cleanupRecordingFile(filePath);
            }
          }
        }

        // ----------- Recording loop End Here -----------
      } catch (error) {
        logger.error("Error syncing to Gong:", error);
      }
    }

    if (newestProcessedDate) {
      saveCheckpoint(newestProcessedDate);
      logger.info(`Checkpoint updated to ${newestProcessedDate.toISOString()}`);
    }
  } catch (error) {
    logger.error("Error syncing to Gong:", error);
  }
}

export { syncIntermediaToGong };
