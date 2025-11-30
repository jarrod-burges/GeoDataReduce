import {GlobalHoverLinker} from "./linked_hover.js";

const palette = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5",
    "#c49c94", "#f7b6d2"
];

function computeRange(coords) {
    const xs = [], ys = [];
    for (const p of coords) {
        if (Array.isArray(p) && p.length >= 2) {
            xs.push(p[0]);
            ys.push(p[1]);
        } else if (p && typeof p === "object" && "x" in p && "y" in p) {
            xs.push(p.x);
            ys.push(p.y);
        }
    }
    if (xs.length === 0) return {xRange: [-1, 1], yRange: [-1, 1]};

    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1;
    const padX = 0.05 * xSpan, padY = 0.05 * ySpan;

    return {
        xRange: [xMin - padX, xMax + padX],
        yRange: [yMin - padY, yMax + padY]
    };
}

export class SinglePlot {
    constructor(config) {
        this.elementId = config.elementId;
        this.isUMAP = config.isUMAP;
        this.json = config.json;
        this.coordsKey = config.coordsKey;
        this.colorKey = config.colorKey;
        this.title = config.title || "";

        this.initialized = false;
        if (this.isUMAP) {
            this.createUMAPControls();
        }
    }

    createUMAPControls() {
        const container = document.getElementById(this.elementId);

        // build wrapper
        this.umapPanel = document.createElement("div");
        this.umapPanel.className = "umap-controls";
        this.umapPanel.style.marginTop = "10px";
        this.umapPanel.style.padding = "8px 12px";
        this.umapPanel.style.border = "1px solid #ccc";
        this.umapPanel.style.borderRadius = "6px";
        this.umapPanel.style.background = "#fafafa";

        // Title
        const title = document.createElement("div");
        title.innerHTML = "<b>UMAP Parameters</b>";
        title.style.marginBottom = "6px";
        this.umapPanel.appendChild(title);

        // n_neighbors slider
        this.nnVal = document.createElement("span");
        const nnBlock = document.createElement("div");
        nnBlock.innerHTML = `
            <label>n_neighbors: </label>
            <span id="${this.elementId}_nnVal"></span>
        `;
        this.nnSlider = document.createElement("input");
        this.nnSlider.type = "range";
        this.nnSlider.min = 0;
        this.nnSlider.max = 0;
        this.nnSlider.step = 1;
        this.nnSlider.value = 0;
        nnBlock.appendChild(this.nnSlider);
        this.umapPanel.appendChild(nnBlock);

        // min_dist slider
        const mdBlock = document.createElement("div");
        mdBlock.innerHTML = `
            <label>min_dist: </label>
            <span id="${this.elementId}_mdVal"></span>
        `;
        this.mdSlider = document.createElement("input");
        this.mdSlider.type = "range";
        this.mdSlider.min = 0;
        this.mdSlider.max = 0;
        this.mdSlider.step = 1;
        this.mdSlider.value = 0;
        mdBlock.appendChild(this.mdSlider);
        this.umapPanel.appendChild(mdBlock);

        // append panel
        container.parentElement.appendChild(this.umapPanel);

        // bind events
        this.nnSlider.addEventListener("input", () => this.draw());
        this.mdSlider.addEventListener("input", () => this.draw());
    }

    async load() {
        this.data = await (await fetch(this.json)).json();

        if (this.isUMAP) {
            this.extractUMAPValues();
        }

        this.draw();
    }

    extractUMAPValues() {
        if (!this.isUMAP) return;
        const proj = this.data.projections;
        const keys = Object.keys(proj);

        const nnSet = new Set();
        const mdSet = new Set();

        for (const key of keys) {
            const m = key.match(/n=([0-9]+),d=([0-9.]+)/);
            if (m) {
                nnSet.add(parseInt(m[1]));
                mdSet.add(parseFloat(m[2]));
            }
        }

        this.nnValues = [...nnSet].sort((a,b)=>a-b);
        this.mdValues = [...mdSet].sort((a,b)=>a-b);

        this.nnSlider.max = this.nnValues.length - 1;
        this.mdSlider.max = this.mdValues.length - 1;

        document.getElementById(`${this.elementId}_nnVal`).innerText =
            this.nnValues[this.nnSlider.value];

        document.getElementById(`${this.elementId}_mdVal`).innerText =
            this.mdValues[this.mdSlider.value].toFixed(2);
    }

    mergeCoords(source, keys) {
        if (!Array.isArray(keys)) keys = [keys];
        const merged = [];
        for (const key of keys) {
            const block = source[key];
            if (!Array.isArray(block)) continue;
            for (const p of block) {
                if (Array.isArray(p) && p.length >= 2) merged.push({x: p[0], y: p[1]});
                else if (p && typeof p === "object" && "x" in p && "y" in p)
                    merged.push({x: p.x, y: p.y});
            }
        }
        return merged;
    }

    mergeColors(source, keys, n) {
        if (!Array.isArray(keys)) keys = [keys];
        let merged = [];
        for (const key of keys) {
            const block = source[key];
            if (Array.isArray(block)) merged.push(...block);
        }
        if (merged.length === 0) merged = Array.from({length: n}, () => "Unknown");
        return merged;
    }

    draw() {
        const d = this.data;

        let key = null;
        let source = d;

        if (this.isUMAP) {
            const nn = this.nnValues[this.nnSlider.value];
            const md = this.mdValues[this.mdSlider.value];

            let key = `n=${nn},d=${md}`;

            if (!(key in d.projections)) {
                for (let digits = 5; digits >= 0; digits--) {
                    const mdFixed = md.toFixed(digits);
                    const tryKey = `n=${nn},d=${mdFixed}`;
                    if (tryKey in d.projections) {
                        key = tryKey;
                        break;
                    }
                }
            }

            if (!(key in d.projections)) {
                const prefix = `n=${nn},d=`;
                const fallback = Object.keys(d.projections).find(k => k.startsWith(prefix));
                key = fallback || Object.keys(d.projections)[0];
            }

            source = d.projections[key];

            document.getElementById(`${this.elementId}_nnVal`).innerText = nn;
            document.getElementById(`${this.elementId}_mdVal`).innerText = md.toFixed(2);
        }

        const coords = this.mergeCoords(source, this.coordsKey);
        // Static global color list must come from root JSON
        let mergedColors;

        if (this.isUMAP) {
            mergedColors = this.mergeColors(this.data, this.colorKey, coords.length);
        }
        else {
            mergedColors = this.mergeColors(source, this.colorKey, coords.length);
        }

        const cats = [...new Set(mergedColors)];
        const cMap = {};
        cats.forEach((c, i) => cMap[c] = palette[i % palette.length]);
        const colors = mergedColors.map(r => cMap[r]);

        const {xRange, yRange} = computeRange(coords);

        const div = document.getElementById(this.elementId);
        const width = div.parentElement.clientWidth - 20;

        const traces = [{
            type: "scattergl",
            mode: "markers",
            x: coords.map(p => p.x),
            y: coords.map(p => p.y),
            customdata: mergedColors.map((r, i) => ({i, r})),
            marker: {size: 5, color: colors, cliponaxis: false},
            hovertemplate: "%{customdata.r}<extra></extra>"
        }];

        const layout = {
            width,
            height: 450,
            autosize: false,
            showlegend: false,
            title: key ? `${this.title} — ${key}` : this.title,
            margin: {l: 10, r: 10, t: 40, b: 10},
            hovermode: "closest",
            xaxis: {visible: false, fixedrange: true, range: xRange},
            yaxis: {visible: false, fixedrange: true, range: yRange},
            hoverlabel: {align: "left", namelength: -1}
        };

        if (!this.initialized) {
            Plotly.newPlot(this.elementId, traces, layout, {displayModeBar: false});
            this.initialized = true;
        } else {
            Plotly.react(this.elementId, traces, layout);
        }
    }
}