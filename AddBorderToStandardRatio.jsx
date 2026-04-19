/*
 * AddBorderToStandardRatio.jsx
 *
 * Adds a solid color border around the active document's image,
 * sized so the final canvas matches a standard print ratio.
 *
 * Presents a dialog with visual previews and text stats
 * for the top 6 candidate ratios (by border evenness), plus
 * an optional custom ratio that always appears if defined.
 *
 * Designed to be called from a Photoshop Action via File > Scripts > Browse.
 * Expects the selected layer(s) to be converted into a smart object,
 * with a solid fill layer beneath to act as the border color.
 */

#target photoshop

(function () {

    // ---------------------------------------------------------------
    // CONFIG
    // ---------------------------------------------------------------
    var STANDARD_RATIOS = [
        { name: "1:1",     w: 1,    h: 1    },
        { name: "2:3",     w: 2,    h: 3    },
        { name: "4:5",     w: 4,    h: 5    },
        { name: "5:7",     w: 5,    h: 7    },
        { name: "4:3",     w: 4,    h: 3    },
        { name: "8:10",    w: 8,    h: 10   },
        { name: "9:16",    w: 9,    h: 16   },
        { name: "11:14",   w: 11,   h: 14   },
        { name: "Letter",  w: 8.5,  h: 11   },
        { name: "A4",      w: 210,  h: 297  },
        { name: "A3",      w: 297,  h: 420  }
    ];

    var MAX_STANDARD_SHOWN = 6;
    var MIN_BORDER_PCT     = 0.10;
    var PREVIEW_MAX_W      = 130;
    var PREVIEW_MAX_H      = 100;

    // Colors for preview rendering
    var COLOR_BORDER = [0.75, 0.75, 0.75, 1];
    var COLOR_IMAGE  = [0.25, 0.25, 0.25, 1];

    // ---------------------------------------------------------------
    // GATHER IMAGE INFO
    // ---------------------------------------------------------------
    var doc = app.activeDocument;
    var imgW = doc.width.as("px");
    var imgH = doc.height.as("px");
    var isLandscape = imgW >= imgH;

    // ---------------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------------
    function gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b) {
            var t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    function orientRatio(rw, rh) {
        if (rw === rh) return [rw, rh];
        if (isLandscape) return [Math.max(rw, rh), Math.min(rw, rh)];
        return [Math.min(rw, rh), Math.max(rw, rh)];
    }

    // Deduplication key. Scales to integers (supports up to 2
    // decimal places) before reducing by GCD, so 8.5:11 and
    // 17:22 collapse to the same key.
    function ratioKey(rw, rh) {
        var oriented = orientRatio(rw, rh);
        var scale = 100;
        var a = Math.round(oriented[0] * scale);
        var b = Math.round(oriented[1] * scale);
        var g = gcd(a, b);
        return (a / g) + ":" + (b / g);
    }

    // ---------------------------------------------------------------
    // CALCULATE A SINGLE CANDIDATE
    // ---------------------------------------------------------------
    function calcCandidate(ratio) {
        var minBorderPx = Math.round(Math.min(imgW, imgH) * MIN_BORDER_PCT);
        var oriented = orientRatio(ratio.w, ratio.h);
        var rw = oriented[0];
        var rh = oriented[1];

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

        var borderH = Math.floor((canvasW - imgW) / 2);
        var borderV = Math.floor((canvasH - imgH) / 2);
        var shorterDim = Math.min(imgW, imgH);
        var evenness = Math.abs(borderH - borderV) / shorterDim;

        return {
            name:       ratio.name,
            canvasW:    canvasW,
            canvasH:    canvasH,
            borderH:    borderH,
            borderV:    borderV,
            hBorderPct: borderH / shorterDim * 100,
            vBorderPct: borderV / shorterDim * 100,
            evenness:   evenness,
            ratioW:     rw,
            ratioH:     rh,
            isCustom:   false
        };
    }

    // ---------------------------------------------------------------
    // BUILD DISPLAY LIST
    // Top 6 standard (deduplicated, sorted by evenness), plus
    // the custom candidate inserted at its sorted position.
    // ---------------------------------------------------------------
    function buildDisplayList(customRatio) {
        var seen = {};
        var allStandard = [];

        for (var i = 0; i < STANDARD_RATIOS.length; i++) {
            var key = ratioKey(STANDARD_RATIOS[i].w, STANDARD_RATIOS[i].h);
            if (seen[key]) continue;
            seen[key] = true;
            allStandard.push(calcCandidate(STANDARD_RATIOS[i]));
        }

        allStandard.sort(function (a, b) { return a.evenness - b.evenness; });

        var display = allStandard.slice(0, MAX_STANDARD_SHOWN);

        if (customRatio) {
            var customKey = ratioKey(customRatio.w, customRatio.h);

            // Check if the custom duplicates any standard ratio
            var duplicatesStandard = false;
            for (var si = 0; si < STANDARD_RATIOS.length; si++) {
                if (ratioKey(STANDARD_RATIOS[si].w, STANDARD_RATIOS[si].h) === customKey) {
                    duplicatesStandard = true;
                    break;
                }
            }

            if (!duplicatesStandard) {
                var customCand = calcCandidate(customRatio);
                customCand.isCustom = true;

                // Check if it already appears in the display list
                var alreadyShown = false;
                for (var di = 0; di < display.length; di++) {
                    if (ratioKey(display[di].ratioW, display[di].ratioH) === customKey) {
                        alreadyShown = true;
                        display[di].isCustom = true;
                        break;
                    }
                }

                if (!alreadyShown) {
                    var inserted = false;
                    for (var pi = 0; pi < display.length; pi++) {
                        if (customCand.evenness <= display[pi].evenness) {
                            display.splice(pi, 0, customCand);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        display.push(customCand);
                    }
                }
            }
        }

        return display;
    }

    // ---------------------------------------------------------------
    // BUILD & SHOW DIALOG
    // Returns: chosen candidate object, "custom" string, or null
    // ---------------------------------------------------------------
    function showDialog(candidates) {
        var dlg = new Window("dialog", "Add Border \u2014 Standard Ratio");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];

        // -- Header --
        var headerGrp = dlg.add("group");
        headerGrp.orientation = "column";
        headerGrp.alignChildren = ["left", "top"];
        headerGrp.add("statictext", undefined,
            "Image: " + imgW + " \u00D7 " + imgH + " px  (" +
            (isLandscape ? "landscape" : "portrait") + ")");
        headerGrp.add("statictext", undefined,
            "Select a target ratio (sorted by border evenness):");

        // -- Candidate list --
        var listPanel = dlg.add("panel", undefined, "");
        listPanel.orientation = "column";
        listPanel.alignChildren = ["fill", "top"];

        var radioButtons = [];

        for (var ci = 0; ci < candidates.length; ci++) {
            var cand = candidates[ci];

            var row = listPanel.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];
            row.spacing = 12;

            // --- Radio button ---
            var rb = row.add("radiobutton", undefined, "");
            if (ci === 0) rb.value = true;
            radioButtons.push(rb);

            // --- Preview via onDraw ---
            var scaleFactor = Math.min(
                PREVIEW_MAX_W / cand.canvasW,
                PREVIEW_MAX_H / cand.canvasH
            );
            var drawCanvasW = Math.max(Math.round(cand.canvasW * scaleFactor), 20);
            var drawCanvasH = Math.max(Math.round(cand.canvasH * scaleFactor), 20);
            var drawImgW    = Math.max(Math.round(imgW * scaleFactor), 10);
            var drawImgH    = Math.max(Math.round(imgH * scaleFactor), 10);

            var pvContainer = row.add("group");
            pvContainer.preferredSize = [PREVIEW_MAX_W, PREVIEW_MAX_H];
            pvContainer.alignment = ["center", "center"];

            var drawGrp = pvContainer.add("group");
            drawGrp.preferredSize = [drawCanvasW, drawCanvasH];
            drawGrp.alignment = ["center", "center"];

            drawGrp._cw = drawCanvasW;
            drawGrp._ch = drawCanvasH;
            drawGrp._iw = drawImgW;
            drawGrp._ih = drawImgH;

            drawGrp.onDraw = function () {
                var g = this.graphics;

                var bBrush = g.newBrush(g.BrushType.SOLID_COLOR, COLOR_BORDER);
                g.rectPath(0, 0, this._cw, this._ch);
                g.fillPath(bBrush);

                var iBrush = g.newBrush(g.BrushType.SOLID_COLOR, COLOR_IMAGE);
                var ix = Math.round((this._cw - this._iw) / 2);
                var iy = Math.round((this._ch - this._ih) / 2);
                g.rectPath(ix, iy, this._iw, this._ih);
                g.fillPath(iBrush);
            };

            // --- Text stats ---
            var statsGrp = row.add("group");
            statsGrp.orientation = "column";
            statsGrp.alignChildren = ["left", "top"];
            statsGrp.preferredSize = [340, -1];

            var nameLabel = cand.name;
            if (cand.isCustom) nameLabel += "  (custom)";

            var orientedRatio = cand.ratioW + ":" + cand.ratioH;
            statsGrp.add("statictext", undefined,
                nameLabel + "  (" + orientedRatio + ")    Canvas: " +
                cand.canvasW + " \u00D7 " + cand.canvasH);
            statsGrp.add("statictext", undefined,
                "  L/R border: " + cand.borderH + " px  (" +
                cand.hBorderPct.toFixed(1) + "%)");
            statsGrp.add("statictext", undefined,
                "  T/B border: " + cand.borderV + " px  (" +
                cand.vBorderPct.toFixed(1) + "%)");

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
                "  Evenness: " + evennessLabel +
                "  (diff: " + Math.abs(cand.borderH - cand.borderV) + " px)");
        }

        // Enforce radio button mutual exclusivity
        for (var ri = 0; ri < radioButtons.length; ri++) {
            radioButtons[ri]._index = ri;
            radioButtons[ri].onClick = function () {
                for (var k = 0; k < radioButtons.length; k++) {
                    radioButtons[k].value = (k === this._index);
                }
            };
        }

        // -- Buttons --
        var btnGrp = dlg.add("group");
        btnGrp.alignment = ["right", "bottom"];
        btnGrp.add("button", undefined, "Cancel", { name: "cancel" });

        var customBtn = btnGrp.add("button", undefined, "Custom\u2026");
        customBtn.onClick = function () {
            dlg._resultCode = "custom";
            dlg.close(2);
        };

        btnGrp.add("button", undefined, "Apply", { name: "ok" });

        // -- Show --
        var dialogResult = dlg.show();

        if (dlg._resultCode === "custom") return "custom";
        if (dialogResult !== 1) return null;

        for (var si = 0; si < radioButtons.length; si++) {
            if (radioButtons[si].value) return candidates[si];
        }
        return candidates[0];
    }

    // ---------------------------------------------------------------
    // CUSTOM RATIO PROMPT
    // Returns: { name, w, h } or null
    // ---------------------------------------------------------------
    function promptCustomRatio() {
        var dlg = new Window("dialog", "Custom Ratio");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];

        dlg.add("statictext", undefined, "Enter a custom ratio (e.g. 8.5 and 11):");

        var inputGrp = dlg.add("group");
        inputGrp.orientation = "row";
        inputGrp.alignChildren = ["left", "center"];

        inputGrp.add("statictext", undefined, "Width:");
        var wField = inputGrp.add("edittext", undefined, "");
        wField.characters = 8;

        inputGrp.add("statictext", undefined, "  Height:");
        var hField = inputGrp.add("edittext", undefined, "");
        hField.characters = 8;

        var btnGrp = dlg.add("group");
        btnGrp.alignment = ["right", "bottom"];
        btnGrp.add("button", undefined, "Cancel", { name: "cancel" });
        btnGrp.add("button", undefined, "OK", { name: "ok" });

        wField.active = true;

        if (dlg.show() !== 1) return null;

        var wVal = parseFloat(wField.text);
        var hVal = parseFloat(hField.text);

        if (isNaN(wVal) || isNaN(hVal) || wVal <= 0 || hVal <= 0) {
            alert("Invalid ratio. Both values must be positive numbers.");
            return null;
        }

        // Build a clean display name
        var wStr = (wVal === Math.floor(wVal)) ? String(wVal) : wVal.toFixed(2).replace(/0+$/, "");
        var hStr = (hVal === Math.floor(hVal)) ? String(hVal) : hVal.toFixed(2).replace(/0+$/, "");
        var name = wStr + ":" + hStr;

        return { name: name, w: wVal, h: hVal };
    }

    // ---------------------------------------------------------------
    // MAIN LOOP
    // ---------------------------------------------------------------
    var customRatio = null;
    var chosen = null;

    while (true) {
        var candidates = buildDisplayList(customRatio);
        var result = showDialog(candidates);

        if (result === null) return;

        if (result === "custom") {
            var newCustom = promptCustomRatio();
            if (newCustom !== null) {
                customRatio = newCustom;
            }
            continue;
        }

        chosen = result;
        break;
    }

    // ---------------------------------------------------------------
    // APPLY: Resize canvas
    //
    // suspendHistory in ExtendScript takes a code *string*, not a
    // function reference.
    // ---------------------------------------------------------------
    var origUnits = preferences.rulerUnits;
    preferences.rulerUnits = Units.PIXELS;

    try {
        doc.suspendHistory(
            "Add Ratio Border (" + chosen.name + ")",
            "var d = app.activeDocument;" +
            "d.resizeCanvas(UnitValue(" + chosen.canvasW + ",'px')," +
            "UnitValue(" + chosen.canvasH + ",'px')," +
            "AnchorPosition.MIDDLECENTER);"
        );
    } finally {
        preferences.rulerUnits = origUnits;
    }

})();
