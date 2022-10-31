export class Color {
    r;
    g;
    b;
    a;
    constructor(r, g, b, a = undefined) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    equals(c) {
        return c.r == this.r && c.g == this.g && c.b == this.g && c.a == this.a;
    }
    toString() {
        return `rgb(${this.r}, ${this.g}, ${this.b})`;
    }
    static parse(text) {
        if (!text)
            return undefined;
        const rgbMatch = /rgb\s*\((?<red>[0-9]+)\s*,\s*(?<green>[0-9]+)\s*,\s*(?<blue>[0-9]+)\s*\)/.exec(text);
        if (rgbMatch?.groups) {
            return new Color(parseInt(rgbMatch.groups["red"]), parseInt(rgbMatch.groups["green"]), parseInt(rgbMatch.groups["blue"]));
        }
        const hexMatch = /#(?<red>[0-9a-fA-F]{2})(?<green>[0-9a-fA-F]{2})(?<blue>[0-9a-fA-F]{2})/.exec(text);
        if (hexMatch?.groups) {
            return new Color(parseInt(hexMatch.groups["red"], 16), parseInt(hexMatch.groups["green"], 16), parseInt(hexMatch.groups["blue"], 16));
        }
        return undefined;
    }
}
const colorAttributes = [
    "fill",
    "color",
    "stroke",
    "background-color",
    "backgroundColor",
];
export default class EmbeddSvgsPlugin {
    settings = {
        autoscale: true,
        defaultTheme: "light",
        themes: {
            dark: {
                colors: [[new Color(0, 0, 0), new Color(0, 0, 0)]],
            },
            light: {
                colors: [[new Color(0, 0, 0), new Color(0, 0, 0)]],
            },
        },
    };
    id = "embedd-svgs";
    deck;
    constructor(options = {}) {
        this.settings = {
            ...this.settings,
            ...options,
        };
    }
    init = async (deck) => {
        this.deck = deck;
        const slides = deck.getSlides();
        for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
            const slide = slides[slideIdx];
            const isVerticalParent = slide.children.length > 0 && slide.children[0].nodeName === "SECTION";
            if (isVerticalParent)
                continue;
            const theme = slide.dataset.theme || this.settings.defaultTheme;
            const imgs = Array.from(slide.querySelectorAll("img")).filter((i) => i.src?.endsWith(".svg") && !i.classList.contains("no-embedd"));
            const svgs = await Promise.all(imgs.map(async (img) => {
                const svg = await this.embeddImage(img);
                await this.replaceColors(svg, this.settings.themes[theme]);
                await this.processFragments(svg, img);
                return svg;
            }));
        }
    };
    replaceColor(colorText, theme) {
        const color = Color.parse(colorText);
        if (color) {
            const map = theme.colors.find(([from, to]) => from.equals(color));
            if (map) {
                const [from, to] = map;
                return to.toString();
            }
        }
        return colorText;
    }
    async replaceColors(svg, theme) {
        Array.from(svg.children).forEach((child) => {
            child
                .getAttributeNames()
                .filter((a) => colorAttributes.includes(a))
                .forEach((a) => {
                const colorText = child.getAttribute(a) || "";
                child.setAttribute(a, this.replaceColor(colorText, theme));
            });
            const styles = Object.entries(child.style);
            styles
                .filter(([key, value]) => value && colorAttributes.includes(key))
                .forEach(([key, value]) => {
                child.style[key] = this.replaceColor(value, theme);
            });
            this.replaceColors(child, theme);
        });
    }
    async embeddImage(img) {
        const resp = await fetch(img.src);
        const wrapper = document.createElement("div");
        img.getAttributeNames().forEach((attr) => {
            wrapper.setAttribute(attr, img.getAttribute(attr) || "");
        });
        wrapper.style.display = wrapper.style.display || "inline-block";
        wrapper.innerHTML = await resp.text();
        img.replaceWith(wrapper);
        const svg = wrapper.children[0];
        svg.setAttribute("width", "");
        svg.setAttribute("height", "");
        if (this.settings.autoscale) {
            wrapper.style.width = wrapper.style.width || "100%";
        }
        return svg;
    }
    processFragments(svg, img) {
        const slideFragments = img.dataset.fragments?.split("|");
        if (slideFragments) {
            for (let idx = 0; idx < slideFragments.length; idx++) {
                const f = slideFragments[idx];
                const ids = f.split(",");
                ids.forEach((id) => {
                    const el = svg.querySelector(`#${id}`);
                    if (!el)
                        return;
                    el.classList.add("fragment");
                    el.dataset.fragmentIndex = `${idx}`;
                });
            }
        }
        const svgFragments = svg.querySelectorAll("[data-fragment-index]");
        svgFragments.forEach(f => f.classList.add("fragment"));
    }
}
