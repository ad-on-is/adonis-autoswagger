# Adonis AutoSwagger

Auto-Generate swagger docs for AdonisJS

## Install

`npm i adonis-autoswagger`

## Usage

In your `routes.ts`

```js
const swagger = require("adonis-autoswagger");
// returns swagger in YAML
Route.get("/swagger", async () => {
  return swagger.docs(Route.toJSON(), {
    modelPath: __dirname.replace("/start", "") + "/app/Models",
    title: "Foo",
    version: "1.0.0",
  });
});

// Renders Swagger-UI and passes YAML-output of /swagger
Route.get("/docs", async () => {
  return swagger.ui("/swagger");
});
```
