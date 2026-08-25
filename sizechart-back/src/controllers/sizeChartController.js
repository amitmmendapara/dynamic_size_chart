const path = require("path");
const fs = require("fs");
const sizeChartModel = require("../models/sizeChartModel");

/**
 * Retrieve   size chart for a specific product.
 */

async function getSizeChart(req, res) {
  const { productId } = req.params;
  const chart = await sizeChartModel.getByProductId(productId);
  if (!chart) {
    return res.status(404).json({ message: "No size chart for this product yet." });
  }
  res.json(chart);
}

async function saveSizeChart(req, res) {
  const { productId } = req.params;
  const chart = await sizeChartModel.upsertSizeChart(productId, req.body);
  res.json(chart);
}

/**
 * Handle image upload for a product size chart.
 *
 * Expects `req.file` (from multer or similar) and `req.params.productId`.
 * Stores image metadata in the size chart and returns the updated chart.
 */

async function uploadImage(req, res) {
  const { productId } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: "No image file received." });
  }
  const publicBase = process.env.PUBLIC_UPLOAD_PATH || "/uploads";
  const image = {
    url: `${publicBase}/${req.file.filename}`,
    name: req.file.originalname,
    size: req.file.size,
  };
  const chart = await sizeChartModel.setImage(productId, image);
  res.status(201).json(chart);
}

/**
 * Delete the image associated with a product size chart.
 *
 * Removes the file from disk (best-effort) and clears the image reference in the model.
 */
async function deleteImage(req, res) {
  const { productId } = req.params;
  const existing = await sizeChartModel.getByProductId(productId);
  if (existing?.image?.url) {
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      process.env.UPLOAD_DIR || "uploads",
      path.basename(existing.image.url)
    );
    fs.unlink(filePath, () => {}); // best-effort cleanup, ignore errors
  }
  const chart = await sizeChartModel.clearImage(productId);
  res.json(chart);
}

/**
 * Retrieve available size chart presets.
 *
 */
async function getPresets(req, res) {
  const presets = await sizeChartModel.getPresets();
  res.json(presets);
}

module.exports = { getSizeChart, saveSizeChart, uploadImage, deleteImage, getPresets };
