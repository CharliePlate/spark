declare function div(...children: (HtmlTag | string)[]): HtmlTag;
declare function a(...children: (HtmlTag | string)[]): HtmlTag;
declare function h1(...children: (HtmlTag | string)[]): HtmlTag;
declare function p(...children: (HtmlTag | string)[]): HtmlTag;
declare function button(...children: (HtmlTag | string)[]): HtmlTag;
declare function $div(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $a(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $h1(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $p(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $button(children: () => (HtmlTag | string)[]): ReactiveHtmlTag;

type Tag = "a" | "div" | "h1" | "p" | "button";
type Handlers = { [handler: string]: (event: Event) => void };

const tags: Tag[] = ["a", "div", "h1", "p", "button"];

for (const tag of tags) {
  (window as any)[tag] = (...children: (HtmlTag | string)[]) => {
    const newTag = new HtmlTag(tag, ...children);
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
  public children: Array<HtmlTag | ReactiveHtmlTag | string>;
  public parent: HtmlTag | ReactiveHtmlTag | null = null;
  private type: Tag;

  public constructor(
    type: Tag,
    ...children: Array<HtmlTag | ReactiveHtmlTag | Function | string>
  ) {
    this.type = type;
    this.children = [];
    this.reactive = false;
    for (const child of children) {
      if (typeof child === "function") {
        this.children.push(...child());
      } else {
        this.children.push(child);
      }
    }
  }

  public create() {
    this.element = document.createElement(this.type);

    for (const child of this.children) {
      if (typeof child === "string") {
        this.element.appendChild(document.createTextNode(child));
      } else {
        this.element.appendChild(child.element);
        child.parent = this;
      }
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

  constructor(type: Tag, ...children: Array<HtmlTag | string>) {
    super(type, ...children);
    this.reactive = true;
  }

  public static create(tagMethod: () => ReactiveHtmlTag) {
    const tag = tagMethod();
    tag.tagMethod = tagMethod;
    return tag;
  }

  public react() {
    const newElement = ReactiveHtmlTag.create(this.tagMethod);
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    this.element.replaceChildren(
      ...newElement.children.map((child) => {
        if (child instanceof ReactiveHtmlTag) {
          const newChild = ReactiveHtmlTag.create(() => child);
          newChild.parent = this;
          return newChild.element;
        } else if (typeof child === "string") {
          return document.createTextNode(child);
        } else {
          return child.element;
        }
      }),
    );
  }

  public $handle(
    handlerType: string,
    handler: (element: ReactiveHtmlTag) => void,
    react: boolean = true,
  ) {
    const cb = () => {
      handler(this);
      if (!react) {
        return this;
      }
      let lastReactParent: HtmlTag | ReactiveHtmlTag = this;
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
const result = div(
  $div(() => [
    `Count is ${count}`,
    $button(() => ["Click me!"])
      .$handle("click", () => {
        count++;
      })
      .class(count % 2 == 0 ? "green" : "red"),
    $div(() => [
      $button(() => ["Reset Button"]).$handle("click", () => (count = 0)),
    ]),
  ]).attr("id", "divWithButton"),
  a("This is the Text").attr("href", "#/helloWorld"),
).attr("id", "rootDiv");

parentDiv!.appendChild(result.element);
