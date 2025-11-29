/* ================================================================
   GLOBAL DATA + PALETTE
================================================================== */
let precomputed = null;
let qapData = null;

const palette = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5",
    "#c49c94", "#f7b6d2"
];

/* We store these so highlight can restore original colors */
let qapColors = [];
let umapColors = [];

/* ================================================================
   1. LOAD JSONs
================================================================== */
async function loadPrecomputed() {
    const response = await fetch("precomputed_umap.json");
    precomputed = await response.json();
}

async function loadQAP() {
    const response = await fetch("qap_data.json");
    qapData = await response.json();
}

/* ================================================================
   2. Extract NN + MD values from precomputed JSON
================================================================== */
let NN_VALUES = [];
let MD_VALUES = [];
let KEYS = [];

function extractValues() {
    KEYS = Object.keys(precomputed.projections);

    const nnSet = new Set();
    const mdSet = new Set();

    KEYS.forEach(key => {
        const m = key.match(/n=([0-9]+),d=([0-9.]+)/);
        if (m) {
            nnSet.add(parseInt(m[1]));
            mdSet.add(parseFloat(m[2]));
        }
    });

    NN_VALUES = [...nnSet].sort((a, b) => a - b);
    MD_VALUES = [...mdSet].sort((a, b) => a - b);
}

/* ================================================================
   3. Sliders
================================================================== */
function configureSliders() {
    const nnSlider = document.getElementById("n_neighbors");
    nnSlider.min = 0;
    nnSlider.max = NN_VALUES.length - 1;
    nnSlider.step = 1;
    nnSlider.value = 0;
    document.getElementById("nn_val").innerText = NN_VALUES[0];

    const mdSlider = document.getElementById("min_dist");
    mdSlider.min = 0;
    mdSlider.max = MD_VALUES.length - 1;
    mdSlider.step = 1;
    mdSlider.value = 0;
    document.getElementById("md_val").innerText = MD_VALUES[0].toFixed(2);
}

function getKey() {
    const nnIdx = +document.getElementById("n_neighbors").value;
    const mdIdx = +document.getElementById("min_dist").value;

    const nn = NN_VALUES[nnIdx];
    const md = MD_VALUES[mdIdx];

    let key = `n=${nn},d=${md}`;
    if (KEYS.includes(key)) return key;

    key = `n=${nn},d=${md.toFixed(2)}`;
    if (KEYS.includes(key)) return key;

    return KEYS.find(k => k.startsWith(`n=${nn},d=`));
}

function drawQAPF() {
    const coords = qapData.coords;
    const rocks  = qapData.rocktypes;

    const uniqueRocks = [...new Set(rocks)];
    const colorMap = {};
    uniqueRocks.forEach((r, i) => colorMap[r] = palette[i % palette.length]);

    qapColors = rocks.map(r => colorMap[r]);

    Plotly.newPlot("qap_plot", [
        {
            type: "scatterternary",
            mode: "markers",

            a: coords.map(r => r[0]), // Quartz
            b: coords.map(r => r[1]), // Alkali Feldspar
            c: coords.map(r => r[2]), // Plagioclase

            marker: { size: 5, color: qapColors },

            // customdata stores BOTH index + rocktype
            customdata: rocks.map((r, i) => ({ i, r })),

            hovertemplate:
                "%{customdata.r}<extra></extra>"
        },
        {
            // overlay highlight
            type: "scatterternary",
            mode: "markers",
            a: [],
            b: [],
            c: [],
            marker: {
                size: 14,
                color: "white",
                line: { width: 2, color: "black" }
            },
            hoverinfo: "none"
        }
    ], {
        showlegend: false,
        ternary: {
            sum: 1,
            aaxis: { title: "Q" },
            baxis: { title: "A" },
            caxis: { title: "P" }
        },
        margin: { l: 35, r: 35, t: 0, b: 0, pad: 0 }
    });
}

function drawUMAP() {
    const key  = getKey();
    const emb  = precomputed.projections[key].embedding;
    const rocks = precomputed.projections[key].rocktype;

    const uniqueRocks = [...new Set(rocks)];
    const colorMap = {};
    uniqueRocks.forEach((r, i) => colorMap[r] = palette[i % palette.length]);
    umapColors = rocks.map(r => colorMap[r]);
    const indices = rocks.map((r, i) => i);

    Plotly.react("umap_plot", [
        {
            type: "scattergl",
            mode: "markers",
            x: emb.map(p => p[0]),
            y: emb.map(p => p[1]),
            marker: { size: 5, color: umapColors },
            customdata: rocks.map((r, i) => ({ i, r })),
            hovertemplate: "RockType: %{customdata.r}<extra></extra>"
        },
        {
            // highlight trace
            type: "scattergl",
            mode: "markers",
            x: [],
            y: [],
            marker: {
                size: 14,
                color: "white",
                line: { width: 2, color: "black" }
            },
            hoverinfo: "none"
        }
    ], {
        // TITLE RESTORED → this was your primary issue
        title: `UMAP — ${key}`,

        // REQUIRED TO PREVENT BROKEN REACTIVE UPDATES
        showlegend: false,

        margin: { l: 10, r: 10, t: 50, b: 10, pad: 0 },

        hovermode: "closest",
        hoverdistance: 5,
        spikedistance: -1,

        xaxis: {
            visible: false,
            showgrid: false,
            zeroline: false,
            showticklabels: false
        },
        yaxis: {
            visible: false,
            showgrid: false,
            zeroline: false,
            showticklabels: false
        }
    });
}

function highlight(index) {
    const q = qapData.coords[index];
    const key = getKey();
    const u = precomputed.projections[key].embedding[index];

    // QAP highlight (trace index 1)
    Plotly.restyle("qap_plot", {
        a: [[q[0]]],
        b: [[q[1]]],
        c: [[q[2]]]
    }, [1]);

    // UMAP highlight (trace index 1)
    Plotly.restyle("umap_plot", {
        x: [[u[0]]],
        y: [[u[1]]]
    }, [1]);
}

function clearHighlight() {
    Plotly.restyle("qap_plot", { a: [[]], b: [[]], c: [[]] }, [1]);
    Plotly.restyle("umap_plot", { x: [[]], y: [[]] }, [1]);
}

function throttle(fn, ms) {
    let last = 0;
    return (...args) => {
        const now = Date.now();
        if (now - last >= ms) {
            last = now;
            fn.apply(this, args);
        }
    };
}

const throttledHighlight = throttle((index) => highlight(index), 80);

function attachHoverEvents() {

    const qapDiv = document.getElementById("qap_plot");
    const umapDiv = document.getElementById("umap_plot");

    qapDiv.on("plotly_hover", (e) => {
        const index = e.points[0].customdata.i;
        throttledHighlight(index);
    });

    umapDiv.on("plotly_hover", (e) => {
        const index = e.points[0].customdata.i;
        throttledHighlight(index);
    });

    qapDiv.on("plotly_unhover", clearHighlight);
    umapDiv.on("plotly_unhover", clearHighlight);
}

document.getElementById("n_neighbors").addEventListener("input", e => {
    document.getElementById("nn_val").innerText = NN_VALUES[e.target.value];
    drawUMAP();
});

document.getElementById("min_dist").addEventListener("input", e => {
    document.getElementById("md_val").innerText = MD_VALUES[e.target.value].toFixed(2);
    drawUMAP();
});


(async () => {
    await loadQAP();
    await loadPrecomputed();
    extractValues();
    configureSliders();
    drawQAPF();
    drawUMAP();
    attachHoverEvents();
})();