declare function div(
  ...children: (HtmlTag | string | (() => (HtmlTag | string)[]))[]
): HtmlTag;
declare function a(
  ...children: (HtmlTag | string | (() => (HtmlTag | string)[]))[]
): HtmlTag;
declare function h1(
  ...children: (HtmlTag | string | (() => (HtmlTag | string)[]))[]
): HtmlTag;
declare function p(
  ...children: (HtmlTag | string | (() => (HtmlTag | string)[]))[]
): HtmlTag;
declare function button(
  ...children: (HtmlTag | string | (() => (HtmlTag | string)[]))[]
): HtmlTag;
declare function $div(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $a(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $h1(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $p(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $button(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;

type Tag = "a" | "div" | "h1" | "p" | "button" | "h2" | "simpleText";
type Handlers = { [handler: string]: (event: Event) => void };

const tags: Tag[] = ["a", "div", "h1", "p", "button", "h2"];

let scopes: Record<string, Set<ReactiveHtmlTag>> = {};
(window as any).scopes = scopes;

for (const tag of tags) {
  (window as any)[tag] = (
    ...children: (HtmlTag | string | (() => HtmlTag | string))[]
  ) => {
    const newTag = new HtmlTag(
      tag,
      ...children.map((child) => {
        if (typeof child === "string") {
          const t = new HtmlTag(tag, [] as any);
          t.text = child;
          return t;
        }
        return child;
      }),
    );
    newTag.create();
    return newTag;
  };

  (window as any)[`$${tag}`] = (...children: (HtmlTag | string)[]) => {
    return ReactiveHtmlTag.create(() => {
      const newTag = new ReactiveHtmlTag(tag, ...children);
      newTag.create();
      return newTag;
    });
  };
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

  public destroy() {
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
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
    this.element.classList.add(className);
    return this;
  }
}

class ReactiveHtmlTag extends HtmlTag {
  private tagMethod!: () => ReactiveHtmlTag;
  private scopes: string[];

  constructor(type: Tag, ...children: Array<HtmlTag | string>) {
    super(type, ...children);
    this.reactive = true;
    this.scopes = [];
  }

  public static create(tagMethod: () => ReactiveHtmlTag) {
    const tag = tagMethod();
    tag.tagMethod = tagMethod;
    return tag;
  }

  public react() {
    for (const child of this.children) {
      if (child instanceof ReactiveHtmlTag) {
        child.clearChildScopes();
      }
    }

    const newElement = ReactiveHtmlTag.create(this.tagMethod);

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
      let lastReactParent: HtmlTag | ReactiveHtmlTag = this;
      let next: HtmlTag | ReactiveHtmlTag = this;
      while (next.parent !== null) {
        if (next.reactive) {
          lastReactParent = next!;
        }
        next = next.parent;
      }
      if (lastReactParent !== this) {
        (lastReactParent as ReactiveHtmlTag).react();
      } else {
        console.error("No parent to react");
      }
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
  public mounted: HtmlTag | ReactiveHtmlTag;

  constructor(routes: Record<string, () => HtmlTag | ReactiveHtmlTag>) {
    this.routes = routes;
    this.mounted = routes["/"]
      ? routes["/"]()
      : routes["404"]
        ? routes["404"]()
        : div("404 Not Found");

    const hashChangeEvent = new HashChangeEvent("hashchange", {
      newURL: "/",
      oldURL: "",
    });

    window.dispatchEvent(hashChangeEvent);
    window.addEventListener("hashchange", () => {
      this.route();
    });
  }

  public route() {
    const path = window.location.hash.slice(1);
    scopes = {};

    if (this.routes[path]) {
      this.mounted.destroy();
      this.mounted = this.routes[path]();
      this.mounted.create();
    } else {
      this.mounted.destroy();
      this.mounted = this.routes["404"]
        ? this.routes["404"]()
        : div("404 Not Found");
      this.mounted.create();
    }

    document.getElementById("main")!.appendChild(this.mounted.element);
  }

  public mount(element: HtmlTag | ReactiveHtmlTag) {
    this.mounted = element;
  }
}

const withRouter = (
  routes: Record<string, () => HtmlTag | ReactiveHtmlTag>,
): HtmlTag | ReactiveHtmlTag => {
  const router = new Router(routes);
  return router.mounted;
};

let count = 0;
const results = withRouter({
  "/": () =>
    div(
      div(() => {
        return [
          $div(() => [`The Current Count is ${count}`]).scope("count"),
          $button(() => ["Click Me"]).$$handle(["count"], "click", () => {
            count++;
          }),
        ];
      }),
      div(a("click me to go to test").attr("href", "#/test")).class("red"),
      $div(() => [`Distant Count ${count}`]).scope("count"),
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
      div(a("Go home").attr("href", "/")),
    ),
});

document.getElementById("main")!.appendChild(results.element);
