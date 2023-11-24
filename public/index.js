"use strict";
let scopes = {};
window.scopes = scopes;
const ROUTER_RENDER_KEY = "$$RENDER";
const ROUTER_SLUG_KEY = "$$SLUG_NAME";
const ROUTER_SLUG_FALLBACK = "$$Slug";
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
    "input",
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
function isRenderer(route) {
    return route[ROUTER_RENDER_KEY] !== undefined;
}
function isSlugFallback(route) {
    return ROUTER_SLUG_FALLBACK in route;
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
                            const t = new HtmlTag(type);
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
                const t = new HtmlTag(type);
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
    static create(render) {
        const tag = render();
        tag.renderFunc = render;
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
    parsedRoute;
    mounted;
    path;
    mountedRoute;
    constructor(routes) {
        this.parsedRoute = {};
        this.routes = routes;
        this.createNestedRoutes();
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
        const split = this.path.split("/").filter((path) => path !== "");
        let curr = this.parsedRoute;
        const slugs = {};
        if (split.length === 0) {
            this.navigate(this.parsedRoute["/"]
                ? this.parsedRoute["/"][ROUTER_RENDER_KEY]
                : () => div("404 Not Found"));
            return;
        }
        for (const path of split) {
            if (!curr[path]) {
                if (isSlugFallback(curr)) {
                    slugs[curr[ROUTER_SLUG_FALLBACK][ROUTER_SLUG_KEY]] = path;
                    curr = curr[ROUTER_SLUG_FALLBACK];
                }
                else {
                    this.navigate(this.parsedRoute["404"]
                        ? this.parsedRoute["404"][ROUTER_RENDER_KEY]
                        : () => div("404 Not Found"));
                }
            }
            else {
                curr = curr[path];
            }
        }
        if (isRenderer(curr)) {
            this.mountedRoute = this.path;
            this.navigate(curr[ROUTER_RENDER_KEY], slugs);
        }
        else {
            this.navigate(this.parsedRoute["404"]
                ? this.parsedRoute["404"][ROUTER_RENDER_KEY]
                : () => div("404 Not Found"));
        }
    }
    navigate(route, slugs) {
        const r = route(slugs);
        this.mounted.destroy();
        this.mounted = r;
        this.mounted.create();
        document.getElementById("main").appendChild(this.mounted.element);
    }
    createNestedRoutes() {
        for (const route of Object.keys(this.routes)) {
            if (route === "/") {
                this.parsedRoute[route] = {
                    [ROUTER_RENDER_KEY]: this.routes[route],
                };
                continue;
            }
            let curr = this.parsedRoute;
            const split = route.split("/");
            split.forEach((path, index) => {
                if (path === "") {
                    return;
                }
                const isSlug = path.startsWith(":");
                const key = isSlug ? ROUTER_SLUG_FALLBACK : path;
                if (index === split.length - 1) {
                    if (isSlug) {
                        curr[key] = {
                            [ROUTER_SLUG_KEY]: path.slice(1),
                            [ROUTER_RENDER_KEY]: this.routes[route],
                        };
                    }
                    else {
                        curr[key] = {
                            [ROUTER_RENDER_KEY]: this.routes[route],
                        };
                    }
                }
                else {
                    if (isSlug) {
                        curr[key] = {
                            ...curr[key],
                            [ROUTER_SLUG_FALLBACK]: {},
                            [ROUTER_SLUG_KEY]: path.slice(1),
                        };
                    }
                    else {
                        curr[key] = { ...curr[key] };
                    }
                }
                curr = curr[key];
            });
        }
    }
}
const withRouter = (routes) => {
    const router = new Router(routes);
    return router.mounted;
};
let count = 0;
let savedTest = "";
const results = withRouter({
    "/": () => div(() => {
        let test = "";
        let shouldRotate = false;
        return [
            div($div(() => [`The Current Count is ${count}`]).scope("count"), $button(() => ["Click Me"]).$$handle(["count"], "click", () => {
                count++;
            })),
            $div(() => {
                return [
                    $img()
                        .attr("src", "https://picsum.photos/200/300")
                        .$$handle(["rotate"], "click", () => {
                        shouldRotate = !shouldRotate;
                    })
                        .class(shouldRotate ? "rotate" : ""),
                ];
            }).scope("rotate"),
            a("Nav to test").attr("href", "#/test"),
            $div(() => [`this is my count ${count}`]).scope("count"),
            div($div(() => [`This is my input ${test}`]).scope("inputchange"), $input()
                .attr("value", savedTest)
                .$$handle(["inputchange"], "input", (element) => {
                test = element.element.value;
            }), $button(() => ["Save Test"]).handle("click", () => {
                savedTest = test;
            })),
        ];
    }),
    "/test": () => div("here"),
    "/test/:test123/:test1234": (slugs) => div("test", div(`Slug 1 is ${slugs?.test123}`), div(`Slug 2 is ${slugs?.test1234}`), a("Nav to home").attr("href", "#/"), a("Go to something unknown").attr("href", "#/unknown"), `${count}`).class("flex"),
    "404": () => div("This is what it would be like if there was a custom 404 page", div(a("Go home").attr("href", "#/"))),
});
document.getElementById("main").appendChild(results.element);
