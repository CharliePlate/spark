## Spark

### A Zero Dependency Reactive Web Framework

#### Getting Started

```term
git clone <git url>
```

index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <title></title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="index.css" rel="stylesheet" />
  </head>
  <body>
    <div id="main"></div>
    <script src="./index.js" type="module"></script>
    <script src="./path/to/your/script"</script>
  </body>
</html>
```

#### How it Works?

Spark creates a global function for each HTML element with 2 variants, `Reactive` and `Non-Reactive`. With these component

#### Reactivity

Spark Reactive Components provide two mechanisms for reactivity, each with their own benefits and draw-backs.

##### Scope

When registering reactive element, developers can utilize the `scope` method to assign a list of events that the element should react to. A scope is a `string` or `string[]` that once emitted will trigger a rerender of the parent component and all of its children.

Reactive element also contain a `$$handle` method with the following signature

```typescript
$$handle(toEmit: string[], handleType: string, handler (element: ReactiveHtmlTag) => void)
```

When a handler gets called, it will emit an notification to all elements that contain that contain the emitted scope to rerender.
