import { snakeCase } from "lodash";
import { getBetweenBrackets } from "./helpers";
export default class ExampleGenerator {
  public schemas = {};
  constructor(schemas: any) {
    this.schemas = schemas;
  }

  jsonToRef(json) {
    const jsonObjectIsArray = Array.isArray(json);
    let out = {};
    let outArr = [];
    for (let [k, v] of Object.entries(json)) {
      if (typeof v === "object") {
        if (!Array.isArray(v)) {
          v = this.jsonToRef(v);
        }
      }
      if (typeof v === "string") {
        v = this.parseRef(v, true);
      }

      if (jsonObjectIsArray) {
        outArr.push(v);
      } else {
        out[k] = v;
      }
    }
    return outArr.length > 0 ? outArr.flat() : out;
  }

  parseRef(line: string, exampleOnly = false) {
    let rawRef = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));

    if (rawRef === "") {
      if (exampleOnly) {
        return line;
      }
      // No format valid, returning the line as text/plain
      return {
        content: {
          "text/plain": {
            example: line,
          },
        },
      };
    }

    let inc = getBetweenBrackets(line, "with");
    let exc = getBetweenBrackets(line, "exclude");
    const append = getBetweenBrackets(line, "append");
    let only = getBetweenBrackets(line, "only");
    const paginated = getBetweenBrackets(line, "paginated");
    const serializer = getBetweenBrackets(line, "serialized");

    if (serializer) {
      // we override to be sure
      inc = "";
      exc = "";
      only = "";

      if (this.schemas[serializer].fields.pick) {
        only += this.schemas[serializer].fields.pick.join(",");
      }
      if (this.schemas[serializer].fields.omit) {
        exc += this.schemas[serializer].fields.omit.join(",");
      }
      if (this.schemas[serializer].relations) {
        // get relations names and add them to inc
        const relations = Object.keys(this.schemas[serializer].relations);
        inc = relations.join(",");

        // we need to add the relation name to only and also we add the relation fields we want to only
        // ex : comment,comment.id,comment.createdAt
        relations.forEach((relation) => {
          const relationFields = this.schemas[serializer].relations[
            relation
          ].map((field) => relation + "." + field);

          only += "," + relation + "," + relationFields.join(",");
        });
      }
    }

    let app = {};
    try {
      app = JSON.parse("{" + append + "}");
    } catch {}

    const cleanedRef = rawRef.replace("[]", "");

    let ex = {};
    try {
      ex = Object.assign(
        this.getSchemaExampleBasedOnAnnotation(cleanedRef, inc, exc, only),
        app
      );
    } catch (e) {
      console.error("Error", cleanedRef);
    }

    const { dataName, metaName } = this.getPaginatedData(line);

    const paginatedEx = {
      [dataName]: [ex],
      [metaName]: this.getSchemaExampleBasedOnAnnotation("PaginationMeta"),
    };

    const paginatedSchema = {
      type: "object",
      properties: {
        [dataName]: {
          type: "array",
          items: { $ref: "#/components/schemas/" + cleanedRef },
        },
        [metaName]: { $ref: "#/components/schemas/PaginationMeta" },
      },
    };

    const normalArraySchema = {
      type: "array",
      items: { $ref: "#/components/schemas/" + cleanedRef },
    };

    if (rawRef.includes("[]")) {
      if (exampleOnly) {
        return paginated === "true" ? paginatedEx : [ex];
      }
      return {
        content: {
          "application/json": {
            schema: paginated === "true" ? paginatedSchema : normalArraySchema,
            example: paginated === "true" ? paginatedEx : [ex],
          },
        },
      };
    }
    if (exampleOnly) {
      return ex;
    }

    return {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/" + rawRef,
          },
          example: ex,
        },
      },
    };
  }

  exampleByValidatorRule(rule: string) {
    switch (rule) {
      case "email":
        return "user@example.com";
      default:
        return "Some string";
    }
  }

  getSchemaExampleBasedOnAnnotation(
    schema: string,
    inc = "",
    exc = "",
    onl = "",
    first = "",
    parent = "",
    deepRels = [""]
  ) {
    let props = {};
    if (!this.schemas[schema]) {
      return props;
    }
    if (this.schemas[schema].example) {
      return this.schemas[schema].example;
    }

    let properties = this.schemas[schema].properties;
    let include = inc.toString().split(",");
    let exclude = exc.toString().split(",");
    let only = onl.toString().split(",");
    only = only.length === 1 && only[0] === "" ? [] : only;

    if (typeof properties === "undefined") return null;

    // skip nested if not requested
    if (
      parent !== "" &&
      schema !== "" &&
      parent.includes(".") &&
      this.schemas[schema].description.includes("Model") &&
      !inc.includes("relations") &&
      !inc.includes(parent) &&
      !inc.includes(parent + ".relations") &&
      !inc.includes(first + ".relations")
    ) {
      return null;
    }

    deepRels.push(schema);

    for (const [key, value] of Object.entries(properties)) {
      let isArray = false;
      if (exclude.includes(key)) continue;
      if (exclude.includes(parent + "." + key)) continue;

      if (
        key === "password" &&
        !include.includes("password") &&
        !only.includes("password")
      )
        continue;
      if (
        key === "password_confirmation" &&
        !include.includes("password_confirmation") &&
        !only.includes("password_confirmation")
      )
        continue;
      if (
        (key === "created_at" ||
          key === "updated_at" ||
          key === "deleted_at") &&
        exc.includes("timestamps")
      )
        continue;

      let rel = "";
      let example = value["example"];

      if (parent === "" && only.length > 0 && !only.includes(key)) continue;

      // for relations we can select the fields we want with this syntax
      // ex : comment.id,comment.createdAt
      if (
        parent !== "" &&
        only.length > 0 &&
        !only.includes(parent + "." + key)
      )
        continue;

      if (typeof value["$ref"] !== "undefined") {
        rel = value["$ref"].replace("#/components/schemas/", "");
      }

      if (
        typeof value["items"] !== "undefined" &&
        typeof value["items"]["$ref"] !== "undefined"
      ) {
        rel = value["items"]["$ref"].replace("#/components/schemas/", "");
      }

      if (typeof value["items"] !== "undefined") {
        isArray = true;
        example = value["items"]["example"];
      }

      if (rel !== "") {
        // skip related models of main schema
        if (
          parent === "" &&
          typeof this.schemas[rel] !== "undefined" &&
          this.schemas[rel].description?.includes("Model") &&
          !include.includes("relations") &&
          !include.includes(key)
        ) {
          continue;
        }

        if (
          parent !== "" &&
          !include.includes(parent + ".relations") &&
          !include.includes(parent + "." + key)
        ) {
          continue;
        }

        if (
          typeof value["items"] !== "undefined" &&
          typeof value["items"]["$ref"] !== "undefined"
        ) {
          rel = value["items"]["$ref"].replace("#/components/schemas/", "");
        }
        if (rel == "") {
          return;
        }

        let propdata: any = "";

        // if (!deepRels.includes(rel)) {
        // deepRels.push(rel);
        propdata = this.getSchemaExampleBasedOnAnnotation(
          rel,
          inc,
          exc,
          onl,
          parent,
          parent === "" ? key : parent + "." + key,
          deepRels
        );

        if (propdata === null) {
          continue;
        }

        props[key] = isArray ? [propdata] : propdata;
      } else {
        props[key] = isArray ? [example] : example;
      }
    }

    return props;
  }

  exampleByType(type) {
    switch (type) {
      case "string":
        return this.exampleByField("title");
      case "number":
        return Math.floor(Math.random() * 1000);
      case "integer":
        return Math.floor(Math.random() * 1000);
      case "boolean":
        return true;
      case "DateTime":
        return this.exampleByField("datetime");
      case "datetime":
        return this.exampleByField("datetime");
      case "date":
        return this.exampleByField("date");
      case "object":
        return {};
      case "uuid":
        return this.exampleByField("uuid");
      default:
        return null;
    }
  }

  exampleByField(field, type: string = "") {
    const ex = {
      datetime: "2021-03-23T16:13:08.489+01:00",
      DateTime: "2021-03-23T16:13:08.489+01:00",
      date: "2021-03-23",
      title: "Lorem Ipsum",
      year: 2023,
      description: "Lorem ipsum dolor sit amet",
      name: "John Doe",
      full_name: "John Doe",
      first_name: "John",
      last_name: "Doe",
      email: "johndoe@example.com",
      address: "1028 Farland Street",
      street: "1028 Farland Street",
      country: "United States of America",
      country_code: "US",
      zip: 60617,
      city: "Chicago",
      password: "S3cur3P4s5word!",
      password_confirmation: "S3cur3P4s5word!",
      lat: 41.705,
      long: -87.475,
      price: 10.5,
      avatar: "https://example.com/avatar.png",
      url: "https://example.com",
      uuid: "2b0bf725-d404-481f-b431-17f1182a5e57"
    };
    if (typeof ex[field] !== "undefined") {
      return ex[field];
    }
    if (typeof ex[snakeCase(field)] !== "undefined") {
      return ex[snakeCase(field)];
    }
    return null;
  }

  getPaginatedData(line: string): { dataName: string; metaName: string } {
    const match = line.match(/<.*>\.paginated\((.*)\)/);
    if (!match) {
      return { dataName: "data", metaName: "meta" };
    }

    const params = match[1].split(",").map((s) => s.trim());
    const dataName = params[0] || "data";
    const metaName = params[1] || "meta";

    return { dataName, metaName };
  }
}

export abstract class ExampleInterfaces {
  public static paginationInterface() {
    return {
      PaginationMeta: {
        type: "object",
        properties: {
          total: { type: "number", example: 100, nullable: false },
          page: { type: "number", example: 2, nullable: false },
          perPage: { type: "number", example: 10, nullable: false },
          currentPage: { type: "number", example: 3, nullable: false },
          lastPage: { type: "number", example: 10, nullable: false },
          firstPage: { type: "number", example: 1, nullable: false },
          lastPageUrl: {
            type: "string",
            example: "/?page=10",
            nullable: false,
          },
          firstPageUrl: {
            type: "string",
            example: "/?page=1",
            nullable: false,
          },
          nextPageUrl: { type: "string", example: "/?page=6", nullable: false },
          previousPageUrl: {
            type: "string",
            example: "/?page=5",
            nullable: false,
          },
        },
      },
    };
  }
}
