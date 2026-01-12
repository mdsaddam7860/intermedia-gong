import express from "express";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/health", (req, res) => {
  res
    .status(200)
    .send(`Health is good, Server is running on port ${process.env.PORT}`);
});

export { app };
