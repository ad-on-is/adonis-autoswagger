# Adonis AutoSwagger

Auto-Generate swagger docs for AdonisJS

---

## Install

`npm i adonis-autoswagger`

---

## Usage

In your `routes.ts`

```js
import AutoSwagger from "adonis-autoswagger";
// returns swagger in YAML
Route.get("/swagger", async () => {
  return AutoSwagger.docs(Route.toJSON(), {
    path: __dirname,
    title: "Foo",
    version: "1.0.0",
    tagIndex: 2,
    ignore: ["/swagger", "/docs"],
  });
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

## tagIndex

Tags endpoints automatically

- If your routes are `/api/v1/products/...` then your tagIndex should be `3`
- If your routes are `/v1/products/...` then your tagIndex should be `2`
- If your routes are `/products/...` then your tagIndex should be `1`

## ignore[]

Ignores specified paths.

---

## Extend Controllers

Add additional documentation to your Controller-files.

**@description** (only one)
A description of what that action does.

**@response** (multiple)

```js
@response <status> - Lorem ipsum Dolor sit amet

@response <status> // returns standard <status> message

@response <status> - <Model> // returns model specification

@response <status> - <Model[]> // returns model-array specification

@response <status> - <Model>.with(relations, property1, property2.relations, property3.property4) // returns a model and a defined relation

@response <status> - <Model[]>.with(relations).exclude(property1, property2) // returns model specification

@response <status> - {"foo": "bar"} //returns custom json
```

**@requestBody** (only one)
A definition of the expected requestBody

```js
// basicaly same as @response, just without a status
@requestBody <Model> // Expects model specification
@requestBody <Model>.with(relations) // Expects model and its relations
@requestBody {"foo": "bar"} // Expects a specific JSON
```

### **Examples**

```js
/**
* @index
* @description Returns array of producs and it's relations
* @response 200 - <Product[]>.with(relations)
*/
	public async index({ request, response }: HttpContextContract) {}

/**
* @show
* @description Returns a product with it's relation on user and user relations
* @response 200 - <Product>.with(user, user.relations)
* @response 404
*/
	public async show({ request, response }: HttpContextContract) {}

/**
* @update
* @response 200
* @response 404 - Product could not be found
* @requestBody <Product>
*/
	public async update({ request, response }: HttpContextContract) {}


/**
* @custom
* @response 400 - {"foo": "bar"}
*/
	public async custom({ request, response }: HttpContextContract) {}

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

## Models (schemas)

Automatically generates swagger model-descriptions based on your models

![alt](https://i.imgur.com/FEdLplp.png)

## Extend Models

Add additional documentation to your Models properties.

---

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
