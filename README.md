# ps-items

A collection of Photoshop scripts (`.jsx`) for workflow automation.

## Scripts

### AddBorderToStandardRatio.jsx

Adds a solid color border around the active document's image, expanding the canvas to fit a standard print ratio.

**What it does:**

1. Reads the active document's pixel dimensions
2. Calculates the minimum canvas size for each standard ratio that keeps the image centered with at least a 10% border on all sides
3. Presents a dialog showing all candidate ratios sorted by border evenness, with visual previews and pixel/percentage stats for each
4. Expands the canvas to the chosen ratio (centered) — the border is filled by whatever background color is set in Photoshop

**Supported ratios:** 1x1, 2x3, 4x5, 5x7, 8x10, 11x14 (auto-oriented to match the image)

**Usage:**

- In Photoshop: **File > Scripts > Browse**, then select `AddBorderToStandardRatio.jsx`
- Or assign it to an Action via the same menu entry

**Requirements:** Adobe Photoshop (ExtendScript engine)
