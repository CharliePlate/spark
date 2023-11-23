let scopes: Record<string, Set<ReactiveHtmlTag>> = {};
(window as any).scopes = scopes;

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

class HtmlTag {
  public element!: HTMLElement;
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
              const t = new HtmlTag(type, [] as any);
              t.text = r;
              this.children.push(t);
            } else {
              this.children.push(r);
            }
          }
        }
      } else if (typeof child === "string") {
        const t = new HtmlTag(type, [] as any);
        t.text = child;
        this.children.push(t);
      } else {
        this.children.push(child);
      }
    }
  }

  public create() {
    this.element = document.createElement(this.type);

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

  public handle(handlerType: string, handler: (element: HtmlTag) => void) {
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

class ReactiveHtmlTag extends HtmlTag {
  private renderFunc!: () => ReactiveHtmlTag;
  private scopes: string[];

  constructor(type: Tag, ...children: ChildType[]) {
    super(type, ...children);
    this.reactive = true;
    this.scopes = [];
  }

  public static create(tagMethod: () => ReactiveHtmlTag) {
    const tag = tagMethod();
    tag.renderFunc = tagMethod;
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
    handler: (element: ReactiveHtmlTag) => void,
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
    handler: (element: ReactiveHtmlTag) => void,
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
  public routes: Record<string, () => HtmlTag | ReactiveHtmlTag>;
  public mounted!: HtmlTag | ReactiveHtmlTag;
  public path!: string;
  public mountedRoute!: string;
  private SLUG_FALLBACK: string;

  constructor(
    routes: Record<
      string,
      (slugs?: Record<string, string>) => HtmlTag | ReactiveHtmlTag
    >,
  ) {
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

  public route() {
    scopes = {};

    if (this.routes[this.path]) {
      this.mounted.destroy();
      this.mounted = this.routes[this.path]();
    } else {
      this.mounted.destroy();
      this.mounted = this.routes["404"]
        ? this.routes["404"]()
        : div("404 Not Found");
    }

    document.getElementById("main")!.appendChild(this.mounted.element);
  }

  private createNestedRoutes() {
    for (const route of Object.keys(this.routes)) {
      const split = route.split("/");
      for (const path in split) {
      }
    }
  }
}

const withRouter = (
  routes: Record<string, () => HtmlTag | ReactiveHtmlTag>,
): HtmlTag | ReactiveHtmlTag => {
  const router = new Router(routes);
  return router.mounted;
};

let count = 0;
let shouldRotate = false;

const results = withRouter({
  "/": () =>
    div(
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
    ),
  "/test": () =>
    div(
      "test",
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
