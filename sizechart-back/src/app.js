const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const sizeChartRoutes = require("./routes/sizeChartRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

// Serve uploaded size-chart images statically
app.use(
  process.env.PUBLIC_UPLOAD_PATH || "/uploads",
  express.static(path.join(__dirname, "..", process.env.UPLOAD_DIR || "uploads"))
);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", sizeChartRoutes);

app.use((req, res) => res.status(404).json({ message: "Not found" }));
app.use(errorHandler);

module.exports = app;
