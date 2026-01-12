import { logger, fetchIntermediaToken, intermediaAxios } from "../index.js";

import axios from "axios";
import qs from "qs";
import fs from "fs";
import path from "path";

// async function fetchIntermediaCallRecordings(userId) {
//   const count = 100;
//   const offset = 0;

//   logger.info(`UserId : ${userId}`);
//   const token = await fetchIntermediaToken();
//   if (!userId) {
//     logger.warn("userId is required to fetch call recordings");
//     return null;
//   }

//   try {
//     const res = await intermediaAxios(token).get(
//       `users/${userId}/call-recordings`,
//       {
//         params: {
//           count,
//           offset,
//         },
//       }
//     );

//     return res?.data?.records ?? null;
//   } catch (error) {
//     logger.error(
//       "Error fetching Intermedia call recordings:",
//       error?.response?.data || error
//     );
//     // logger.error("Error fetching Intermedia call recordings:", error);
//     return null;
//   }
// }

// async function downloadIntermediaRecording(recordingId) {
//   if (!recordingId) {
//     logger.warn("Missing recordingId ");
//     return null;
//   }
//   const userId = "264bf547-6741-4684-b474-084498c73e9b";
//   const outputDir = "./";

//   try {
//     const url = `/users/${userId}/call-recordings/${recordingId}/_content`;
//     const outputFile = path.join(outputDir, `${recordingId}.mp3`);

//     const token = await fetchIntermediaToken();

//     const response = await intermediaAxios(token).get(url, {
//       responseType: "stream", // Important to stream the file
//     });

//     const writer = fs.createWriteStream(outputFile);
//     response.data.pipe(writer);

//     // Wait for download to finish
//     await new Promise((resolve, reject) => {
//       writer.on("finish", resolve);
//       writer.on("error", reject);
//     });

//     logger.info(`Recording saved to: ${outputFile}`);
//     return outputFile;
//   } catch (error) {
//     logger.error("Error downloading Intermedia recording:", error.message);
//     return null;
//   }
// }

// async function fetchIntermediaCallRecordings(userId, cutoffWhenCreated) {
//   const count = 100;
//   let offset = 0;
//   let allRecords = [];

//   logger.info(`UserId : ${userId}`);

//   if (!userId) {
//     logger.warn("userId is required to fetch call recordings");
//     return null;
//   }

//   const token = await fetchIntermediaToken();

//   try {
//     while (true) {
//       logger.info(
//         `Fetching call recordings | offset=${offset}, count=${count}`
//       );

//       const res = await intermediaAxios(token).get(
//         `users/${userId}/call-recordings`,
//         {
//           params: {
//             count,
//             offset,
//           },
//         }
//       );

//       const records = res?.data?.records ?? [];

//       if (records.length === 0) {
//         break; // no more data
//       }

//       allRecords.push(...records);

//       // If fewer records than count, we've reached the last page
//       if (records.length < count) {
//         break;
//       }

//       // Move to next page (offset must be multiple of count)
//       offset += count;
//     }

//     return allRecords;
//   } catch (error) {
//     logger.error(
//       "Error fetching Intermedia call recordings:",
//       error?.response?.data || error
//     );
//     return null;
//   }
// }

/*
* Assumption: Intermedia returns recordings ordered by whenCreated DESC
(If not, sorting client-side is required.)

* Once you hit a recording older than checkpoint, you can stop paging.
*/

function isSortedDescByWhenCreated(records) {
  for (let i = 1; i < records.length; i++) {
    const prev = new Date(records[i - 1].whenCreated);
    const curr = new Date(records[i].whenCreated);
    if (curr > prev) return false;
  }
  return true;
}

async function fetchIntermediaCallRecordings(userId, lastCheckpoint = null) {
  const count = 100;
  let offset = 0;
  let allRecords = [];
  let canEarlyStop = true; // disabled if sort check fails

  if (!userId) {
    logger.warn("userId is required to fetch call recordings");
    return null;
  }

  const token = await fetchIntermediaToken();

  try {
    while (true) {
      logger.info(
        `Fetching call recordings | offset=${offset}, count=${count}`
      );

      const res = await intermediaAxios(token).get(
        `users/${userId}/call-recordings`,
        { params: { count, offset } }
      );

      const records = res?.data?.records ?? [];
      if (records.length === 0) break;

      // ---- Runtime ordering check (only once per page) ----
      if (canEarlyStop && !isSortedDescByWhenCreated(records)) {
        logger.warn(
          "Recordings are not sorted by whenCreated DESC. Disabling early-stop."
        );
        canEarlyStop = false;
      }

      for (const record of records) {
        const createdAt = new Date(record.whenCreated);

        // ---- Pure delta cutoff ----
        if (canEarlyStop && lastCheckpoint && createdAt <= lastCheckpoint) {
          logger.info(
            `Reached checkpoint ${lastCheckpoint.toISOString()}, stopping pagination`
          );
          return allRecords;
        }

        // Delta filter (always applied)
        if (!lastCheckpoint || createdAt > lastCheckpoint) {
          allRecords.push(record);
        }
      }

      if (records.length < count) break;
      offset += count;
    }

    return allRecords;
  } catch (error) {
    logger.error(
      "Error fetching Intermedia call recordings:",
      error?.response?.data || error
    );
    return null;
  }
}

const TEMP_RECORDINGS_DIR = path.resolve(
  process.cwd(),
  "temp",
  "intermedia-recordings"
);
const removeTempRecordingsDir = async () => {
  try {
    fs.rmSync(TEMP_RECORDINGS_DIR, {
      recursive: true,
      force: true,
    });
    logger.info("Removed temp recordings directory");
  } catch (error) {
    logger.error("Failed to remove temp recordings directory", error);
  }
};
async function downloadIntermediaRecording(recordingId) {
  if (!recordingId) {
    logger.warn("Missing recordingId");
    return null;
  }

  const userId = "264bf547-6741-4684-b474-084498c73e9b";

  try {
    // Ensure temp folder exists
    fs.mkdirSync(TEMP_RECORDINGS_DIR, { recursive: true });

    const token = await fetchIntermediaToken();
    const url = `/users/${userId}/call-recordings/${recordingId}/_content`;

    const outputFilePath = path.join(
      TEMP_RECORDINGS_DIR,
      `intermedia-${recordingId}.mp3`
    );

    const response = await intermediaAxios(token).get(url, {
      responseType: "stream",
    });

    const writer = fs.createWriteStream(outputFilePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    logger.info(`Intermedia recording downloaded: ${outputFilePath}`);
    return outputFilePath;
  } catch (error) {
    logger.error(
      "Error downloading Intermedia recording:",
      error.response?.data || error
    );
    return null;
  }
}
// Example usage
// await downloadIntermediaRecording("264bf547-6741-4684-b474-084498c73e9b", "13145650", "./downloads");

export {
  fetchIntermediaCallRecordings,
  downloadIntermediaRecording,
  removeTempRecordingsDir,
};
