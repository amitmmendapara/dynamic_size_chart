const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "..",
  process.env.UPLOAD_DIR || "uploads"
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const OK_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = (Number(process.env.MAX_IMAGE_SIZE_MB) || 5) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!OK_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Use a JPG, PNG, or WEBP file."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES },
});

module.exports = { upload, UPLOAD_DIR };
