import { getBetweenBrackets } from "./helpers";
export default class ExampleGenerator {
  private schemas = {};
  constructor(schemas: any) {
    this.schemas = schemas;
  }

  jsonToRef(json) {
    let out = {};
    for (let [k, v] of Object.entries(json)) {
      if (typeof v === "object") {
        if (!Array.isArray(v)) {
          v = this.jsonToRef(v);
        }
      }
      if (typeof v === "string") {
        let ref = v.substring(v.indexOf("<") + 1, v.lastIndexOf(">"));
        if (ref !== "") {
          const inc = getBetweenBrackets(v, "with");
          const exc = getBetweenBrackets(v, "exclude");
          const append = getBetweenBrackets(v, "append");
          const only = getBetweenBrackets(v, "only");

          let app = {};
          try {
            app = JSON.parse("{" + append + "}");
          } catch {}

          // references a schema array
          if (ref.includes("[]")) {
            ref = ref.replace("[]", "");
            v = [
              Object.assign(
                this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only),
                app
              ),
            ].reduce((a) => a);
          } else {
            v = Object.assign(
              this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only),
              app
            );
          }
        }
      }
      out[k] = v;
    }
    return out;
  }

  getSchemaExampleBasedOnAnnotation(
    schema: string,
    inc = "",
    exc = "",
    onl = "",
    first = "",
    parent = "",
    level = 0
  ) {
    let props = {};
    if (!this.schemas[schema]) {
      return props;
    }
    let properties = this.schemas[schema].properties;
    let include = inc.toString().split(",");
    let exclude = exc.toString().split(",");
    let only = onl.toString().split(",");

    only = only.length === 1 && only[0] === "" ? [] : only;

    if (typeof properties === "undefined") return;

    // skip nested if not requested
    if (
      parent !== "" &&
      schema !== "" &&
      parent.includes(".") &&
      this.schemas[schema].description === "Model" &&
      !inc.includes(parent) &&
      !inc.includes(parent + ".relations") &&
      !inc.includes(first + ".relations")
    ) {
      return null;
    }
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
          rel !== "" &&
          typeof this.schemas[rel] !== "undefined" &&
          this.schemas[rel].description === "Model" &&
          !include.includes("relations") &&
          !include.includes(key)
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
        if (level <= 10) {
          propdata = this.getSchemaExampleBasedOnAnnotation(
            rel,
            inc,
            exc,
            onl,
            parent,
            parent === "" ? key : parent + "." + key,
            level++
          );
        }

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

  exampleByField(field) {
    const ex = {
      title: "Lorem Ipsum",
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
    };
    if (typeof ex[field] === "undefined") {
      return null;
    }
    return ex[field];
  }
}
