type ChildType =
  | ReactiveHtmlTag
  | HtmlTag
  | string
  | (() => (HtmlTag | string)[]);

type TagFunction = (...children: ChildType[]) => HtmlTag;

type ReactiveTagFunction = (children?: () => ChildType[]) => ReactiveHtmlTag;

type AnyHtmlTag = ReactiveHtmlTag | HtmlTag;

// Declare functions for regular HTML tags
declare const div: TagFunction;
declare const a: TagFunction;
declare const h1: TagFunction;
declare const h2: TagFunction;
declare const h3: TagFunction;
declare const h4: TagFunction;
declare const h5: TagFunction;
declare const p: TagFunction;
declare const button: TagFunction;
declare const img: TagFunction;

// Declare functions for reactive HTML tags
declare const $div: ReactiveTagFunction;
declare const $a: ReactiveTagFunction;
declare const $h1: ReactiveTagFunction;
declare const $h2: ReactiveTagFunction;
declare const $h3: ReactiveTagFunction;
declare const $h4: ReactiveTagFunction;
declare const $h5: ReactiveTagFunction;
declare const $p: ReactiveTagFunction;
declare const $button: ReactiveTagFunction;
declare const $img: ReactiveTagFunction;

// Define a type for event handlers
type Handlers = { [handler: string]: (event: Event) => void };

// Define a type for tag names
type Tag =
  | "a"
  | "div"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "p"
  | "button"
  | "img";
