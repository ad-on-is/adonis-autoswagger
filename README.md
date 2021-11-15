# Adonis AutoSwagger

Auto-Generate swagger docs for AdonisJS

## Install

`npm i adonis-autoswagger`

## Usage

In your `routes.ts`

```js
import AutoSwagger from "adonis-autoswagger";
// returns swagger in YAML
Route.get("/swagger", async () => {
  return AutoSwagger.docs(Route.toJSON(), {
    modelPath: __dirname,
    title: "Foo",
    version: "1.0.0",
  });
});

// Renders Swagger-UI and passes YAML-output of /swagger
Route.get("/docs", async () => {
  return AutoSwagger.ui("/swagger");
});
```
