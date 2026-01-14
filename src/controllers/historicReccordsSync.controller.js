import {
  logger,
  fetchIntermediaCallRecordings,
  mapIntermediaCallToGongPayload,
  createGongCall,
  buildUserIdMap,
  downloadIntermediaRecording,
  uploadMediaToGong,
  markAsSynced,
  getLastCheckpoint,
  saveCheckpoint,
  getJob,
  updateJob,
  removeTempRecordingsDir,
} from "../index.js";
import { intermediaExecutor, gongExecutor } from "../utils/executors.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PROCESSED_USERS_PATH = path.join(process.cwd(), "processed-users.json");

function getProcessedUsers() {
  if (!fs.existsSync(PROCESSED_USERS_PATH)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(PROCESSED_USERS_PATH, "utf8")));
}

function markUserAsProcessed(userId) {
  const users = getProcessedUsers();
  users.add(userId);
  fs.writeFileSync(PROCESSED_USERS_PATH, JSON.stringify([...users], null, 2));
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// go from src/controllers → src → public_html
const USER_PATH = path.resolve(__dirname, "../../intermedia-users.json");

// const USER_PATH = path.join(process.cwd(), "intermedia-users.json");

const ONE_HOUR_MS = 60 * 60 * 1000;
// const sevenDayAgo = new Date(Date.now() - 6 * 24 * ONE_HOUR_MS);
const fromDate = new Date("2026-01-08T00:00:00Z");

async function syncIntermediaToGongHistoricRecords() {
  try {
    const lastCheckpoint = getLastCheckpoint();
    let newestProcessedDate = lastCheckpoint;

    const userData = JSON.parse(fs.readFileSync(USER_PATH, "utf8"));
    const processedUsers = getProcessedUsers();

    for (const user of userData.results) {
      // if (processedUsers.has(user.id)) {
      //   logger.info(`Skipping user ${user.displayName} (already fully synced)`);
      //   continue;
      // }

      const gongId = buildUserIdMap(user.displayName);
      if (!gongId) continue;

      let recordings = [];

      recordings = await intermediaExecutor(
        () => fetchIntermediaCallRecordings(user.id, fromDate),

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
          let job = getJob(recording.id);
          if (job?.status === "DONE") {
            logger.info(`Skipping completed job ${recording.id}`);
            continue;
          }

          const payload = mapIntermediaCallToGongPayload(recording, gongId);

          // Create Gong Call (resume-safe)
          let gongCallId = job?.gongCallId;
          if (!gongCallId) {
            const gongRecording = await gongExecutor(
              () => createGongCall(payload),
              { recording }
            );

            gongCallId = gongRecording?.callId;

            if (!gongCallId) continue;

            // Update job with gongCallId
            updateJob(recording.id, {
              status: "CALL_CREATED",
              gongCallId,
            });

            // fetch updated job
            // getJob(recording.id);
          }

          // Download media (resume-safe)
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

            // getJob(recording.id);

            // Save to remove later
            if (filePath && fs.existsSync(filePath)) {
              filesToCleanup.add(filePath);
            }
          }

          // upload recording to gong (resume-safe)
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
            // getJob(recording.id);
          }

          markAsSynced(recording.id);
          updateJob(recording.id, { status: "DONE" });

          // const createdAt = new Date(recording.createdAt);
          // if (!newestProcessedDate || createdAt > newestProcessedDate) {
          //   newestProcessedDate = createdAt;
          // }
        } catch (err) {
          logger.error(
            `Job failed for User ${user.id} : recording ${recording.id}`,
            err
          );
          // updateJob(recording.id, { status: "DONE" });
          userFullySynced = false;
          // break; // stop processing this user
        }
      }

      // ✅ User-level finalization
      // if (userFullySynced) {
      markUserAsProcessed(user.id);

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
    }
    // }

    // if (
    //   newestProcessedDate instanceof Date &&
    //   !isNaN(newestProcessedDate.getTime())
    // ) {
    //   saveCheckpoint(newestProcessedDate);
    //   logger.info(`Checkpoint updated: ${newestProcessedDate.toISOString()}`);
    // } else {
    //   logger.error("Invalid newestProcessedDate:", newestProcessedDate);
    // }
  } catch (error) {
    logger.error("Error syncing Historic Records to Gong:", error);
  } finally {
    removeTempRecordingsDir();
  }
}

// async function syncIntermediaToGongHistoricRecords() {
//   try {
//     const lastCheckpoint = getLastCheckpoint();
//     let newestProcessedDate = lastCheckpoint;

//     const userData = JSON.parse(fs.readFileSync(USER_PATH, "utf8"));

//     for (const user of userData.results) {
//       const processedUsers = getProcessedUsers();
//       if (processedUsers.has(user.id)) {
//         logger.info(`Skipping user ${user.displayName} (already fully synced)`);
//         continue;
//       }

//       const gongId = buildUserIdMap(user.displayName);
//       if (!gongId) continue;

//       const recordings = await fetchIntermediaCallRecordings(user.id);
//       if (!recordings?.length) {
//         markUserAsProcessed(user.id);
//         continue;
//       }

//       logger.info(`Recordings found: ${recordings.length}`);
//       // let userFullySynced = true;

//       for (const recording of recordings) {
//         try {
//           const job = getJob(recording.id);
//           // -------- Skip fully completed jobs --------
//           if (job?.status === "DONE") {
//             logger.info(`Skipping completed job ${recording.id}`);
//             continue;
//           }

//           const payload = mapIntermediaCallToGongPayload(
//             recording,
//             user,
//             gongId
//           );

//           // -------- Download (resume-safe) --------
//           let filePath = job?.filePath;
//           if (!filePath || !fs.existsSync(filePath)) {
//             filePath = await downloadIntermediaRecording(recording.id);

//             updateJob(recording.id, {
//               status: "DOWNLOADED",
//               filePath,
//               createdAt: recording.createdAt,
//             });

//             logger.info(`Recording downloaded: ${filePath}`);
//           }

//           // -------- Create Gong Call --------
//           let gongCallId = job?.gongCallId;
//           if (!gongCallId) {
//             const gongRecording = await createGongCall(payload);
//             gongCallId = gongRecording.callId;

//             updateJob(recording.id, {
//               status: "CALL_CREATED",
//               gongCallId,
//             });

//             logger.info(`Gong call created: ${gongCallId}`);
//           }

//           // -------- Upload Media --------
//           if (job?.status !== "UPLOADED") {
//             await uploadMediaToGong(gongCallId, filePath);

//             updateJob(recording.id, {
//               status: "UPLOADED",
//             });

//             logger.info(`Media uploaded for call: ${gongCallId}`);
//           }

//           // -------- Finalize --------
//           markAsSynced(recording.id);
//           updateJob(recording.id, { status: "DONE" });

//           const createdAt = new Date(recording.createdAt);
//           if (!newestProcessedDate || createdAt > newestProcessedDate) {
//             newestProcessedDate = createdAt;
//           }
//         } catch (err) {
//           logger.error(`Job failed for recording ${recording.id}`, err);
//           // ❗ Do NOT cleanup → allows resume
//           continue;
//         }
//       }

//       markUserAsProcessed(user.id);

//       // Safe cleanup — only after user completion
//       if (fs.existsSync(SYNCED_RECORDINGS_PATH)) {
//         fs.unlinkSync(SYNCED_RECORDINGS_PATH);
//         logger.info("synced-recording.json deleted");
//       }
//     }

//     if (newestProcessedDate) {
//       saveCheckpoint(newestProcessedDate);
//       logger.info(`Checkpoint updated: ${newestProcessedDate.toISOString()}`);
//     }
//   } catch (error) {
//     logger.error("Error syncing tHistoric Records to Gong:", error);
//   }
// }

// async function syncIntermediaToGongHistoricRecords() {
//   const lastCheckpoint = getLastCheckpoint();
//   let newestProcessedDate = lastCheckpoint;

//   const userData = JSON.parse(fs.readFileSync(USER_PATH, "utf8"));

//   for (const user of userData.results) {
//     const gongId = buildUserIdMap(user.displayName);
//     if (!gongId) continue;

//     const recordings = await fetchIntermediaCallRecordings(user.id);
//     if (!recordings?.length) continue;

//     logger.info(`Recordings: ${recordings.length}`);
//     // return; // TODO remove after testing

//     for (const recording of recordings) {
//       const job = getJob(recording.id);

//       try {
//         // -------- Skip fully completed jobs --------
//         if (job?.status === "DONE") {
//           logger.info(`Skipping completed job ${recording.id}`);
//           continue;
//         }

//         const payload = mapIntermediaCallToGongPayload(recording, user, gongId);

//         // -------- Download (resume-safe) --------
//         let filePath = job?.filePath;
//         if (!filePath || !fs.existsSync(filePath)) {
//           filePath = await downloadIntermediaRecording(recording.id);
//           updateJob(recording.id, {
//             status: "DOWNLOADED",
//             filePath,
//             createdAt: recording.createdAt,
//           });

//           logger.info(`Media Stream: ${JSON.stringify(filePath, null, 2)}`);
//         }
//         updateJob(recording.id, { status: "DONE" });

//         return; // TODO remove after testing

//         // -------- Create Gong Call --------
//         let gongCallId = job?.gongCallId;
//         if (!gongCallId) {
//           const gongRecording = await createGongCall(payload);
//           gongCallId = gongRecording.callId;

//           updateJob(recording.id, {
//             status: "CALL_CREATED",
//             gongCallId,
//           });
//         }

//         // -------- Upload Media --------
//         if (job?.status !== "UPLOADED") {
//           await uploadMediaToGong(gongCallId, filePath);
//           updateJob(recording.id, { status: "UPLOADED" });
//         }

//         // -------- Finalize --------
//         markAsSynced(recording.id);
//         updateJob(recording.id, { status: "DONE" });

//         // Checkpoint update
//         const createdAt = new Date(recording.createdAt);
//         if (!newestProcessedDate || createdAt > newestProcessedDate) {
//           newestProcessedDate = createdAt;
//         }
//       } catch (err) {
//         logger.error(`Job failed for recording ${recording.id}`, err);
//         // ❗ DO NOT cleanup — allows resume
//         continue;
//       }
//     }
//   }

//   if (newestProcessedDate) {
//     saveCheckpoint(newestProcessedDate);
//     logger.info(`Checkpoint updated: ${newestProcessedDate.toISOString()}`);
//   }
// }

export { syncIntermediaToGongHistoricRecords };
