<h1 align="center">
Adonis AutoSwagger <br />
<img src="https://upload.wikimedia.org/wikipedia/commons/a/ab/Swagger-logo.png" height="50" />
</h1>

[![Version](https://img.shields.io/github/tag/ad-on-is/adonis-autoswagger.svg?style=flat?branch=main)]()
[![GitHub stars](https://img.shields.io/github/stars/ad-on-is/adonis-autoswagger.svg?style=social&label=Star)]()
[![GitHub watchers](https://img.shields.io/github/watchers/ad-on-is/adonis-autoswagger.svg?style=social&label=Watch)]()
[![GitHub forks](https://img.shields.io/github/forks/ad-on-is/adonis-autoswagger.svg?style=social&label=Fork)]()

### Auto-Generate swagger docs for AdonisJS

## 💻️ Install

```bash
pnpm i adonis-autoswagger #using pnpm
```

---

## ⭐️ Features

- Creates **paths** automatically based on `routes.ts`
- Creates **schemas** automatically based on `app/Models/*`
- Creates **schemas** automatically based on `app/Interfaces/*`
- Creates **schemas** automatically based on `app/Validators/*` (only for adonisJS v6)
- **Rich configuration** via comments
- Works also in **production** mode
- `node ace docs:generate` command

---

## ✌️Usage

Create a file `/config/swagger.ts`

```ts
// for AdonisJS v6
import path from "node:path";
import url from "node:url";
// ---

export default {
  // path: __dirname + "/../", for AdonisJS v5
  path: path.dirname(url.fileURLToPath(import.meta.url)) + "/../", // for AdonisJS v6
  title: "Foo", // use info instead
  version: "1.0.0", // use info instead
  description: "", // use info instead
  tagIndex: 2,
  info: {
    title: "title",
    version: "1.0.0",
    description: "",
  },
  snakeCase: true,

  debug: false, // set to true, to get some useful debug output
  ignore: ["/swagger", "/docs"],
  preferredPutPatch: "PUT", // if PUT/PATCH are provided for the same route, prefer PUT
  common: {
    parameters: {}, // OpenAPI conform parameters that are commonly used
    headers: {}, // OpenAPI conform headers that are commonly used
  },
  securitySchemes: {}, // optional
  authMiddlewares: ["auth", "auth:api"], // optional
  defaultSecurityScheme: "BearerAuth", // optional
  persistAuthorization: true, // persist authorization between reloads on the swagger page
  showFullPath: false, // the path displayed after endpoint summary
};
```

In your `routes.ts`

## 6️⃣ for AdonisJS v6

```js
import AutoSwagger from "adonis-autoswagger";
import swagger from "#config/swagger";
// returns swagger in YAML
router.get("/swagger", async () => {
  return AutoSwagger.default.docs(router.toJSON(), swagger);
});

// Renders Swagger-UI and passes YAML-output of /swagger
router.get("/docs", async () => {
  return AutoSwagger.default.ui("/swagger", swagger);
  // return AutoSwagger.default.scalar("/swagger"); to use Scalar instead
  // return AutoSwagger.default.rapidoc("/swagger", "view"); to use RapiDoc instead (pass "view" default, or "read" to change the render-style)
});
```

## 5️⃣ for AdonisJS v5

```js
import AutoSwagger from "adonis-autoswagger";
import swagger from "Config/swagger";
// returns swagger in YAML
Route.get("/swagger", async () => {
  return AutoSwagger.docs(Route.toJSON(), swagger);
});

// Renders Swagger-UI and passes YAML-output of /swagger
Route.get("/docs", async () => {
  return AutoSwagger.ui("/swagger", swagger);
});
```

### 👍️ Done!

Visit `http://localhost:3333/docs` to see AutoSwagger in action.

### Functions

- `async docs(routes, conf)`: get the specification in YAML format
- `async json(routes, conf)`: get the specification in JSON format
- `ui(path, conf)`: get default swagger UI
- `rapidoc(path, style)`: get rapidoc UI
- `scalar(path)`: get scalar UI
- `jsonToYaml(json)`: can be used to convert `json()` back to yaml

---

## 💡 Compatibility

For controllers to get detected properly, please load them lazily.

```ts
✅ const TestController = () => import('#controllers/test_controller')
❌ import TestController from '#controllers/test_controller'
```

## 🧑‍💻 Advanced usage

### Additional configuration

**info**
See [Swagger API General Info](https://swagger.io/docs/specification/api-general-info/) for details.

**securitySchemes**

Add/Overwrite security schemes [Swagger Authentication](https://swagger.io/docs/specification/authentication/) for details.

```ts
// example to override ApiKeyAuth
securitySchemes: {
  ApiKeyAuth: {
    type: "apiKey"
    in: "header",
    name: "X-API-Key"
  }
}
```

**defaultSecurityScheme**

Override the default security scheme.

- BearerAuth
- BasicAuth
- ApiKeyAuth
- your own defined under `securitySchemes`

**authMiddlewares**

If a route uses a middleware named `auth`, `auth:api`, AutoSwagger will detect it as a Swagger security method. However, you can implement other middlewares that handle authentication.

### Modify generated output

```ts
Route.get("/myswagger", async () => {
  const json = await AutoSwagger.json(Route.toJSON(), swagger);
  // modify json to your hearts content
  return AutoSwagger.jsonToYaml(json);
});

Route.get("/docs", async () => {
  return AutoSwagger.ui("/myswagger", swagger);
});
```

### Custom Paths in adonisJS v6

AutoSwagger supports the paths set in `package.json`. Interfaces are expected to be in `app/interfaces`. However, you can override this, by modifying package.json as follows.

```json
//...
"imports": {
  // ...
  "#interfaces/*": "./app/custom/path/interfaces/*.js"
  // ...
}
//...

```

---

## 📃 Configure

### `tagIndex`

Tags endpoints automatically

- If your routes are `/api/v1/products/...` then your tagIndex should be `3`
- If your routes are `/v1/products/...` then your tagIndex should be `2`
- If your routes are `/products/...` then your tagIndex should be `1`

### `ignore`

Ignores specified paths. When used with a wildcard (\*), AutoSwagger will ignore everything matching before/after the wildcard.
`/test/_`will ignore everything starting with`/test/`, whereas `\*/test`will ignore everything ending with`/test`.

### `common`

Sometimes you want to use specific parameters or headers on multiple responses.

_Example:_ Some resources use the same filter parameters or return the same headers.

Here's where you can set these and use them with `@paramUse()` and `@responseHeader() @use()`. See practical example for further details.

---

# 💫 Extend Controllers

## Add additional documentation to your Controller-files.

**@summary** (only one)
A summary of what the action does

**@tag** (only one)
Set a custom tag for this action

**@description** (only one)
A detailed description of what the action does.

**@operationId** (only one)
An optional unique string used to identify an operation. If provided, these IDs must be unique among all operations described in your API..

**@responseBody** (multiple)

Format: `<status> - <return> - <description>`

`<return>` can be either a `<Schema>`, `<Schema[]>/` or a custom JSON `{}`

**@responseHeader** (multiple)

Format: `<status> - <name> - <description> - <meta>`

**@param`Type`** (multiple)

`Type` can be one of [Parameter Types](https://swagger.io/docs/specification/describing-parameters/) (first letter in uppercase)

**@requestBody** (only one)
A definition of the expected requestBody

Format: `<body>`

`<body>` can be either a `<Schema>`, `<Schema[]>/`, or a custom JSON `{}`

**@requestFormDataBody** (only one)
A definition of the expected requestBody that will be sent with formData format.

**Schema**
A model or a validator.
Format: `<Schema>`

**Custom format**

Format: `{"fieldname": {"type":"string", "format": "email"}}`
This format should be a valid openapi 3.x json.

---

# 🤘Examples

## `@responseBody` examples

```ts
@responseBody <status> - Lorem ipsum Dolor sit amet

@responseBody <status> // returns standard <status> message

@responseBody <status> - <Model> // returns model specification

@responseBody <status> - <Model[]> // returns model-array specification

@responseBody <status> - <Model>.with(relations, property1, property2.relations, property3.subproperty.relations) // returns a model and a defined relation

@responseBody <status> - <Model[]>.with(relations).exclude(property1, property2, property3.subproperty) // returns model specification

@responseBody <status> - <Model[]>.append("some":"valid json") // append additional properties to a Model

@responseBody <status> - <Model[]>.paginated() // helper function to return adonisJS conform structure like {"data": [], "meta": {}}

@responseBody <status> - <Model[]>.paginated(dataName, metaName) // returns a paginated model with custom keys for the data array and meta object, use `.paginated(dataName)` or `.paginated(,metaName)` if you want to override only one. Don't forget the ',' for the second parameter.

@responseBody <status> - <Model>.only(property1, property2) // pick only specific properties

@requestBody <status> <myCustomValidator> // returns a validator object

@responseBody <status> - {"foo": "bar", "baz": "<Model>"} //returns custom json object and also parses the model
@responseBody <status> - ["foo", "bar"] //returns custom json array
```

## `@paramPath` and `@paramQuery` examples

```ts
// basicaly same as @response, just without a status
@paramPath <paramName> - Description - (meta)
@paramQuery <paramName> - Description - (meta)

@paramPath id - The ID of the source - @type(number) @required
@paramPath slug - The ID of the source - @type(string)

@paramQuery q - Search term - @type(string) @required
@paramQuery page - the Page number - @type(number)

```

## `@requestBody` examples

```ts
// basicaly same as @response, just without a status
@requestBody <Model> // Expects model specification
@requestBody <myCustomValidator> // Expects validator specification
@requestBody <Model>.with(relations) // Expects model and its relations
@requestBody <Model[]>.append("some":"valid json") // append additional properties to a Model
@requestBody {"foo": "bar"} // Expects a specific JSON
```

## `@requestFormDataBody` examples

```ts
// Providing a raw JSON
@requestFormDataBody {"name":{"type":"string"},"picture":{"type":"string","format":"binary"}} // Expects a valid OpenAPI 3.x JSON
```

```ts
// Providing a Model, and adding additional fields
@requestFormDataBody <Model> // Expects a valid OpenAPI 3.x JSON
@requestFormDataBody <Model>.exclude(property1).append("picture":{"type":"string","format":"binary"}) // Expects a valid OpenAPI 3.x JSON
```

---

# **Practical example**

`config/swagger.ts`

```ts
export default {
  path: __dirname + "../",
  title: "YourProject",
  version: "1.0.0",
  tagIndex: 2,
  ignore: ["/swagger", "/docs", "/v1", "/", "/something/*", "*/something"],
  common: {
    parameters: {
      sortable: [
        {
          in: "query",
          name: "sortBy",
          schema: { type: "string", example: "foo" },
        },
        {
          in: "query",
          name: "sortType",
          schema: { type: "string", example: "ASC" },
        },
      ],
    },
    headers: {
      paginated: {
        "X-Total-Pages": {
          description: "Total amount of pages",
          schema: { type: "integer", example: 5 },
        },
        "X-Total": {
          description: "Total amount of results",
          schema: { type: "integer", example: 100 },
        },
        "X-Per-Page": {
          description: "Results per page",
          schema: { type: "integer", example: 20 },
        },
      },
    },
  },
};
```

`app/Controllers/Http/SomeController.ts`

```ts
export default class SomeController {
  /**
   * @index
   * @operationId getProducts
   * @description Returns array of producs and it's relations
   * @responseBody 200 - <Product[]>.with(relations)
   * @paramUse(sortable, filterable)
   * @responseHeader 200 - @use(paginated)
   * @responseHeader 200 - X-pages - A description of the header - @example(test)
   */
  public async index({ request, response }: HttpContextContract) {}

  /**
   * @show
   * @paramPath id - Describe the path param - @type(string) @required
   * @paramQuery foo - Describe the query param - @type(string) @required
   * @description Returns a product with it's relation on user and user relations
   * @responseBody 200 - <Product>.with(user, user.relations)
   * @responseBody 404
   */
  public async show({ request, response }: HttpContextContract) {}

  /**
   * @update
   * @responseBody 200
   * @responseBody 404 - Product could not be found
   * @requestBody <Product>
   */
  public async update({ request, response }: HttpContextContract) {}

  /**
   * @myCustomFunction
   * @summary Lorem ipsum dolor sit amet
   * @paramPath provider - The login provider to be used - @enum(google, facebook, apple)
   * @responseBody 200 - {"token": "xxxxxxx"}
   * @requestBody {"code": "xxxxxx"}
   */
  public async myCustomFunction({ request, response }: HttpContextContract) {}
}
```

---

## What does it do?

AutoSwagger tries to extracat as much information as possible to generate swagger-docs for you.

## Paths

Automatically generates swagger path-descriptions, based on your application routes. It also detects endpoints, protected by the auth-middlware.

![paths](https://i.imgur.com/EnPw6xT.png)

### Responses and RequestBody

Generates responses and requestBody based on your simple Controller-Annotation (see Examples)

---

## Schemas

### Models

Automatically generates swagger schema-descriptions based on your models

![alt](https://i.imgur.com/FEdLplp.png)

### Interfaces

Instead of using `param: any` you can now use custom interfaces `param: UserDetails`. The interfaces files need to be located at `app/Interfaces/`

## Extend Models

Add additional documentation to your Models properties.

### SoftDelete

Either use `compose(BaseModel, SoftDeletes)` or add a line `@swagger-softdeletes` to your Model.

## Attention!

The below comments MUST be placed **1 line** above the property.

---

**@no-swagger**
Although, autoswagger detects `serializeAs: null` fields automatically, and does not show them. You can use @no-swagger for other fields.

**@enum(foo, bar)**
If a field has defined values, you can add them into an enum. This is usesfull for something like a status field.

**@format(string)**
Specify a format for that field, i.e. uuid, email, binary, etc...

**@example(foo bar)**
Use this field to provide own example values for specific fields

**@props({"minLength": 10, "foo": "bar"})**
Use this field to provide additional properties to a field, like minLength, maxLength, etc. Needs to bee valid JSON.

**@required**
Specify that the field is required

```ts
// SomeModel.js
@hasMany(() => ProductView)
// @no-swagger
public views: HasMany<typeof ProductView>


@column()
// @enum(pending, active, deleted)
public status: string

@column()
// @example(johndoe@example.com)
public email: string

@column()
// @props({"minLength": 10})
public age: number

```

---

## Production environment

> [!WARNING]
> Make sure **NODE_ENV=production** in your production environment

To make it work in production environments, additional steps are required

- Create a new command for `docs:generate` [See official documentation](https://docs.adonisjs.com/guides/ace/creating-commands)

  - This should create a new file in `commands/DocsGenerate.ts`

- Use the provided [`DocsGenerate.ts.examle`](https://github.com/ad-on-is/adonis-autoswagger/blob/main/DocsGenerate.ts.example)/[`DocsGeneratev6.ts.example`](https://github.com/ad-on-is/adonis-autoswagger/blob/main/DocsGeneratev6.ts.example) and put its contents into your newly created `DocsGenerate.ts`

- Execute the following

```bash
node ace docs:generate
node ace build --production
cp swagger.yml build/
```
