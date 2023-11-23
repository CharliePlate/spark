"use strict";
let scopes = {};
window.scopes = scopes;
const tagsList = [
    "a",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "p",
    "button",
    "img",
];
const makeTags = () => {
    for (const tag of tagsList) {
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
};
makeTags();
function isReactive(tag) {
    return tag.reactive;
}
class HtmlTag {
    element;
    reactive;
    children;
    parent = null;
    text;
    type;
    constructor(type, ...children) {
        this.type = type;
        this.children = [];
        this.reactive = false;
        for (const child of children) {
            if (typeof child === "function") {
                const result = child();
                if (Array.isArray(result)) {
                    for (const r of result) {
                        if (typeof r === "string") {
                            const t = new HtmlTag(type, []);
                            t.text = r;
                            this.children.push(t);
                        }
                        else {
                            this.children.push(r);
                        }
                    }
                }
            }
            else if (typeof child === "string") {
                const t = new HtmlTag(type, []);
                t.text = child;
                this.children.push(t);
            }
            else {
                this.children.push(child);
            }
        }
    }
    create() {
        this.element = document.createElement(this.type);
        for (const child of this.children) {
            if (child.text) {
                this.element.appendChild(document.createTextNode(child.text));
            }
            else {
                this.element.appendChild(child.element);
            }
            child.parent = this;
        }
    }
    // Does not clear the scopes of the children. If using destroy with potential reactive children,
    // ensure scopes are handled properly
    destroy() {
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }
        this.element.remove();
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
        if (className === "") {
            return this;
        }
        this.element.classList.add(className);
        return this;
    }
}
class ReactiveHtmlTag extends HtmlTag {
    renderFunc;
    scopes;
    constructor(type, ...children) {
        super(type, ...children);
        this.reactive = true;
        this.scopes = [];
    }
    static create(tagMethod) {
        const tag = tagMethod();
        tag.renderFunc = tagMethod;
        return tag;
    }
    react() {
        for (const child of this.children) {
            if (child instanceof ReactiveHtmlTag) {
                child.clearChildScopes();
            }
        }
        const newElement = ReactiveHtmlTag.create(this.renderFunc);
        this.children = newElement.children;
        this.element.replaceChildren(...newElement.children.map((child) => {
            if (child instanceof ReactiveHtmlTag) {
                const newChild = ReactiveHtmlTag.create(() => child);
                newChild.parent = this;
                return newChild.element;
            }
            else if (child.text) {
                return document.createTextNode(child.text);
            }
            else {
                return child.element;
            }
        }));
    }
    scope(scope) {
        if (typeof scope === "string") {
            scope = [scope];
        }
        this.scopes.push(...scope);
        for (const scopeName of scope) {
            if (!scopes[scopeName]) {
                scopes[scopeName] = new Set();
            }
            scopes[scopeName].add(this);
        }
        return this;
    }
    clearChildScopes() {
        for (const child of this.children) {
            if (child instanceof ReactiveHtmlTag) {
                child.clearChildScopes();
            }
        }
        for (const scope of this.scopes) {
            scopes[scope].delete(this);
        }
    }
    $handle(handlerType, handler) {
        const cb = () => {
            handler(this);
            let lastReactParent = this;
            let next = this;
            while (next.parent !== null) {
                if (isReactive(next)) {
                    lastReactParent = next;
                }
                next = next.parent;
            }
            lastReactParent.react();
        };
        this.element.addEventListener(handlerType, cb);
        return this;
    }
    $$handle(emitTo, handlerType, handler) {
        const cb = () => {
            handler(this);
            for (const scope of emitTo) {
                for (const element of scopes[scope]) {
                    element.react();
                }
            }
        };
        this.element.addEventListener(handlerType, cb);
        return this;
    }
}
class Router {
    routes;
    mounted;
    path;
    mountedRoute;
    SLUG_FALLBACK;
    constructor(routes) {
        this.SLUG_FALLBACK = "$$Slug";
        this.routes = routes;
        window.addEventListener("hashchange", () => {
            this.path = window.location.hash.slice(1);
            this.route();
        });
        this.path = window.location.hash.slice(1);
        if (!this.path && this.routes["/"]) {
            this.path = "/";
            this.mountedRoute = "/";
        }
        this.mounted = this.routes[this.path]
            ? this.routes[this.path]()
            : this.routes[404]
                ? this.routes[404]()
                : div("404 Not Found");
    }
    route() {
        scopes = {};
        if (this.routes[this.path]) {
            this.mounted.destroy();
            this.mounted = this.routes[this.path]();
        }
        else {
            this.mounted.destroy();
            this.mounted = this.routes["404"]
                ? this.routes["404"]()
                : div("404 Not Found");
        }
        document.getElementById("main").appendChild(this.mounted.element);
    }
    createNestedRoutes() {
        for (const route of Object.keys(this.routes)) {
            const split = route.split("/");
            for (const path in split) {
            }
        }
    }
}
const withRouter = (routes) => {
    const router = new Router(routes);
    return router.mounted;
};
let count = 0;
let shouldRotate = false;
const results = withRouter({
    "/": () => div(div($div(() => [`The Current Count is ${count}`]).scope("count"), $button(() => ["Click Me"]).$$handle(["count"], "click", () => {
        count++;
    })), $div(() => {
        return [
            $img()
                .attr("src", "https://picsum.photos/200/300")
                .$$handle(["rotate"], "click", () => {
                shouldRotate = !shouldRotate;
            })
                .class(shouldRotate ? "rotate" : ""),
        ];
    }).scope("rotate"), a("Nav to test").attr("href", "#/test"), $div(() => [`this is my count ${count}`]).scope("count")),
    "/test": () => div("test", a("Nav to home").attr("href", "#/"), a("Go to something unknown").attr("href", "#/unknown"), `${count}`).class("flex"),
    "404": () => div("This is what it would be like if there was a custom 404 page", div(a("Go home").attr("href", "#/"))),
});
document.getElementById("main").appendChild(results.element);
