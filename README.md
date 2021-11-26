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

## Extend

Add additional documentation to your Controller-files.

**@response** (multiple)

```js
@response <status> - Some text
@response <status> // returns standard <status> message
@response <status> - {Schema} // returns schema specification
@response <status> - {Schema[]} // returns schema-array specification
@response <status> - {Schema}.with(relations, property, property.relations, property.otherproperty) // returns a schema and a defined relation
```

**@description** (only one)

### **Examples**

```js
/**
	 * @index
   * @description Returns array of producs and it's relations
	 * @response 200 - {Product[]}.with(relations)
	 */
	public async index({ request, response }: HttpContextContract) {}

/**
	 * @show
	 * @description Returns a product with it's relation on user and user relations
	 * @response 200 - {Product}.with(user, user.relations)
   * @response 404
	 */
	public async show({ request, response }: HttpContextContract) {}

/**
	 * @update
	 * @response 200
   * @response 404 - Product could not be found
	 */
	public async update({ request, response }: HttpContextContract) {}

```

---

## What does it do?

AutoSwagger tries to extracat as much information as possible to generate swagger-docs for you.

## Paths

Automatically generates swagger path-descriptions, based on your application routes. It also detects endpoints, protected by the auth-middlware.

![paths](https://i.imgur.com/EnPw6xT.png)

## Schemas

Automatically generates swagger schema-descriptions based on your models

![alt](https://i.imgur.com/FEdLplp.png)
