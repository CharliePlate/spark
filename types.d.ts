declare function div(...children: (HtmlTag | string)[]): HtmlTag;
declare function a(...children: (HtmlTag | string)[]): HtmlTag;
declare function h1(...children: (HtmlTag | string)[]): HtmlTag;
declare function p(...children: (HtmlTag | string)[]): HtmlTag;
declare function button(...children: (HtmlTag | string)[]): HtmlTag;
declare function $div(...children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $a(...children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $h1(...children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $p(...children: () => (HtmlTag | string)[]): ReactiveHtmlTag;
declare function $button(
  ...children: () => (HtmlTag | string)[]
): ReactiveHtmlTag;
