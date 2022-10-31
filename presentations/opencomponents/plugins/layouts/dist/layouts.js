export default class LayoutsPlugin {
    id = "layouts";
    reveal;
    settings = {
        extractBackgrounds: true,
        backgroundGradient: undefined,
        stripUnusedPlaceholders: true,
        stripUnusedContent: false,
        enablePageNumbers: true,
        footer: "",
        layoutsDir: "",
        defaultLayouts: {
            slide: [],
            title: [],
            sectionTitle: [],
        },
    };
    defaultLayoutIdx = {};
    constructor(options = {}) {
        this.settings = {
            ...this.settings,
            ...options,
        };
        Object.keys(this.settings.defaultLayouts).forEach((k) => (this.defaultLayoutIdx[k] = 0));
    }
    init = async (deck) => {
        console.log("my custom plugin!");
        this.reveal = deck;
        deck.on("slidechanged", ({ indexh, indexv, previousSlide, currentSlide, origin }) => { });
        this.addStyle(`
      .layout {
        top: 0px;
        text-align: unset;
      }
    `);
        const slides = deck.getSlides(); // array of section elements
        // const resp = await fetch(
        //   `${this.settings.layoutsDir}/styles.css`
        // );
        // var css = document.createElement("style");
        // css.setAttribute("type", "text/css");
        // css.innerText = resp.body;
        // document.getElementsByTagName("head")[0].appendChild(css);
        const deckWidth = deck.getConfig().width;
        const deckHeight = deck.getConfig().height;
        for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
            const slide = slides[slideIdx];
            const layoutName = this.findDefaultLayout(slide, slideIdx);
            if (!layoutName)
                continue;
            const slideType = this.getSlideType(slide, slideIdx);
            console.log(`processing slide with layout '${layoutName}'`);
            slide.dataset.slideType = slideType;
            slide.dataset.resolvedLayout = layoutName;
            const lastSeparatorIdx = layoutName.lastIndexOf("/");
            const templatePath = lastSeparatorIdx > 0 ? layoutName.substring(0, lastSeparatorIdx) : ".";
            if (templatePath != ".")
                slide.classList.add(templatePath);
            slide.classList.add("layout");
            this.loadCss(`${this.settings.layoutsDir}/${templatePath}/styles.css`);
            const resp = await fetch(`${this.settings.layoutsDir}/${layoutName}.html`);
            let html = await resp.text();
            html = html.replace(/(["'])media\//g, `$1${this.settings.layoutsDir}/${templatePath}/media/`);
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, "text/html");
            const layout = doc.body;
            this.applyLayout({ deckWidth, deckHeight, layout, slide, slideType });
            slide.dataset.appliedLayout = layoutName;
            slide.dataset.slideType = slideType;
            //deck.syncSlide(slide);
        }
        console.log("layouts applied");
    };
    loadCss = (path) => {
        var existing = document.head.querySelector(`link[href="${path}"]`);
        if (existing)
            return;
        var fileref = document.createElement("link");
        fileref.setAttribute("rel", "stylesheet");
        fileref.setAttribute("type", "text/css");
        fileref.setAttribute("href", path);
        document.head.appendChild(fileref);
    };
    addStyle = (style) => {
        var styleNode = document.createElement("style");
        styleNode.innerText = style;
        document.head.appendChild(styleNode);
    };
    replaceText = (placeholder, source) => {
        const firstP = placeholder.querySelector("p");
        const div = placeholder.querySelector("div");
        if (typeof source !== "string") {
            const sourceNode = source;
            const wrapListItems = (container) => {
                const listItems = container.querySelectorAll("li");
                for (let i = 0; i < listItems.length; i++) {
                    const li = listItems[i];
                    for (let c = 0; c < li.childNodes.length; c++) {
                        const child = li.childNodes[c];
                        if (child.nodeName === "#text" && !!child.textContent?.trim()) {
                            const spanWrapper = document.createElement("span");
                            spanWrapper.setAttribute("style", "display: inline-block");
                            li.replaceChild(spanWrapper, child);
                            spanWrapper.appendChild(child);
                        }
                    }
                }
            };
            wrapListItems(sourceNode);
            const unwrapParagraph = (container) => {
                const p = container.children.length == 1 &&
                    container.children[0].nodeName == "P" &&
                    container.children[0];
                if (!p)
                    return;
                Array.from(p.children).forEach((ch) => {
                    p.removeChild(ch);
                    p.parentNode?.appendChild(ch);
                });
                p.remove();
            };
            const unwrapRecursive = (node, force = false) => {
                if (node.classList.contains("no-wrap") || force) {
                    unwrapParagraph(node);
                    force = true;
                }
                Array.from(node.children).forEach((ch) => {
                    unwrapRecursive(ch, force);
                });
            };
            unwrapRecursive(sourceNode);
        }
        const isSingle = typeof source === "string" || source.children.length == 0;
        const innerHtml = typeof source === "string"
            ? source
            : isSingle
                ? source.innerHTML
                : source.outerHTML;
        const targetNode = /*span*/ (isSingle && firstP) || div || placeholder;
        const paragraphStyle = (firstP && firstP.getAttribute("style")) || "";
        let currentNode = targetNode;
        while (currentNode !== placeholder) {
            Array.from(currentNode.parentNode.children).forEach((ch) => {
                if (ch !== currentNode) {
                    ch.remove();
                }
            });
            currentNode = currentNode.parentElement;
        }
        targetNode.innerHTML = innerHtml;
        if (!isSingle) {
            // if there's any inline style in the layout, we need to copy it
            // TODO: is there any? or is everything in the stylesheet.
            const children = targetNode.querySelectorAll("p,li");
            children.forEach((p) => {
                const curStyle = p.getAttribute("style") || "";
                p.setAttribute("style", paragraphStyle + ";" + curStyle);
            });
        }
        if (innerHtml === "") {
            placeholder.innerHTML = "";
        }
        placeholder.setAttribute("replaced", "true");
    };
    matchByOrder(layout, content, placeholderFilters = ["title", "subtitle", "outline", "object"]) {
        const placeholderOrder = ["title", "subtitle", "outline", "object"];
        const placeholderFilter = {
            title: ["h1", "h2"],
            subtitle: ["h1", "h2"],
            outline: ["*"],
            object: ["*"],
        };
        const placeholders = placeholderOrder
            .flatMap((value) => {
            return Array.from(layout.querySelectorAll(`[presentation-class='${value}']:not([replaced])`));
        })
            .filter((p) => !!p);
        const replaced = [];
        const nextMatchingPlaceholder = (contentEl) => {
            const notReplaced = placeholders.filter((p) => !replaced.includes(p));
            if (!notReplaced.length) {
                console.log("all placeholders were replaced. Nowhere to put element");
                console.log(contentEl);
                return null;
            }
            const matching = notReplaced.filter((p) => {
                const filter = placeholderFilter[p.getAttribute("presentation-class")];
                return (!filter ||
                    filter.includes(contentEl.nodeName.toLowerCase()) ||
                    filter.includes("*"));
            });
            if (!matching.length) {
                console.log("no placeholder matching element");
                console.log(contentEl);
                return null;
            }
            return matching?.length > 0 && matching[0];
            // placeholders
            // where placeholderFilter
            // where not replaced
        };
        let contentOrder = [];
        for (let i = 0; i < content.length; i++) {
            const child = content[i];
            contentOrder.push(child);
        }
        contentOrder = contentOrder.sort((a, b) => {
            const priority = (node) => (node.nodeName.startsWith("H") ? 0 : 1);
            return priority(a) - priority(b);
        });
        const match = [];
        for (let i = 0; i < contentOrder.length; i++) {
            const contentNode = contentOrder[i];
            const placeholder = nextMatchingPlaceholder(contentNode);
            if (placeholder) {
                replaced.push(placeholder);
                match.push({ placeholder, content: contentNode });
            }
        }
        const unusedPlaceholders = Array.from(layout.querySelectorAll(`[presentation-class]:not([replaced])`)).filter((p) => !replaced.includes(p));
        const unusedContent = contentOrder.filter((c) => match.filter((m) => m.content == c).length == 0);
        return { match, unusedPlaceholders, unusedContent };
    }
    matchByPosition(layout, content, placeholderFilters = ["title", "subtitle", "outline", "object"]) {
        const pixelValue = (v) => parseFloat(/([0-9\.]+)/.exec(v)?.[0] || "");
        const byLeft = (a, b) => pixelValue(a.style.left) + pixelValue(a.style.width) <=
            pixelValue(b.style.left)
            ? -1
            : pixelValue(b.style.left) + pixelValue(b.style.width) <=
                pixelValue(a.style.left)
                ? 1
                : 0;
        const byTop = (a, b) => pixelValue(a.style.top) + pixelValue(a.style.height) <=
            pixelValue(b.style.top)
            ? -1
            : pixelValue(b.style.top) + pixelValue(b.style.height) <=
                pixelValue(a.style.top)
                ? 1
                : 0;
        const placeholders = Array.from(layout.querySelectorAll("[presentation-class]"))
            .filter((p) => placeholderFilters.includes(p.getAttribute("presentation-class")))
            .sort(byTop)
            .sort(byLeft);
        const replaced = [];
        const nextMatchingPlaceholder = (contentEl) => {
            const notReplaced = placeholders.filter((p) => !replaced.includes(p));
            if (!notReplaced.length) {
                console.log("all placeholders were replaced. Nowhere to put element");
                console.log(contentEl);
                return null;
            }
            return notReplaced[0];
        };
        const contentOrder = Array.from(content);
        const match = [];
        for (let i = 0; i < contentOrder.length; i++) {
            const contentNode = contentOrder[i];
            const placeholder = nextMatchingPlaceholder(contentNode);
            if (placeholder) {
                replaced.push(placeholder);
                match.push({ placeholder, content: contentNode });
            }
        }
        const unusedPlaceholders = Array.from(layout.querySelectorAll(`[presentation-class]:not([replaced])`)).filter((p) => !replaced.includes(p));
        const unusedContent = contentOrder.filter((c) => match.filter((m) => m.content == c).length == 0);
        return { match, unusedPlaceholders, unusedContent };
    }
    applyLayout({ deckWidth, deckHeight, layout, slide, slideType, }) {
        const extractBackgrounds = slide.dataset.extractbackground !== undefined
            ? slide.dataset.extractbackground === "true"
            : this.settings.extractBackgrounds;
        if (extractBackgrounds) {
            this.processBackground({ slide, layout, deckWidth, deckHeight });
        }
        const backgroundGradient = slide.dataset.backgroundgradient !== undefined
            ? slide.dataset.backgroundgradient
            : this.settings.backgroundGradient;
        if (backgroundGradient && !slide.dataset.background) {
            slide.setAttribute("data-background-gradient", backgroundGradient);
        }
        const footer = layout.querySelector("[presentation-class='footer']");
        if (footer) {
            slide.footer = footer;
            this.replaceText(footer, this.settings.footer);
        }
        const pageNumber = layout.querySelector("[presentation-class='page-number']");
        if (pageNumber && this.settings.enablePageNumbers) {
            const slideNo = this.getSlideNumber(slide);
            this.replaceText(pageNumber, slideNo);
        }
        const matchMode = slide.dataset.matchmode;
        const matchFunction = matchMode == "byOrder"
            ? this.matchByOrder
            : matchMode == "byPosition"
                ? this.matchByPosition
                : slideType === "title" || slideType === "sectionTitle"
                    ? this.matchByOrder
                    : this.matchByPosition;
        const { match } = matchFunction(layout, Array.from(slide.children).filter((c) => !c.classList.contains("graphic")));
        if (matchMode == "none")
            return slide;
        match.forEach(({ placeholder, content }) => {
            this.replaceText(placeholder, content);
            content.remove();
        });
        const { match: matchedGraphic, unusedContent, unusedPlaceholders, } = matchFunction(layout, Array.from(slide.querySelectorAll(".graphic")), [
            "graphic",
        ]);
        matchedGraphic.forEach(({ placeholder, content }) => {
            this.replaceText(placeholder, content);
            content.remove();
        });
        if (this.settings.stripUnusedContent) {
            unusedContent.forEach((c) => {
                c.remove();
            });
        }
        if (this.settings.stripUnusedPlaceholders) {
            unusedPlaceholders.forEach((p) => {
                // TODO: maybe remove only visible content and leave the placeholder elements for debugging?
                p.remove();
            });
        }
        slide.innerHTML = layout.innerHTML;
        return slide;
    }
    getSlideNumber(slide = this.reveal.getCurrentSlide()) {
        let config = this.reveal.getConfig();
        let value;
        let format = "h.v";
        if (typeof config.slideNumber === "function") {
            value = config.slideNumber(slide);
        }
        else {
            // Check if a custom number format is available
            if (typeof config.slideNumber === "string") {
                format = config.slideNumber;
            }
            // If there are ONLY vertical slides in this deck, always use
            // a flattened slide number
            if (!/c/.test(format) && this.reveal.getHorizontalSlides().length === 1) {
                format = "c";
            }
            // Offset the current slide number by 1 to make it 1-indexed
            let horizontalOffset = slide && slide.dataset.visibility === "uncounted" ? 0 : 1;
            value = [];
            switch (format) {
                case "c":
                    value.push(this.reveal.getSlidePastCount(slide) + horizontalOffset);
                    break;
                case "c/t":
                    value.push(this.reveal.getSlidePastCount(slide) + horizontalOffset, "/", this.reveal.getTotalSlides());
                    break;
                default:
                    let indices = this.reveal.getIndices(slide);
                    value.push(indices.h + horizontalOffset);
                    let sep = format === "h/v" ? "/" : ".";
                    if (this.reveal.isVerticalSlide(slide))
                        value.push(sep, indices.v + 1);
            }
        }
        let url = "#" + this.reveal.location.getHash(slide);
        return this.formatNumber(value[0], value[1], value[2], url);
    }
    formatNumber(a, delimiter, b, url = "#" + this.reveal.location.getHash()) {
        if (typeof b === "number" && !isNaN(b)) {
            return `
					<span class="slide-number-a">${a}</span>
					<span class="slide-number-delimiter">${delimiter}</span>
					<span class="slide-number-b">${b}</span>
					`;
        }
        else {
            return `
					<span class="slide-number-a">${a}</span>
					`;
        }
    }
    processBackground({ layout, deckWidth, deckHeight, slide, }) {
        const backgrouds = Array.from(layout.querySelectorAll("div")).filter((div) => div.style.backgroundImage &&
            parseInt(div.parentElement.style.width) >= deckWidth &&
            parseInt(div.parentElement.style.height) >= deckHeight);
        if (backgrouds) {
            var selectedBackground = backgrouds.find((b) => b.style.backgroundImage.includes(".png"));
            if (selectedBackground) {
                var url = selectedBackground.style.backgroundImage
                    .replace('url("', "")
                    .replace('")', "");
                slide.setAttribute("data-background-image", url);
            }
            backgrouds.forEach((b) => {
                b.remove();
            });
        }
    }
    getSlideType(slide, slideIdx) {
        const tag = slide.dataset.layout?.startsWith(":") && slide.dataset.layout;
        if (slide.dataset.layout && !tag)
            return undefined;
        const isVerticalParent = slide.children.length > 0 && slide.children[0].nodeName === "SECTION";
        if (isVerticalParent)
            return undefined;
        let slideType;
        if (tag) {
            slideType = tag.substring(1);
        }
        else {
            slideType = "slide";
            if (slideIdx == 0 ||
                (slide.children.length == 1 && slide.children[0].nodeName == "H1"))
                slideType = "title";
            else if (slide.children.length == 1 && slide.children[0].nodeName == "H2")
                slideType = "sectionTitle";
        }
        return slideType;
    }
    findDefaultLayout(slide, slideIdx) {
        const slideType = this.getSlideType(slide, slideIdx);
        if (!slideType)
            return slide.dataset.layout;
        const defaults = this.settings.defaultLayouts?.[slideType];
        if (!defaults?.length)
            return undefined;
        const idx = this.defaultLayoutIdx[slideType];
        const layoutName = defaults[idx];
        this.defaultLayoutIdx[slideType] = (idx + 1) % defaults.length;
        return layoutName;
    }
}
