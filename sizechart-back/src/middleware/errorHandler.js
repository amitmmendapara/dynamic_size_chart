const multer = require("multer");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Image must be 5 MB or smaller." });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err.message && err.message.includes("Use a JPG, PNG, or WEBP")) {
    return res.status(400).json({ message: err.message });
  }

  // Postgres unique_violation (duplicate column/size name slipped past
  // app-level validation, e.g. a race condition)
  if (err.code === "23505") {
    return res.status(409).json({ message: "Duplicate value violates a unique constraint." });
  }

  const status = err.status || 500;
  res.status(status).json({ message: status === 500 ? "Internal server error." : err.message });
}

module.exports = errorHandler;
