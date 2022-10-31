export default class ShowSourcePlugin {
    id = "show-source";
    container;
    textContainer;
    deck;
    constructor() {
        this.container = document.createElement("div");
        this.container.id = "slide-source";
        const { pre, textContainer } = this.createTextContainer();
        this.textContainer = textContainer;
        this.container.appendChild(pre);
    }
    createTextContainer = () => {
        const textContainer = document.createElement("code");
        textContainer.classList.add("hljs");
        textContainer.style.maxHeight = "unset";
        const pre = document.createElement("pre");
        pre.classList.add("code-wrapper");
        pre.classList.add("language-markdown");
        pre.style.width = "100%";
        pre.appendChild(textContainer);
        return { pre, textContainer };
    };
    init = async (deck) => {
        this.deck = deck;
        this.container.style.position = "absolute";
        this.container.style.top = "0px";
        this.container.style.left = "0px";
        this.container.style.display = "flex";
        this.container.style.alignItems = "stretch";
        const deckWidth = deck.getConfig().width;
        const deckHeight = deck.getConfig().height;
        this.container.style.width = `${deckWidth}px`;
        this.container.style.height = `${deckHeight}px`;
        this.container.style.visibility = "hidden";
        this.container.style.zIndex = "100";
        this.textContainer.style.boxShadow = "2px 3px 5px white";
        deck.on("slidechanged", ({ indexh, indexv, previousSlide, currentSlide, origin, }) => {
            const srcElement = currentSlide.querySelector(".slide-source");
            if (srcElement) {
                const pre = this.getSlideSourcePreElement(currentSlide);
                srcElement.innerHTML = "";
                srcElement.appendChild(pre);
            }
        });
    };
    show = () => {
        const slide = this.deck.getCurrentSlide();
        this.container.style.top = `-${slide.offsetTop}px`;
        this.container.style.left = `-${slide.offsetLeft}px`;
        this.textContainer.innerText = slide?.dataset?.text;
        const hljs = this.deck.getPlugins()?.["highlight"]?.hljs;
        hljs?.highlightElement(this.textContainer);
        this.container.style.visibility = "visible";
        slide.appendChild(this.container);
    };
    hide = () => {
        this.container.style.visibility = "hidden";
    };
    toggle = () => {
        if (this.container.style.visibility === "hidden") {
            this.show();
        }
        else {
            this.hide();
        }
    };
    getSlideSource = (element) => {
        let parent = element;
        while (parent && parent.nodeName !== "SECTION") {
            parent = parent.parentElement;
        }
        return parent?.dataset?.text;
    };
    getSlideSourcePreElement = (element) => {
        const text = this.getSlideSource(element);
        const { pre, textContainer } = this.createTextContainer();
        textContainer.innerText = text || "";
        const hljs = this.deck.getPlugins()?.["highlight"]?.hljs;
        hljs?.highlightElement(textContainer);
        return pre;
    };
}
