/*
 * AddBorderToStandardRatio.jsx
 * 
 * Adds a solid color border around the active document's image,
 * sized so the final canvas matches a standard print ratio.
 * 
 * Presents a dialog with visual previews and text stats
 * for each candidate ratio, ranked by border evenness.
 *
 * Designed to be called from a Photoshop Action via File > Scripts > Browse.
 */

#target photoshop

(function () {

    // ---------------------------------------------------------------
    // CONFIG
    // ---------------------------------------------------------------
    var STANDARD_RATIOS = [
        { name: "1x1",   w: 1,  h: 1  },
        { name: "2x3",   w: 2,  h: 3  },
        { name: "4x5",   w: 4,  h: 5  },
        { name: "5x7",   w: 5,  h: 7  },
        { name: "8x10",  w: 8,  h: 10 },
        { name: "11x14", w: 11, h: 14 }
    ];

    var MIN_BORDER_PCT = 0.10; // 10% of shorter dimension as absolute minimum border

    // ---------------------------------------------------------------
    // GATHER IMAGE INFO
    // ---------------------------------------------------------------
    var doc = app.activeDocument;
    var imgW = doc.width.as("px");
    var imgH = doc.height.as("px");
    var isLandscape = imgW >= imgH;

    // ---------------------------------------------------------------
    // CALCULATE CANDIDATES
    // ---------------------------------------------------------------
    var candidates = [];
    var minBorderPx = Math.round(Math.min(imgW, imgH) * MIN_BORDER_PCT);

    for (var i = 0; i < STANDARD_RATIOS.length; i++) {
        var r = STANDARD_RATIOS[i];

        // Orient the ratio to match the image
        var rw, rh;
        if (r.w === r.h) {
            rw = r.w;
            rh = r.h;
        } else if (isLandscape) {
            rw = Math.max(r.w, r.h);
            rh = Math.min(r.w, r.h);
        } else {
            rw = Math.min(r.w, r.h);
            rh = Math.max(r.w, r.h);
        }

        // Find the smallest canvas at this ratio that fits the image
        // with at least minBorderPx on every side.
        var neededW = imgW + 2 * minBorderPx;
        var neededH = imgH + 2 * minBorderPx;

        var scaleByW = neededW / rw;
        var scaleByH = neededH / rh;

        var canvasW, canvasH;
        if (scaleByW >= scaleByH) {
            canvasW = neededW;
            canvasH = Math.ceil(canvasW * rh / rw);
        } else {
            canvasH = neededH;
            canvasW = Math.ceil(canvasH * rw / rh);
        }

        var borderL = Math.floor((canvasW - imgW) / 2);
        var borderR = canvasW - imgW - borderL;
        var borderT = Math.floor((canvasH - imgH) / 2);
        var borderB = canvasH - imgH - borderT;

        var hBorder = borderL;
        var vBorder = borderT;

        var shorterDim = Math.min(imgW, imgH);
        var evenness = Math.abs(hBorder - vBorder) / shorterDim;

        var hBorderPct = hBorder / shorterDim * 100;
        var vBorderPct = vBorder / shorterDim * 100;

        candidates.push({
            name:       r.name,
            canvasW:    canvasW,
            canvasH:    canvasH,
            borderL:    borderL,
            borderR:    borderR,
            borderT:    borderT,
            borderB:    borderB,
            hBorder:    hBorder,
            vBorder:    vBorder,
            hBorderPct: hBorderPct,
            vBorderPct: vBorderPct,
            evenness:   evenness,
            ratioW:     rw,
            ratioH:     rh
        });
    }

    // Sort by evenness (most even first)
    candidates.sort(function (a, b) { return a.evenness - b.evenness; });

    // ---------------------------------------------------------------
    // BUILD DIALOG
    // ---------------------------------------------------------------
    var dlg = new Window("dialog", "Add Border \u2014 Standard Ratio");
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];

    // Header
    var headerGrp = dlg.add("group");
    headerGrp.orientation = "column";
    headerGrp.alignChildren = ["left", "top"];
    headerGrp.add("statictext", undefined,
        "Image: " + imgW + " \u00D7 " + imgH + " px  (" + (isLandscape ? "landscape" : "portrait") + ")");
    headerGrp.add("statictext", undefined,
        "Select a target ratio (sorted by border evenness):");

    // Preview sizing constants
    var PREVIEW_MAX_W = 130;
    var PREVIEW_MAX_H = 100;

    var radioButtons = [];

    var listPanel = dlg.add("panel", undefined, "");
    listPanel.orientation = "column";
    listPanel.alignChildren = ["fill", "top"];

    for (var c = 0; c < candidates.length; c++) {
        var cand = candidates[c];

        var row = listPanel.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        row.spacing = 12;

        // --- Radio button ---
        var rb = row.add("radiobutton", undefined, "");
        if (c === 0) rb.value = true;
        radioButtons.push(rb);

        // --- Preview using stacked groups as spacers ---
        // Calculate proportional sizes to fit within PREVIEW_MAX
        var scaleFactor = Math.min(PREVIEW_MAX_W / cand.canvasW, PREVIEW_MAX_H / cand.canvasH);
        var drawCanvasW = Math.max(Math.round(cand.canvasW * scaleFactor), 20);
        var drawCanvasH = Math.max(Math.round(cand.canvasH * scaleFactor), 20);
        var drawImgW = Math.max(Math.round(imgW * scaleFactor), 10);
        var drawImgH = Math.max(Math.round(imgH * scaleFactor), 10);

        // Border sizes in preview pixels
        var drawBorderH = Math.round((drawCanvasW - drawImgW) / 2); // left/right
        var drawBorderV = Math.round((drawCanvasH - drawImgH) / 2); // top/bottom

        // Container group — fixed size so all rows align
        var pvContainer = row.add("group");
        pvContainer.preferredSize = [PREVIEW_MAX_W, PREVIEW_MAX_H];
        pvContainer.alignment = ["center", "center"];
        pvContainer.alignChildren = ["center", "center"];

        // Build the preview as a vertical stack: topSpacer | middleRow | bottomSpacer
        // The outer group acts as the canvas
        var outerGrp = pvContainer.add("group");
        outerGrp.orientation = "column";
        outerGrp.spacing = 0;
        outerGrp.margins = 0;
        outerGrp.preferredSize = [drawCanvasW, drawCanvasH];
        outerGrp.alignChildren = ["center", "top"];

        // Top border spacer
        var topSpacer = outerGrp.add("group");
        topSpacer.preferredSize = [drawCanvasW, drawBorderV];

        // Middle row: leftSpacer | image | rightSpacer
        var midRow = outerGrp.add("group");
        midRow.orientation = "row";
        midRow.spacing = 0;
        midRow.margins = 0;
        midRow.alignChildren = ["left", "center"];

        var leftSpacer = midRow.add("group");
        leftSpacer.preferredSize = [drawBorderH, drawImgH];

        var imgBlock = midRow.add("group");
        imgBlock.preferredSize = [drawImgW, drawImgH];

        var rightSpacer = midRow.add("group");
        rightSpacer.preferredSize = [drawBorderH, drawImgH];

        // Bottom border spacer
        var botSpacer = outerGrp.add("group");
        botSpacer.preferredSize = [drawCanvasW, drawBorderV];

        // Apply background colors
        try {
            // Canvas/border color on outer group and spacers
            var borderBrush = outerGrp.graphics.newBrush(
                outerGrp.graphics.BrushType.SOLID_COLOR, [0.75, 0.75, 0.75, 1]);
            outerGrp.graphics.backgroundColor = borderBrush;
            topSpacer.graphics.backgroundColor = topSpacer.graphics.newBrush(
                topSpacer.graphics.BrushType.SOLID_COLOR, [0.75, 0.75, 0.75, 1]);
            leftSpacer.graphics.backgroundColor = leftSpacer.graphics.newBrush(
                leftSpacer.graphics.BrushType.SOLID_COLOR, [0.75, 0.75, 0.75, 1]);
            rightSpacer.graphics.backgroundColor = rightSpacer.graphics.newBrush(
                rightSpacer.graphics.BrushType.SOLID_COLOR, [0.75, 0.75, 0.75, 1]);
            botSpacer.graphics.backgroundColor = botSpacer.graphics.newBrush(
                botSpacer.graphics.BrushType.SOLID_COLOR, [0.75, 0.75, 0.75, 1]);

            // Image color on center block
            imgBlock.graphics.backgroundColor = imgBlock.graphics.newBrush(
                imgBlock.graphics.BrushType.SOLID_COLOR, [0.25, 0.25, 0.25, 1]);
        } catch (e) {
            // If graphics coloring fails, layout still shows structure
        }

        // --- Text stats ---
        var statsGrp = row.add("group");
        statsGrp.orientation = "column";
        statsGrp.alignChildren = ["left", "top"];
        statsGrp.preferredSize = [340, -1];

        var orientedRatio = cand.ratioW + ":" + cand.ratioH;
        statsGrp.add("statictext", undefined,
            cand.name + "  (" + orientedRatio + ")    Canvas: " + cand.canvasW + " \u00D7 " + cand.canvasH);
        statsGrp.add("statictext", undefined,
            "  L/R borders: " + cand.hBorder + " px  (" + cand.hBorderPct.toFixed(1) + "%)");
        statsGrp.add("statictext", undefined,
            "  T/B borders: " + cand.vBorder + " px  (" + cand.vBorderPct.toFixed(1) + "%)");

        var evennessLabel;
        if (cand.evenness < 0.01) {
            evennessLabel = "Near-perfect";
        } else if (cand.evenness < 0.05) {
            evennessLabel = "Very even";
        } else if (cand.evenness < 0.15) {
            evennessLabel = "Moderate";
        } else {
            evennessLabel = "Uneven";
        }
        statsGrp.add("statictext", undefined,
            "  Evenness: " + evennessLabel + "  (diff: " + Math.abs(cand.hBorder - cand.vBorder) + " px)");
    }

    // Enforce radio button mutual exclusivity
    for (var r = 0; r < radioButtons.length; r++) {
        radioButtons[r]._index = r;
        radioButtons[r].onClick = function () {
            for (var k = 0; k < radioButtons.length; k++) {
                radioButtons[k].value = (k === this._index);
            }
        };
    }

    // Buttons
    var btnGrp = dlg.add("group");
    btnGrp.alignment = ["right", "bottom"];
    btnGrp.add("button", undefined, "Cancel", { name: "cancel" });
    btnGrp.add("button", undefined, "Apply", { name: "ok" });

    // ---------------------------------------------------------------
    // SHOW DIALOG & APPLY
    // ---------------------------------------------------------------
    if (dlg.show() !== 1) return;

    var selectedIdx = 0;
    for (var s = 0; s < radioButtons.length; s++) {
        if (radioButtons[s].value) {
            selectedIdx = s;
            break;
        }
    }

    var chosen = candidates[selectedIdx];

    // ---------------------------------------------------------------
    // APPLY: Resize canvas
    // ---------------------------------------------------------------
    var origUnits = preferences.rulerUnits;
    preferences.rulerUnits = Units.PIXELS;

    try {
        doc.resizeCanvas(
            UnitValue(chosen.canvasW, "px"),
            UnitValue(chosen.canvasH, "px"),
            AnchorPosition.MIDDLECENTER
        );
    } finally {
        preferences.rulerUnits = origUnits;
    }

})();
