import {GlobalHoverLinker} from "./linked_hover.js";

const palette = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5",
    "#c49c94", "#f7b6d2"
];

function computeRange(coords) {
    const xs = [];
    const ys = [];

    for (const p of coords) {
        if (Array.isArray(p) && p.length >= 2) {
            xs.push(p[0]); ys.push(p[1]);
        } else if (p && typeof p === "object" && "x" in p && "y" in p) {
            xs.push(p.x); ys.push(p.y);
        }
    }

    if (xs.length === 0 || ys.length === 0) {
        return { xRange: [-1, 1], yRange: [-1, 1] };
    }

    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);

    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;

    const padX = xSpan * 0.05;
    const padY = ySpan * 0.05;

    return {
        xRange: [xMin - padX, xMax + padX],
        yRange: [yMin - padY, yMax + padY]
    };
}

function toXY(p) {
    if (Array.isArray(p) && p.length >= 2) {
        return { x: p[0], y: p[1] };
    } else if (p && typeof p === "object" && "x" in p && "y" in p) {
        return { x: p.x, y: p.y };
    }
    return { x: NaN, y: NaN };
}

export class PlotPair {

    constructor(config) {
        this.left = config.leftPlot;
        this.right = config.rightPlot;

        this.left.initialized = false;
        this.right.initialized = false;

        GlobalHoverLinker.registerPair(this);
    }

    async load() {
        const leftPath = `${this.left.json}`;
        const rightPath = `${this.right.json}`;

        this.left.data  = await (await fetch(leftPath)).json();
        this.right.data = await (await fetch(rightPath)).json();

        this.drawLeft();
        this.drawRight();

        GlobalHoverLinker.link(this);
    }

    mergeCoords(data, keys) {
        if (!Array.isArray(keys)) keys = [keys];

        const merged = [];

        for (const key of keys) {
            const block = data[key];
            if (!Array.isArray(block)) continue;

            for (const p of block) {
                merged.push(toXY(p));
            }
        }
        return merged;
    }

    mergeColors(data, keys, fallbackCount = 0) {
        if (!Array.isArray(keys)) keys = [keys];

        let merged = [];

        for (const key of keys) {
            const block = data[key];
            if (Array.isArray(block)) merged.push(...block);
        }

        if (merged.length === 0) {
            console.warn("No valid color fields. Using 'Unknown'.");
            merged = Array.from({length: fallbackCount}, () => "Unknown");
        }

        return merged;
    }

    drawLeft() {
        const d = this.left.data;

        const coords = this.mergeCoords(d, this.left.coordsKey);
        this.left.coords = coords;

        const mergedColors = this.mergeColors(d, this.left.colorKey, coords.length);

        const cats = [...new Set(mergedColors)];
        const colorMap = {};
        cats.forEach((c,i)=> colorMap[c] = palette[i % palette.length]);

        const colors = mergedColors.map(r => colorMap[r]);
        this.left.colors = colors;

        const { xRange, yRange } = computeRange(coords);

        const div   = document.getElementById(this.left.elementId);
        const width = div.parentElement.clientWidth - 20;

        const data = [
            {
                type: "scattergl",
                mode: "markers",
                x: coords.map(p => p.x),
                y: coords.map(p => p.y),

                customdata: coords.map((p,i)=>({ i, r: mergedColors[i] })),

                marker: { size: 5, color: colors, cliponaxis: false },
                hovertemplate: "%{customdata.r}<extra></extra>"
            },
            {
                type: "scattergl",
                mode: "markers",
                x: [], y: [],
                marker: {
                    size: 12, color: "white",
                    line: { width: 2, color: "black" },
                    cliponaxis: false
                },
                hoverinfo: "none"
            }
        ];

        const layout = {
            width, height: 450,
            autosize: false,
            showlegend: false,
            title: this.left.title,
            margin: {l:10, r:10, t:40, b:10},
            hovermode: "closest",
            xaxis: {visible:false, range:xRange, fixedrange:true},
            yaxis: {visible:false, range:yRange, fixedrange:true},
            hoverlabel: {align:"left", namelength:-1}
        };

        if (!this.left.initialized) {
            Plotly.newPlot(this.left.elementId, data, layout, {displayModeBar:false});
            this.left.initialized = true;
        } else {
            Plotly.react(this.left.elementId, data, layout);
        }
    }

    drawRight() {
        const d = this.right.data;

        const key = this.right.paramKeyFunction
            ? this.right.paramKeyFunction(d)
            : null;

        const rawCoords = key
            ? d.projections[key][this.right.coordsKey]
            : d[this.right.coordsKey];

        const coords = rawCoords.map(p => toXY(p));

        let colorField =
            (key && d.projections[key][this.right.colorKey]) ||
            d[this.right.colorKey] ||
            d.rocktypes;

        if (!colorField) {
            console.warn("No color field found for right plot. Using 'Unknown'.");
            colorField = coords.map(() => "Unknown");
        }

        const categories = [...new Set(colorField)];
        const colorMap = {};
        categories.forEach((c, i) => (colorMap[c] = palette[i % palette.length]));

        const colors = colorField.map(r => colorMap[r]);

        this.right.coords = coords;
        this.right.colors = colors;

        const { xRange, yRange } = computeRange(coords);

        const div = document.getElementById(this.right.elementId);
        const width = div.parentElement.clientWidth - 20;

        const data = [
            {
                type: "scattergl",
                mode: "markers",
                x: coords.map(p => p.x),
                y: coords.map(p => p.y),

                customdata: coords.map((p,i)=>({ i, r: colorField[i] })),

                marker: { size: 5, color: colors, cliponaxis: false },
                hovertemplate: "%{customdata.r}<extra></extra>"
            },
            {
                type: "scattergl",
                mode: "markers",
                x: [],
                y: [],
                marker: {
                    size: 12,
                    color: "white",
                    line: { width: 2, color: "black" },
                    cliponaxis: false
                },
                hoverinfo: "none"
            }
        ];

        const layout = {
            width: width,
            height: 450,
            autosize: false,
            showlegend: false,
            title: this.right.title,
            margin: { l: 10, r: 10, t: 40, b: 10 },
            hovermode: "closest",
            xaxis: {
                visible: false,
                range: xRange,
                fixedrange: true,
                autorange: false
            },
            yaxis: {
                visible: false,
                range: yRange,
                fixedrange: true,
                autorange: false
            },
            hoverlabel: {
                align: "left",
                namelength: -1
            }
        };

        if (!this.right.initialized) {
            Plotly.newPlot(this.right.elementId, data, layout, {displayModeBar:false});
            this.right.initialized = true;
        } else {
            Plotly.react(this.right.elementId, data, layout);
        }
    }

    highlight(index) {
        const lp = toXY(this.left.coords[index]);
        Plotly.restyle(this.left.elementId, {x:[[lp.x]], y:[[lp.y]]}, [1]);

        const rp = toXY(this.right.coords[index]);
        Plotly.restyle(this.right.elementId, {x:[[rp.x]], y:[[rp.y]]}, [1]);
    }

    clear() {
        Plotly.restyle(this.left.elementId, {x:[[]], y:[[]]}, [1]);
        Plotly.restyle(this.right.elementId, {x:[[]], y:[[]]}, [1]);
    }
}