export class HoverLinker {

    constructor() {
        this.pairs = [];
        this.throttleTime = 250;
        this.last = 0;
    }

    registerPair(pair) {
        this.pairs.push(pair);
    }

    throttle(fn) {
        return (...args) => {
            const now = Date.now();
            if (now - this.last >= this.throttleTime) {
                this.last = now;
                fn(...args);
            }
        }
    }

    link(pair) {
        const leftDiv  = document.getElementById(pair.left.elementId);
        const rightDiv = document.getElementById(pair.right.elementId);

        const handleHover = src => e => {
            const idx = e.points[0].pointIndex;  // <- this is the index we use
            pair.highlight(idx);
        };

        const handleUnhover = () => pair.clear();

        leftDiv.on("plotly_hover", handleHover("left"));
        rightDiv.on("plotly_hover", handleHover("right"));

        leftDiv.on("plotly_unhover", handleUnhover);
        rightDiv.on("plotly_unhover", handleUnhover);
    }
}

export const GlobalHoverLinker = new HoverLinker();
