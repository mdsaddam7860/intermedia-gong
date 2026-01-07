/*
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
} from "../index.js";
import path from "path";
import fs from "fs";

const USER_PATH = path.join(process.cwd(), "intermedia-users.json");

const lastCheckpoint = getLastCheckpoint(); // may be null
const syncedIds = getSyncedIds();
let newestProcessedDate = lastCheckpoint;

async function syncIntermediaToGongHistoricRecords() {
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

        const recordings = await fetchIntermediaCallRecordings(user.id);
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
  } catch (error) {
    logger.error("Error syncing to Gong:", error);
  }
}

export { syncIntermediaToGongHistoricRecords };

*/

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
} from "../index.js";
import fs from "fs";
import path from "path";

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

const USER_PATH = path.join(process.cwd(), "intermedia-users.json");

const ONE_HOUR_MS = 60 * 60 * 1000;
// const sevenDayAgo = new Date(Date.now() - 6 * 24 * ONE_HOUR_MS);
const fromDate = new Date("2025-12-01T00:00:00Z");

async function syncIntermediaToGongHistoricRecords() {
  try {
    const lastCheckpoint = getLastCheckpoint();
    let newestProcessedDate = lastCheckpoint;

    const userData = JSON.parse(fs.readFileSync(USER_PATH, "utf8"));
    const processedUsers = getProcessedUsers();

    for (const user of userData.results) {
      if (processedUsers.has(user.id)) {
        logger.info(`Skipping user ${user.displayName} (already fully synced)`);
        continue;
      }

      const gongId = buildUserIdMap(user.displayName);
      if (!gongId) continue;

      const recordings = await fetchIntermediaCallRecordings(user.id, fromDate);
      if (!recordings?.length) {
        markUserAsProcessed(user.id);
        continue;
      }

      // let userFullySynced = true;
      logger.info(`Recordings found: ${recordings.length}`);
      logger.info(
        `Recordings found: ${JSON.stringify(recordings[0], null, 2)}`
      );
      logger.info(
        `Recordings found: ${JSON.stringify(recordings[388], null, 2)}`
      );

      return;
      const filesToCleanup = new Set();

      for (const recording of recordings) {
        try {
          const job = getJob(recording.id);
          if (job?.status === "DONE") continue;

          const payload = mapIntermediaCallToGongPayload(
            recording,
            user,
            gongId
          );

          let gongCallId = job?.gongCallId;
          if (!gongCallId) {
            const gongRecording = await createGongCall(payload);
            gongCallId = gongRecording?.callId;

            if (!gongCallId) continue;

            updateJob(recording.id, {
              status: "CALL_CREATED",
              gongCallId,
            });
          }

          let filePath = job?.filePath;
          if (!filePath || !fs.existsSync(filePath)) {
            filePath = await downloadIntermediaRecording(recording.id);
            updateJob(recording.id, {
              status: "DOWNLOADED",
              filePath,
              createdAt: recording.createdAt,
            });
          }

          if (job?.status !== "UPLOADED") {
            await uploadMediaToGong(gongCallId, filePath);
            updateJob(recording.id, { status: "UPLOADED" });
          }

          markAsSynced(recording.id);
          updateJob(recording.id, { status: "DONE" });

          if (filePath && fs.existsSync(filePath)) {
            filesToCleanup.add(filePath);
          }

          const createdAt = new Date(recording.createdAt);
          if (!newestProcessedDate || createdAt > newestProcessedDate) {
            newestProcessedDate = createdAt;
          }
        } catch (err) {
          logger.error(
            `Job failed for User ${user.id} : recording ${recording.id}`,
            err
          );
          updateJob(recording.id, { status: "DONE" });
          // userFullySynced = false;
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
      // }
    }

    if (newestProcessedDate) {
      saveCheckpoint(newestProcessedDate);
      logger.info(`Checkpoint updated: ${newestProcessedDate.toISOString()}`);
    }
  } catch (error) {
    logger.error("Error syncing Historic Records to Gong:", error);
  }
}

logger.info("✅ Syncing Historic Records to Gong DONE");

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
