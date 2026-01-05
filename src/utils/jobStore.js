import fs from "fs";
import path from "path";

const BASE_DIR = path.join(process.cwd(), ".intermedia-sync");
const JOB_FILE = path.join(BASE_DIR, "jobs.json");

if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR);

function loadJobs() {
  if (!fs.existsSync(JOB_FILE)) return {};
  return JSON.parse(fs.readFileSync(JOB_FILE, "utf8"));
}

function saveJobs(jobs) {
  fs.writeFileSync(JOB_FILE, JSON.stringify(jobs, null, 2));
}

function getJob(recordingId) {
  return loadJobs()[recordingId];
}

function updateJob(recordingId, data) {
  const jobs = loadJobs();
  jobs[recordingId] = {
    ...(jobs[recordingId] || {}),
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveJobs(jobs);
}

export { getJob, updateJob };
