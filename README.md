# Adonis AutoSwagger

Auto-Generate swagger docs for AdonisJS

---

## Install

`npm i adonis-autoswagger`

---

## Features

- Creates **paths** automatically based on `routes.ts`
- Creates **schemas** automatically based on `app/Models/*`
- Creates **schemas** automatically based on `app/Interfaces/*`
- **Rich configuration** via comments
- Works also in **production** mode
- `node ace docs:generate` command

---

## Usage

Create a file `/config/swagger.ts`

```js
export default {
  path: __dirname + "../",
  title: "Foo",
  version: "1.0.0",
  tagIndex: 2,
  ignore: ["/swagger", "/docs"],
  preferredPutPatch: "PUT", // if PUT/PATCH are provided for the same rout, prefer PUT
  common: {
    parameters: {}, // OpenAPI conform parameters that are commonly used
    headers: {}, // OpenAPI confomr headers that are commonly used
  },
};
```

In your `routes.ts`

```js
import AutoSwagger from "adonis-autoswagger";
import swagger from "Config/swagger";
// returns swagger in YAML
Route.get("/swagger", async () => {
  return AutoSwagger.docs(Route.toJSON(), swagger);
});

// Renders Swagger-UI and passes YAML-output of /swagger
Route.get("/docs", async () => {
  return AutoSwagger.ui("/swagger");
});
```

### Done!

Visit `<url>/docs` to see AutoSwagger in action.

---

## Configure

### `tagIndex`

Tags endpoints automatically

- If your routes are `/api/v1/products/...` then your tagIndex should be `3`
- If your routes are `/v1/products/...` then your tagIndex should be `2`
- If your routes are `/products/...` then your tagIndex should be `1`

### `ignore`

Ignores specified paths.

### `common`

Sometimes you want to use specific parameters or headers on multiple responses.

_Example:_ Some resources use the same filter parameters or return the same headers.

Here's where you can set these and use them with `@paramUse()` and `@responseHeader() @use()`. See practical example for further details.

---

# Extend Controllers

Add additional documentation to your Controller-files.

**@summary** (only one)
A summary of what the action does

**@description** (only one)
A detailed description of what the action does.

**@responseBody** (multiple)

Format: `<status> - <return> - <description>`

`<return>` can be either a `<Schema>`, `<Schema[]>`or a custom JSON `{}`

**@responseHeader** (multiple)

Format: `<status> - <name> - <description> - <meta>`

**@param`Type`** (multiple)

`Type` can be one of [Parameter Types](https://swagger.io/docs/specification/describing-parameters/) (first letter in uppercase)

**@requestBody** (only one)
A definition of the expected requestBody

Format: `<body>`

`<body>` can be either a `<Schema>`, `<Schema[]>`or a custom JSON `{}`

---

# **Examples**

## `@responseBody` examples

```js
@responseBody <status> - Lorem ipsum Dolor sit amet

@responseBody <status> // returns standard <status> message

@responseBody <status> - <Model> // returns model specification

@responseBody <status> - <Model[]> // returns model-array specification

@responseBody <status> - <Model>.with(relations, property1, property2.relations, property3.subproperty.relations) // returns a model and a defined relation

@responseBody <status> - <Model[]>.with(relations).exclude(property1, property2, property3.subproperty) // returns model specification

@responseBody <status> - <Model[]>.append("some":"valid json") // append additional properties to a Model
@responseBody <status> - <Model>.only(property1, property2) // pick only specific properties
@responseBody <status> - {"foo": "bar"} //returns custom json
```

## `@requestBody` examples

```js
// basicaly same as @response, just without a status
@requestBody <Model> // Expects model specification
@requestBody <Model>.with(relations) // Expects model and its relations
@requestBody <Model[]>.append("some":"valid json") // append additional properties to a Model
@requestBody {"foo": "bar"} // Expects a specific JSON
```

---

# **Practical example**

`config/swagger.ts`

```js
export default {
  path: __dirname + "../",
  title: "YourProject",
  version: "1.0.0",
  tagIndex: 2,
  ignore: ["/swagger", "/docs", "/v1", "/"],
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

```js

export default class SomeController {
/**
* @index
* @description Returns array of producs and it's relations
* @responseBody 200 - <Product[]>.with(relations)
* @paramUse(sortable, filterable)
* @responseHeader 200 - @use(paginated)
* @responseHeader 200 - X-pages - A description of the header - @example(test)
*/
	public async index({ request, response }: HttpContextContract) {}

/**
* @show
* @paramPath id - Describe the param
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
* @custom
* @summary Lorem ipsum dolor sit amet
* @paramPath provider - The login provider to be used - @enum(google, facebook, apple)
* @responseBody 200 - {"token": "xxxxxxx"}
* @requestBody {"code": "xxxxxx"}
*/
	public async custom({ request, response }: HttpContextContract) {}

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

**@example(foo bar)**
Use this field to provide own example values for specific fields

Product.js

```js
@hasMany(() => ProductView)
// @no-swagger
public views: HasMany<typeof ProductView>


@column()
// @enum(pending, active, deleted)
public status: string

@column()
// @example(johndoe@example.com)
public email: string
```

---

## Production environment

To make it work in production environments, additional steps are required

- Create a new command for `docs:generate` [See official documentation](https://docs.adonisjs.com/guides/ace-commandline#creating-a-new-command)

  - This should create a new file in `commands/DocsGenerate.ts`

- Use the provided `DocsGenerate.ts.examle`and put its contents into your newly created `DocsGenerate.ts`

- Execute the following

```bash
node ace docs:generate
node ace build --production
cp swagger.yml build/
```
