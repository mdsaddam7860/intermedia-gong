import express from "express";
import { syncIntermediaToGong } from "./controllers/gong.controller.js";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/health", (req, res) => {
  res
    .status(200)
    .send(`Health is good, Server is running on port ${process.env.PORT}`);
});

app.get("/run/manually", async (req, res) => {
  res
    .status(200)
    .send(`Health is good, Server is running on port ${process.env.PORT}`);

  setImmediate(async () => {
    await syncIntermediaToGong();
  });
});

export { app };
