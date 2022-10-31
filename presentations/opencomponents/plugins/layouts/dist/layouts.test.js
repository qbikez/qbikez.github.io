import LayoutsPlugin from "./layouts";
import * as fs from "fs";
import markdownit from "./markdown-it";
const parser = new DOMParser();
function loadLayout(path) {
    const content = fs.readFileSync(`../layouts/${path}`).toString();
    const { body: layout } = parser.parseFromString(content, "text/html");
    return layout;
}
describe("layouts plugin", () => {
    const layouts = new LayoutsPlugin();
    describe("front page layout", () => {
        const layout = loadLayout("guestline/005_Front-Page.html");
        describe("when theres only one header tag", () => {
            const { body: slide } = parser.parseFromString("<h1>I'm groot</h1>", "text/html");
            layouts.applyLayout({ layout, slide, deckHeight: 100, deckWidth: 100 });
            it("puts h1 into title placeholder", () => {
                expect(slide).toMatchSnapshot();
                expect(slide.querySelector("#id58").innerHTML.trim()).toBe(`<p class="a334" class-names="" cond-style-name="" style="">I'm groot</p>`);
            });
            it("removes all not-replaced placeholders", () => {
                expect(slide.textContent?.replaceAll(/\s/g, "")).toBe("I'mgroot");
            });
        });
    });
    describe("columns layout", () => {
        const layout = loadLayout("guestline/107_3-columns-with-icons---Dark.html");
        const md = `
# title A
## subtitle A

* some item A 1
  * some item A level 2
    * some item A level 3

# title B
## subtitle B

* some item B 1
  * some item B level 2
    * some item B level 3

# title C
## subtitle C

* some item C 1
  * some item C level 2
    * some item C level 3
    `;
        const html = markdownit.render(md);
        const slide = parser.parseFromString(html, "text/html").body;
        const applied = layouts.applyLayout({
            layout,
            slide,
            deckHeight: 100,
            deckWidth: 100,
        });
        //expect(applied.outerHTML).toMatchSnapshot();
        it("puts things on right positions", () => {
            const title1 = applied.querySelector("#id1095");
            const subtitle1 = applied.querySelector("#id1096");
            const list1 = applied.querySelector("#id1105");
            expect(title1.innerHTML).toMatchInlineSnapshot(`
"
<p class="a11176" class-names="" cond-style-name="" style="">title A</p>
"
`);
            expect(subtitle1.innerHTML).toMatchInlineSnapshot(`
"
<p class="a11179" class-names="" cond-style-name="" style="">subtitle A</p>
"
`);
            expect(list1.innerHTML).toMatchInlineSnapshot(`
"<ul>
<li style=";"><span style="display: inline-block">some item A 1
</span><ul>
<li style=";"><span style="display: inline-block">some item A level 2
</span><ul>
<li style=";"><span style="display: inline-block">some item A level 3</span></li>
</ul>
</li>
</ul>
</li>
</ul>"
`);
        });
    });
});
