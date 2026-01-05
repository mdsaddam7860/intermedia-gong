import fs from "fs";
import { logger } from "../index.js";

const CHECKPOINT_PATH = "./intermedia-recordings-checkpoint.json";

function cleanupRecordingFile(filePath) {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Temporary recording removed: ${filePath}`);
    }
  } catch (error) {
    logger.error("Failed to cleanup recording file:", error.message);
  }
}

function getLastCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  return new Date(JSON.parse(fs.readFileSync(CHECKPOINT_PATH)).lastWhenCreated);
}

function saveCheckpoint(date) {
  fs.writeFileSync(
    CHECKPOINT_PATH,
    JSON.stringify({ lastWhenCreated: date.toISOString() })
  );
}

const SYNCED_IDS_PATH = "./synced-recordings.json";

function getSyncedIds() {
  if (!fs.existsSync(SYNCED_IDS_PATH)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(SYNCED_IDS_PATH)));
}

function markAsSynced(id) {
  const ids = getSyncedIds();
  ids.add(id);
  fs.writeFileSync(SYNCED_IDS_PATH, JSON.stringify([...ids]));
}

export {
  cleanupRecordingFile,
  getLastCheckpoint,
  saveCheckpoint,
  getSyncedIds,
  markAsSynced,
};
