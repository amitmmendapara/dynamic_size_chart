const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const validateSizeChart = require("../middleware/validateSizeChart");
const { upload } = require("../middleware/upload");
const ctrl = require("../controllers/sizeChartController");

const router = express.Router();

// Category presets (T-Shirts / Jeans / Shoes -> default column set)
router.get("/size-chart-presets", asyncHandler(ctrl.getPresets));

// Per-product size chart
router.get("/products/:productId/size-chart", asyncHandler(ctrl.getSizeChart));
router.put(
  "/products/:productId/size-chart",
  validateSizeChart,
  asyncHandler(ctrl.saveSizeChart)
);

// Reference image (separate from the main save, matching the UI's
// own Upload / Replace / Remove flow)
router.post(
  "/products/:productId/size-chart/image",
  upload.single("image"),
  asyncHandler(ctrl.uploadImage)
);
router.delete("/products/:productId/size-chart/image", asyncHandler(ctrl.deleteImage));

module.exports = router;
