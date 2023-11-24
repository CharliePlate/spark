type ChildType =
  | ReactiveHtmlTag
  | HtmlTag
  | string
  | (() => (HtmlTag | string)[]);

type TagFunction<T> = (...children: ChildType[]) => HtmlTag<T>;

type ReactiveTagFunction<T> = (
  children?: (slugs?: RouteSlugs) => ChildType[],
) => ReactiveHtmlTag<T>;

type AnyHtmlTag = ReactiveHtmlTag | HtmlTag;

// Declare functions for regular HTML tags
declare const div: TagFunction<HTMLDivElement>;
declare const a: TagFunction<HTMLAnchorElement>;
declare const h1: TagFunction<HTMLHeadingElement>;
declare const h2: TagFunction<HTMLHeadingElement>;
declare const h3: TagFunction<HTMLHeadingElement>;
declare const h4: TagFunction<HTMLHeadingElement>;
declare const h5: TagFunction<HTMLHeadingElement>;
declare const p: TagFunction<HTMLParagraphElement>;
declare const button: TagFunction<HTMLButtonElement>;
declare const img: TagFunction<HTMLImageElement>;
declare const input: TagFunction<HTMLInputElement>;

// Declare functions for reactive HTML tags
declare const $div: ReactiveTagFunction<HTMLDivElement>;
declare const $a: ReactiveTagFunction<HTMLAnchorElement>;
declare const $h1: ReactiveTagFunction<HTMLHeadingElement>;
declare const $h2: ReactiveTagFunction<HTMLHeadingElement>;
declare const $h3: ReactiveTagFunction<HTMLHeadingElement>;
declare const $h4: ReactiveTagFunction<HTMLHeadingElement>;
declare const $h5: ReactiveTagFunction<HTMLHeadingElement>;
declare const $p: ReactiveTagFunction<HTMLParagraphElement>;
declare const $button: ReactiveTagFunction<HTMLButtonElement>;
declare const $img: ReactiveTagFunction<HTMLImageElement>;
declare const $input: ReactiveTagFunction<HTMLInputElement>;

type ElementType =
  | HTMLDivElement
  | HTMLAnchorElement
  | HTMLHeadingElement
  | HTMLParagraphElement
  | HTMLButtonElement
  | HTMLImageElement
  | HTMLInputElement;

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
  | "img"
  | "input";

type RouteSlugs = Record<string, string>;
type RouteFunction = (slugs?: RouteSlugs) => AnyHtmlTag;

type RouteWithSlug = {
  [ROUTER_SLUG_KEY]: string;
};

type Routes = Record<string, RouteFunction>;

type ParsedRouteFunction = {
  [ROUTER_RENDER_KEY]: RouteFunction;
};

interface ParsedRoute {
  [key: string]: ParsedRouteFunction | ParsedRoute | RouteWithSlug;
  "404"?: ParsedRouteFunction;
  "/"?: ParsedRouteFunction;
}
