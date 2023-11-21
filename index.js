"use strict";
const tags = ["a", "div", "h1", "p", "button"];
for (const tag of tags) {
    window[tag] = (...children) => {
        const newTag = new HtmlTag(tag, ...children);
        newTag.create();
        return newTag;
    };
    window[`$${tag}`] = (...children) => {
        return ReactiveHtmlTag.create(() => {
            const newTag = new ReactiveHtmlTag(tag, ...children);
            newTag.create();
            return newTag;
        });
    };
}
class HtmlTag {
    element;
    reactive;
    children;
    parent = null;
    type;
    constructor(type, ...children) {
        this.type = type;
        this.children = [];
        this.reactive = false;
        for (const child of children) {
            if (typeof child === "function") {
                this.children.push(...child());
            }
            else {
                this.children.push(child);
            }
        }
    }
    create() {
        this.element = document.createElement(this.type);
        for (const child of this.children) {
            if (typeof child === "string") {
                this.element.appendChild(document.createTextNode(child));
            }
            else {
                this.element.appendChild(child.element);
                child.parent = this;
            }
        }
    }
    destroy() {
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }
    }
    handle(handlerType, handler) {
        this.element.addEventListener(handlerType, () => handler(this));
        return this;
    }
    attr(attribute, value) {
        this.element.setAttribute(attribute, value);
        return this;
    }
    class(className) {
        this.element.classList.add(className);
        return this;
    }
}
class ReactiveHtmlTag extends HtmlTag {
    tagMethod;
    constructor(type, ...children) {
        super(type, ...children);
        this.reactive = true;
    }
    static create(tagMethod) {
        const tag = tagMethod();
        tag.tagMethod = tagMethod;
        return tag;
    }
    react() {
        const newElement = ReactiveHtmlTag.create(this.tagMethod);
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }
        this.element.replaceChildren(...newElement.children.map((child) => {
            if (child instanceof ReactiveHtmlTag) {
                const newChild = ReactiveHtmlTag.create(() => child);
                newChild.parent = this;
                return newChild.element;
            }
            else if (typeof child === "string") {
                return document.createTextNode(child);
            }
            else {
                return child.element;
            }
        }));
    }
    $handle(handlerType, handler, react = true) {
        const cb = () => {
            handler(this);
            if (!react) {
                return this;
            }
            let lastReactParent = this;
            let next = this.parent;
            while (next.parent !== null) {
                if (next.reactive) {
                    lastReactParent = lastReactParent.parent;
                }
                next = next.parent;
            }
            lastReactParent.react();
        };
        this.element.addEventListener(handlerType, cb);
        return this;
    }
}
const parentDiv = document.getElementById("main");
let count = 0;
const result = div($div(() => [
    `Count is ${count}`,
    $button(() => ["Click me!"])
        .$handle("click", () => {
        count++;
    })
        .class(count % 2 == 0 ? "green" : "red"),
    $div(() => [
        $button(() => ["Reset Button"]).$handle("click", () => (count = 0)),
    ]),
]).attr("id", "divWithButton"), a("This is the Text").attr("href", "#/helloWorld")).attr("id", "rootDiv");
parentDiv.appendChild(result.element);
