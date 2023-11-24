let scopes: Record<string, Set<ReactiveHtmlTag>> = {};
(window as any).scopes = scopes;

const ROUTER_RENDER_KEY = "$$RENDER";
const ROUTER_SLUG_KEY = "$$SLUG_NAME";
const ROUTER_SLUG_FALLBACK = "$$Slug";

const tagsList: Tag[] = [
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
    (window as any)[tag] = (...children: ChildType[]) => {
      const newTag = new HtmlTag(tag, ...children);
      newTag.create();
      return newTag;
    };

    (window as any)[`$${tag}`] = (...children: ChildType[]) => {
      return ReactiveHtmlTag.create(() => {
        const newTag = new ReactiveHtmlTag(tag, ...children);
        newTag.create();
        return newTag;
      });
    };
  }
};

makeTags();

function isReactive(tag: AnyHtmlTag): tag is ReactiveHtmlTag {
  return tag.reactive;
}

function isRenderer(
  route: ParsedRoute,
): route is ParsedRoute & { [ROUTER_RENDER_KEY]: RouteFunction } {
  return route[ROUTER_RENDER_KEY] !== undefined;
}

function isSlugFallback(
  route: ParsedRouteFunction | ParsedRoute | RouteWithSlug,
): route is RouteWithSlug {
  return ROUTER_SLUG_FALLBACK in route;
}

class HtmlTag<T extends ElementType = ElementType> {
  public element!: T;
  public reactive: boolean;
  public children: Array<HtmlTag | ReactiveHtmlTag>;
  public parent: HtmlTag | ReactiveHtmlTag | null = null;
  public text?: string;
  public type: Tag;

  public constructor(
    type: Tag,
    ...children: Array<HtmlTag | ReactiveHtmlTag | Function | string>
  ) {
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
            } else {
              this.children.push(r);
            }
          }
        }
      } else if (typeof child === "string") {
        const t = new HtmlTag(type);
        t.text = child;
        this.children.push(t);
      } else {
        this.children.push(child);
      }
    }
  }

  public create() {
    this.element = document.createElement(this.type) as T;

    for (const child of this.children) {
      if (child.text) {
        this.element.appendChild(document.createTextNode(child.text!));
      } else {
        this.element.appendChild(child.element);
      }
      child.parent = this;
    }
  }

  // Does not clear the scopes of the children. If using destroy with potential reactive children,
  // ensure scopes are handled properly
  public destroy() {
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    this.element.remove();
  }

  public handle(handlerType: string, handler: (element: AnyHtmlTag) => void) {
    this.element.addEventListener(handlerType, () => handler(this));
    return this;
  }

  public attr(attribute: string, value: string) {
    this.element.setAttribute(attribute, value);
    return this;
  }

  public class(className: string) {
    if (className === "") {
      return this;
    }
    this.element.classList.add(className);
    return this;
  }
}

class ReactiveHtmlTag<T extends ElementType = ElementType> extends HtmlTag<T> {
  private renderFunc!: () => ReactiveHtmlTag<T>;
  private scopes: string[];

  constructor(type: Tag, ...children: ChildType[]) {
    super(type, ...children);
    this.reactive = true;
    this.scopes = [];
  }

  public static create(render: () => ReactiveHtmlTag) {
    const tag = render();
    tag.renderFunc = render;
    return tag;
  }

  public react() {
    for (const child of this.children) {
      if (child instanceof ReactiveHtmlTag) {
        child.clearChildScopes();
      }
    }

    const newElement = ReactiveHtmlTag.create(this.renderFunc);

    this.children = newElement.children;

    this.element.replaceChildren(
      ...newElement.children.map((child) => {
        if (child instanceof ReactiveHtmlTag) {
          const newChild = ReactiveHtmlTag.create(() => child);
          newChild.parent = this;
          return newChild.element;
        } else if (child.text) {
          return document.createTextNode(child.text!);
        } else {
          return child.element;
        }
      }),
    );
  }

  public scope(scope: string | string[]) {
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

  public clearChildScopes() {
    for (const child of this.children) {
      if (child instanceof ReactiveHtmlTag) {
        child.clearChildScopes();
      }
    }
    for (const scope of this.scopes) {
      scopes[scope].delete(this);
    }
  }

  public $handle(
    handlerType: string,
    handler: (element: ReactiveHtmlTag<T>) => void,
  ) {
    const cb = () => {
      handler(this);
      let lastReactParent: ReactiveHtmlTag = this;
      let next: AnyHtmlTag = this;
      while (next.parent !== null) {
        if (isReactive(next)) {
          lastReactParent = next!;
        }
        next = next.parent;
      }
      lastReactParent.react();
    };

    this.element.addEventListener(handlerType, cb);

    return this;
  }

  public $$handle(
    emitTo: string[],
    handlerType: string,
    handler: (element: ReactiveHtmlTag<T>) => void,
  ) {
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
  public routes: Routes;
  public parsedRoute: ParsedRoute;
  public mounted!: AnyHtmlTag;
  public path!: string;
  public mountedRoute!: string;

  constructor(
    routes: Record<string, (slugs?: Record<string, string>) => AnyHtmlTag>,
  ) {
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

  public route() {
    scopes = {};

    const split = this.path.split("/").filter((path) => path !== "");
    let curr = this.parsedRoute;
    const slugs: RouteSlugs = {};

    if (split.length === 0) {
      this.navigate(
        this.parsedRoute["/"]
          ? this.parsedRoute["/"][ROUTER_RENDER_KEY]
          : () => div("404 Not Found"),
      );
      return;
    }

    for (const path of split) {
      if (!curr[path]) {
        if (isSlugFallback(curr)) {
          slugs[(curr as any)[ROUTER_SLUG_FALLBACK][ROUTER_SLUG_KEY]] = path;
          curr = curr[ROUTER_SLUG_FALLBACK] as ParsedRoute;
        } else {
          this.navigate(
            this.parsedRoute["404"]
              ? this.parsedRoute["404"][ROUTER_RENDER_KEY]
              : () => div("404 Not Found"),
          );
        }
      } else {
        curr = curr[path] as ParsedRoute;
      }
    }

    if (isRenderer(curr)) {
      this.mountedRoute = this.path;
      this.navigate(curr[ROUTER_RENDER_KEY], slugs);
    } else {
      this.navigate(
        this.parsedRoute["404"]
          ? (this.parsedRoute as any)["404"][ROUTER_RENDER_KEY]
          : () => div("404 Not Found"),
      );
    }
  }

  private navigate(route: RouteFunction, slugs?: RouteSlugs) {
    const r = route(slugs);
    this.mounted.destroy();
    this.mounted = r;
    this.mounted.create();

    document.getElementById("main")!.appendChild(this.mounted.element);
  }

  private createNestedRoutes() {
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
          } else {
            curr[key] = {
              [ROUTER_RENDER_KEY]: this.routes[route],
            };
          }
        } else {
          if (isSlug) {
            curr[key] = {
              ...curr[key],
              [ROUTER_SLUG_FALLBACK]: {},
              [ROUTER_SLUG_KEY]: path.slice(1),
            };
          } else {
            curr[key] = { ...curr[key] };
          }
        }
        curr = curr[key] as ParsedRoute;
      });
    }
  }
}

const withRouter = (routes: Routes): AnyHtmlTag => {
  const router = new Router(routes);
  return router.mounted;
};

let count = 0;
let savedTest = "";

const results = withRouter({
  "/": () =>
    div(() => {
      let test = "";
      let shouldRotate = false;
      return [
        div(
          $div(() => [`The Current Count is ${count}`]).scope("count"),
          $button(() => ["Click Me"]).$$handle(["count"], "click", () => {
            count++;
          }),
        ),
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
        div(
          $div(() => [`This is my input ${test}`]).scope("inputchange"),
          $input()
            .attr("value", savedTest)
            .$$handle(["inputchange"], "input", (element) => {
              test = element.element.value;
            }),
          $button(() => ["Save Test"]).handle("click", () => {
            savedTest = test;
          }),
        ),
      ];
    }),
  "/test": () => div("here"),
  "/test/:test123/:test1234": (slugs) =>
    div(
      "test",
      div(`Slug 1 is ${slugs?.test123}`),
      div(`Slug 2 is ${slugs?.test1234}`),
      a("Nav to home").attr("href", "#/"),
      a("Go to something unknown").attr("href", "#/unknown"),
      `${count}`,
    ).class("flex"),
  "404": () =>
    div(
      "This is what it would be like if there was a custom 404 page",
      div(a("Go home").attr("href", "#/")),
    ),
});

document.getElementById("main")!.appendChild(results.element);
