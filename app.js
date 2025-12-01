import { PlotPair } from "./plot_manager.js";
import { SinglePlot } from "./single_plot.js";

async function extractUMAPSliderValues() {
    const pre = await (await fetch("precomputed_umap_qap.json")).json();
    const keys = Object.keys(pre.projections);

    const nnSet = new Set();
    const mdSet = new Set();

    for (const key of keys) {
        const m = key.match(/n=([0-9]+),d=([0-9.]+)/);
        if (!m) continue;
        nnSet.add(parseInt(m[1]));
        mdSet.add(parseFloat(m[2]));
    }

    window.NN_VALUES = [...nnSet].sort((a,b)=>a-b);
    window.MD_VALUES = [...mdSet].sort((a,b)=>a-b);
}

function getUMAPKey(d) {
    const keys = Object.keys(d.projections);

    const nn = NN_VALUES[+n_neighbors.value];
    const md = MD_VALUES[+min_dist.value];

    let k = `n=${nn},d=${md}`;
    if (keys.includes(k)) return k;

    k = `n=${nn},d=${md.toFixed(2)}`;
    if (keys.includes(k)) return k;

    return keys.find(x => x.startsWith(`n=${nn},d=`));
}

function configureSliders() {
    n_neighbors.min   = 0;
    n_neighbors.max   = NN_VALUES.length - 1;
    n_neighbors.value = 0;

    min_dist.min   = 0;
    min_dist.max   = MD_VALUES.length - 1;
    min_dist.value = 0;

    nn_val.innerText = NN_VALUES[0];
    md_val.innerText = MD_VALUES[0].toFixed(2);
}

const pair1 = new PlotPair({
    leftPlot: {
        elementId: "qap_plot",
        json: "qapf_data.json",
        title: "QAP Diagram",
        type: "ternary",
        coordsKey: "coords_qap",
        colorKey: "rocktypes_qap"
    },
    rightPlot: {
        elementId: "umap_plot",
        json: "precomputed_umap_qap.json",
        title: "UMAP Projection QAP",
        type: "scatter",
        coordsKey: "embedding",
        colorKey: "rocktype",
        paramKeyFunction: getUMAPKey
    }
});

const qap_plot_intext = new SinglePlot({
    elementId: "qap_plot_intext",
    json: "precomputed_umap_qap_intext.json",
    coordsKey: "embedding",
    colorKey: "rocktype",
    title: "QAP UMAP With Intrusive and Extrusive Rocks",
    isUMAP: true
});

const metamorphic_plot = new SinglePlot({
    elementId: "metamorphic_binary_plot",
    json: "metamorphic_binary_umap.json",
    coordsKey: "embedding",
    colorKey: "rocktype",
    title: "Metamorphic - Mineral Assemblage UMAP Projection",
    isUMAP: true
});

const metamorphic_comp_plot = new SinglePlot({
    elementId: "metamorphic_comp_plot",
    json: "metamorphic_comp_umap.json",
    coordsKey: "embedding",
    colorKey: "rocktype",
    title: "Metamorphic - Mineral Assemblage With Percentages UMAP Projection",
    isUMAP: true
});

const sedimentary_plot = new SinglePlot({
    elementId: "sedimentary_plot",
    json: "sedimentary_umap.json",
    coordsKey: "embedding",
    colorKey: "rocktype",
    title: "Sedimentary - Dott (1964) UMAP Projection",
    isUMAP: true
});

(async () => {

    await extractUMAPSliderValues();
    configureSliders();

    n_neighbors.addEventListener("input", () => {
        nn_val.innerText = NN_VALUES[n_neighbors.value];
        pair1.drawRight();
    });

    min_dist.addEventListener("input", () => {
        md_val.innerText = MD_VALUES[min_dist.value].toFixed(2);
        pair1.drawRight();
    });

    await pair1.load();
    await qap_plot_intext.load();
    await metamorphic_plot.load();
    await metamorphic_comp_plot.load();
    await sedimentary_plot.load();
})();
