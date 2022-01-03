const YAML = require("json-to-pretty-yaml");
const fs = require("fs");
const path = require('path')
const util = require("util");
const extract = require("extract-comments");
const HTTPStatusCode = require("http-status-code");
const _ = require("lodash/core");
import { camelCase, snakeCase } from "change-case";

interface options {
  title: string;
  ignore: string[];
  version: string;
  path: string;
  tagIndex: number;
  common: common;
}

interface common {
  headers: any;
  parameters: any;
}

export class AutoSwagger {
  private parsedFiles: string[] = [];
  private options: options;
  private schemas = {};

  ui(url: string) {
    return (
      `<!DOCTYPE html>
		<html lang="en">
		<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="X-UA-Compatible" content="ie=edge">
				<script src="//unpkg.com/swagger-ui-dist@3/swagger-ui-standalone-preset.js"></script>
				<!-- <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-standalone-preset.js"></script> -->
				<script src="//unpkg.com/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
				<!-- <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-bundle.js"></script> -->
				<link rel="stylesheet" href="//unpkg.com/swagger-ui-dist@3/swagger-ui.css" />
				<!-- <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui.css" /> -->
				<title>Swagger</title>
		</head>
		<body>
				<div id="swagger-ui"></div>
				<script>
						window.onload = function() {
							SwaggerUIBundle({
								url: "` +
      url +
      `",
								dom_id: '#swagger-ui',
								presets: [
									SwaggerUIBundle.presets.apis,
									SwaggerUIStandalonePreset
								],
								layout: "BaseLayout"
							})
						}
				</script>
		</body>
		</html>`
    );
  }

  async docs(routes, options: options) {
    routes = routes.root;
    this.options = options;
    this.options.path = path.join(this.options.path + "/../app"); 
    this.schemas = await this.getSchemas();
    // return routes
    const docs = {
      openapi: "3.0.0",
      info: {
        title: options.title,
        version: options.version,
      },

      components: {
        responses: {
          Forbidden: {
            description: "Acces token is missing or invalid",
          },
          Accepted: {
            description: "The request was accepted",
          },
          Created: {
            description: "The resource has been created",
          },
          NotFound: {
            description: "The resource has been created",
          },
          NotAcceptable: {
            description: "The resource has been created",
          },
        },
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
        schemas: this.schemas,
      },
      paths: {},
    };
    let paths = {};
    for await (const route of routes) {
      if (options.ignore.includes(route.pattern)) continue;

      let security = [];
      const responseCodes = {
        GET: "200",
        POST: "201",
        DELETE: "202",
        PUT: "204",
      };
      if (
        route.middleware.length > 0 &&
        route.middleware["auth:api"] !== null
      ) {
        security = [{ BearerAuth: ["access"] }];
      }

      let sourceFile = "";
      let action = "";
      let customAnnotations;
      if (route.meta.resolvedHandler !== null) {
        if (typeof route.meta.resolvedHandler.namespace !== "undefined") {
          sourceFile = route.meta.resolvedHandler.namespace;

          action = route.meta.resolvedHandler.method;
          if (sourceFile !== "" && action !== "") {
            customAnnotations = await this.getCustomAnnotations(
              sourceFile,
              action
            );
          }
        }
      }

      let { tags, parameters, pattern } = this.extractInfos(route.pattern);
      route.methods.forEach((method) => {
        let responses = {};
        if (method === "HEAD") return;
        if (
          route.methods["PUT"] !== null &&
          route.methods["PATCH"] !== null &&
          method === "PATCH"
        )
          return;
        let description = "";
        let summary = "";

        if (security.length > 0) {
          responses["401"] = {
            description: HTTPStatusCode.getMessage(401),
          };
        }

        let requestBody = {
          content: {
            "application/json": {},
          },
        };

        let actionParams = {};

        if (action !== "" && typeof customAnnotations[action] !== "undefined") {
          description = customAnnotations[action].description;
          summary = customAnnotations[action].summary;
          responses = { ...responses, ...customAnnotations[action].responses };
          requestBody = customAnnotations[action].requestBody;
          actionParams = customAnnotations[action].parameters;
        }
        parameters = this.mergeParams(parameters, actionParams);

        if (_.isEmpty(responses)) {
          responses[responseCodes[method]] = {
            description: HTTPStatusCode.getMessage(responseCodes[method]),
            content: {
              "application/json": {},
            },
          };
        } else {
          if (
            typeof responses[responseCodes[method]] !== "undefined" &&
            typeof responses[responseCodes[method]]["summary"] !== "undefined"
          ) {
            if (summary === "") {
              summary = responses[responseCodes[method]]["summary"];
            }
            delete responses[responseCodes[method]]["summary"];
          }
          if (
            typeof responses[responseCodes[method]] !== "undefined" &&
            typeof responses[responseCodes[method]]["description"] !==
              "undefined"
          ) {
            description = responses[responseCodes[method]]["description"];
          }
        }

        if (action !== "" && summary === "") {
          switch (action) {
            case "index":
              summary = "Get a list of " + tags[0].toLowerCase();
              break;
            case "show":
              summary = "Get a single instance of " + tags[0].toLowerCase();
              break;
            case "update":
              summary = "Update " + tags[0].toLowerCase();
              break;
            case "destroy":
              summary = "Delete " + tags[0].toLowerCase();
              break;
          }
        }

        let m = {
          summary:
            sourceFile === "" && action == ""
              ? summary + " (route.ts)"
              : summary +
                " (" +
                sourceFile.replace("App/Controllers/Http/", "") +
                "::" +
                action +
                ")",
          description: description,
          parameters: parameters,
          tags: tags,
          responses: responses,
          security: security,
        };

        if (method !== "GET" && method !== "DELETE") {
          m["requestBody"] = requestBody;
        }

        pattern = pattern.slice(1);

        paths = {
          ...paths,
          [pattern]: { ...paths[pattern], [method.toLowerCase()]: m },
        };
      });

      docs.paths = paths;
    }
    return YAML.stringify(docs);
  }

  private mergeParams(initial, custom) {
    let merge = Object.assign(initial, custom);
    let params = [];
    for (const [key, value] of Object.entries(merge)) {
      params.push(value);
    }

    return params;
  }

  private async getCustomAnnotations(file: string, action: string) {
    let annotations = {};
    if (typeof file === "undefined") return;
    if (typeof this.parsedFiles[file] !== "undefined") return;
    this.parsedFiles.push(file);
    file = file.replace("App/", "app/") + ".ts";
    const readFile = util.promisify(fs.readFile);

    const data = await readFile(file, "utf8");
    const comments = extract(data);
    if (comments.length > 0) {
      comments.forEach((comment) => {
        if (comment.type !== "BlockComment") return;
        if (!comment.value.includes("@" + action)) return;
        let lines = comment.value.split("\n");
        lines = lines.filter((l) => l != "");

        annotations[action] = this.parseAnnotations(lines);
      });
    }
    return annotations;
  }

  private parseAnnotations(lines: string[]) {
    let summary = "";
    let description = "";
    let responses = {};
    let requestBody = {};
    let parameters = {};
    let headers = {};
    lines.forEach((line) => {
      if (line.startsWith("@summary")) {
        summary = line.replace("@summary ", "");
      }
      if (line.startsWith("@description")) {
        description = line.replace("@description ", "");
      }
      if (line.startsWith("@responseBody")) {
        responses = { ...responses, ...this.parseResponse(line) };
      }
      if (line.startsWith("@responseHeader")) {
        const header = this.parseResponseHeader(line);
        headers[header["status"]] = {
          ...headers[header["status"]],
          ...header["header"],
        };
      }
      if (line.startsWith("@requestBody")) {
        requestBody = this.parseRequestBody(line);
      }
      if (line.startsWith("@param")) {
        parameters = { ...parameters, ...this.parseParam(line) };
      }
    });

    for (const [key, value] of Object.entries(responses)) {
      if (typeof headers[key] !== undefined) {
        responses[key]["headers"] = headers[key];
      }
    }

    return {
      description: description,
      responses: responses,
      requestBody: requestBody,
      parameters: parameters,
      summary: summary,
    };
  }

  private parseParam(line) {
    let where = "path";
    let required = true;
    let type = "string";
    let example: any = null;
    let enums = [];

    if (line.startsWith("@paramUse")) {
      let use = this.getBetweenBrackets(line, "paramUse");
      const used = use.split(",");
      let h = {};
      used.forEach((u) => {
        if (typeof this.options.common.parameters[u] === "undefined") {
          return;
        }
        const common = this.options.common.parameters[u];
        h = { ...h, ...common };
      });

      return h;
    }

    if (line.startsWith("@paramPath")) {
      required = true;
    }
    if (line.startsWith("@paramQuery")) {
      required = false;
    }

    let m = line.match("@param([a-zA-Z]*)");
    if (m !== null) {
      where = m[1].toLowerCase();
      line = line.replace(m[0] + " ", "");
    }

    let [param, des, meta] = line.split(" - ");
    if (typeof param === "undefined") {
      return;
    }
    if (typeof des === "undefined") {
      des = "";
    }

    if (typeof meta !== "undefined") {
      if (meta.includes("@required")) {
        required = true;
      }
      let en = this.getBetweenBrackets(meta, "enum");
      example = this.getBetweenBrackets(meta, "example");
      const mtype = this.getBetweenBrackets(meta, "type");
      if (mtype !== "") {
        type = mtype;
      }
      if (en !== "") {
        enums = en.split(",");
        example = enums[0];
      }
    }

    type = param === "id" || param.endsWith("_id") ? "integer" : type;

    if (example === "" || example === null) {
      switch (type) {
        case "string":
          example = "string";
          break;
        case "integer":
          example = 1;
          break;
        case "float":
          example = 1.5;
          break;
      }
    }

    let p = {
      in: where,
      name: param,
      description: des,
      schema: {
        example: example,
        type: type,
      },
      required: required,
    };

    if (enums.length > 1) {
      p["schema"]["enum"] = enums;
    }

    return { [param]: p };
  }

  private parseResponseHeader(line) {
    let description = "";
    let example: any = "";
    let type = "string";
    let enums = [];
    line = line.replace("@responseHeader ", "");
    let [status, name, desc, meta] = line.split(" - ");

    if (typeof status === "undefined" || typeof name === "undefined") return;

    if (typeof desc !== "undefined") {
      description = desc;
    }

    if (name.includes("@use")) {
      let use = this.getBetweenBrackets(name, "use");
      const used = use.split(",");
      let h = {};
      used.forEach((u) => {
        if (typeof this.options.common.headers[u] === "undefined") {
          return;
        }
        const common = this.options.common.headers[u];
        h = { ...h, ...common };
      });

      return {
        status: status,
        header: h,
      };
    }

    if (typeof meta !== "undefined") {
      example = this.getBetweenBrackets(meta, "example");
      const mtype = this.getBetweenBrackets(meta, "type");
      if (mtype !== "") {
        type = mtype;
      }
    }

    if (example === "" || example === null) {
      switch (type) {
        case "string":
          example = "string";
          break;
        case "integer":
          example = 1;
          break;
        case "float":
          example = 1.5;
          break;
      }
    }

    let h = {
      schema: { type: type, example: example },
      description: description,
    };

    if (enums.length > 1) {
      h["schema"]["enum"] = enums;
    }
    return {
      status: status,
      header: {
        [name]: h,
      },
    };
  }

  private parseResponse(line) {
    let responses = {};
    line = line.replace("@responseBody ", "");
    let [status, res] = line.split(" - ");
    let sum = "";
    if (typeof status === "undefined") return;
    responses[status] = {};
    if (typeof res === "undefined") {
      res = HTTPStatusCode.getMessage(status);
    } else {
      res = HTTPStatusCode.getMessage(status) + ": " + res;
      let ref = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));
      let json = line.substring(line.indexOf("{") + 1, line.lastIndexOf("}"));
      if (json !== "") {
        try {
          const j = JSON.parse("{" + json + "}");
          responses[status]["content"] = {
            "application/json": {
              schema: {
                type: "object",
              },
              example: j,
            },
          };
        } catch {
          console.error("Invalid JSON for: " + line);
        }
      }
      // references a schema
      if (ref !== "") {
        const inc = this.getBetweenBrackets(res, "with");
        const exc = this.getBetweenBrackets(res, "exclude");

        res = sum = "Returns a **single** instance of type `" + ref + "`";
        // references a schema array
        if (ref.includes("[]")) {
          ref = ref.replace("[]", "");
          res = sum = "Returns a **list** of type `" + ref + "`";
          responses[status]["content"] = {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/" + ref },
              },
              example: [this.getSchemaExampleBasedOnAnnotation(ref, inc, exc)],
            },
          };
        } else {
          responses[status]["content"] = {
            "application/json": {
              schema: { $ref: "#/components/schemas/" + ref },
              example: this.getSchemaExampleBasedOnAnnotation(ref, inc, exc),
            },
          };
        }
        if (inc !== "") {
          res += " **including** _" + inc.replace(/,/g, ", ") + "_";
        } else {
          res += " **without** any _relations_";
        }
        if (exc !== "") {
          res += " and **excludes** _" + exc.replace(/,/g, ", ") + "_";
        }
        res += ". Take a look at the example for further details.";
      }
    }
    responses[status]["description"] = res;
    responses[status]["summary"] = sum;
    return responses;
  }

  private parseRequestBody(line) {
    let requestBody = {};
    line = line.replace("@requestBody ", "");

    let json = line.substring(line.indexOf("{") + 1, line.lastIndexOf("}"));
    if (json !== "") {
      try {
        const j = JSON.parse("{" + json + "}");
        requestBody = {
          content: {
            "application/json": {
              schema: {
                type: "object",
              },
              example: j,
            },
          },
        };
      } catch {
        console.error("Invalid JSON for " + line);
      }
    }

    let ref = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));
    // references a schema
    if (ref !== "") {
      const inc = this.getBetweenBrackets(line, "with");
      const exc = this.getBetweenBrackets(line, "exclude");

      // references a schema array
      if (ref.includes("[]")) {
        ref = ref.replace("[]", "");
        requestBody = {
          content: {
            "application/json": {
              description: "Expects an array of type " + ref,
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/" + ref },
              },
              example: [this.getSchemaExampleBasedOnAnnotation(ref, inc, exc)],
            },
          },
        };
      } else {
        requestBody = {
          content: {
            "application/json": {
              description: "Expects a single instance of type " + ref,
              schema: {
                $ref: "#/components/schemas/" + ref,
              },
              example: this.getSchemaExampleBasedOnAnnotation(ref, inc, exc),
            },
          },
        };
      }
    }
    return requestBody;
  }

  private getBetweenBrackets(value, start) {
    let match = value.match(new RegExp(start + "\\(([^()]*)\\)", "g"));

    if (match !== null) {
      let m = match[0].replace(start + "(", "").replace(")", "");

      if (start !== "example") {
        m = m.replace(/ /g, "");
      }

      return m;
    }
    return "";
  }

  private getSchemaExampleBasedOnAnnotation(
    schema,
    inc = "",
    exc = "",
    parent = ""
  ) {
    let props = {};
    let properties = this.schemas[schema].properties;
    let include = inc.toString().split(",");
    let exclude = exc.toString().split(",");
    if (typeof properties === "undefined") return;
    for (const [key, value] of Object.entries(properties)) {
      if (exclude.includes(key)) continue;
      if (
        typeof value["$ref"] !== "undefined" ||
        (typeof value["items"] !== "undefined" &&
          typeof value["items"]["$ref"] !== "undefined")
      ) {
        // skip relations of main schema
        if (
          parent === "" &&
          !include.includes("relations") &&
          !include.includes(key)
        ) {
          continue;
        }

        // skip relations of nested schema
        if (
          parent !== "" &&
          !include.includes(parent + ".relations") &&
          !include.includes(parent + "." + key)
        ) {
          continue;
        }

        let rel = "";
        let isArray = false;
        if (typeof value["$ref"] !== "undefined") {
          rel = value["$ref"].replace("#/components/schemas/", "");
        }

        if (
          typeof value["items"] !== "undefined" &&
          typeof value["items"]["$ref"] !== "undefined"
        ) {
          rel = value["items"]["$ref"].replace("#/components/schemas/", "");
          isArray = true;
        }
        if (rel == "") {
          return;
        }
        const propdata = this.getSchemaExampleBasedOnAnnotation(
          rel,
          inc,
          exc,
          parent === "" ? key : parent + "." + key
        );
        props[key] = isArray ? [propdata] : propdata;
      } else {
        props[key] = value["example"];
      }
      // if (typeof props[key + "_id"] !== "undefined") {
      //   delete props[key + "_id"];
      // }
    }
    return props;
  }

  /*
    extract path-variables, tags and the uri-pattern
  */
  private extractInfos(p) {
    let parameters = {};
    let pattern = "";
    let tags = [];
    const split = p.split("/");
    if (split.length > this.options.tagIndex) {
      tags = [split[this.options.tagIndex].toUpperCase()];
    }
    split.forEach((part) => {
      if (part.startsWith(":")) {
        const param = part.replace(":", "");
        part = "{" + param + "}";
        parameters = {
          ...parameters,
          [param]: {
            in: "path",
            name: param,
            schema: {
              type:
                param === "id" || param.endsWith("_id") ? "integer" : "string",
            },
            required: true,
          },
        };
      }
      pattern += "/" + part;
    });

    return { tags, parameters, pattern };
  }

  private async getSchemas() {
    const schemas = {
      Any: {
        description: "Any JSON object not defined as schema",
      },
    };
    const files = await this.getFiles(path.join(this.options.path , "/Models"), []);
    const readFile = util.promisify(fs.readFile);
    for (let file of files) {
      const data = await readFile(file, "utf8");
      file = file.replace(".ts", "");
      const split = file.split("/");
      const name = split[split.length - 1].replace(".ts", "");
      file = file.replace("app/", "/app/");
      let schema = { type: "object", properties: this.parseProperties(data) };
      schemas[name] = schema;
    }

    return schemas;
  }

  private parseProperties(data) {
    let props = {};
    // remove empty lines
    data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
    const lines = data.split("\n");

    lines.forEach((line, index) => {
      line = line.trim();
      // skip comments
      if (
        line.startsWith("//") ||
        line.startsWith("/*") ||
        line.startsWith("*")
      )
        return;
      if (index > 0 && lines[index - 1].includes("serializeAs: null")) return;
      if (index > 0 && lines[index - 1].includes("@no-swagger")) return;
      if (!line.startsWith("public ") && !line.startsWith("public get")) return;
      if (line.includes("(") && !line.startsWith("public get")) return;
      let s = line.split("public ");
      let s2 = s[1].split(":");
      if (line.startsWith("public get")) {
        s = line.split("public get");
        let s2 = s[1].split(":");
      }

      let field = s2[0];
      let type = s2[1];
      let enums = [];
      let format = "";
      let example: any = this.examples(field);
      if (index > 0 && lines[index - 1].includes("@enum")) {
        const l = lines[index - 1];
        let en = this.getBetweenBrackets(l, "enum");
        if (en !== "") {
          enums = en.split(",");
          example = enums[0];
        }
      }

      if (index > 0 && lines[index - 1].includes("@example")) {
        const l = lines[index - 1];
        let match = l.match(/example\(([^()]*)\)/g);
        if (match !== null) {
          const m = match[0].replace("example(", "").replace(")", "");
          example = m;
        }
      }

      if (typeof type === "undefined") {
        type = "string";
        format = "";
      }

      field = field.trim();

      type = type.trim();

      field = field.replace("()", "");
      field = field.replace("get ", "");
      type = type.replace("{", "");
      field = snakeCase(field);

      let indicator = "type";

      if (example === null) {
        example = "string";
      }

      let isRelation = false;

      // if relation to another model
      if (type.includes("typeof")) {
        s = type.split("typeof ");
        type = "#/components/schemas/" + s[1].slice(0, -1);
        indicator = "$ref";
        isRelation = true;
      } else {
        type = type.toLowerCase();
      }

      if (field == "id" || field.includes("_id")) {
        type = "integer";
      }

      if (type === "datetime") {
        indicator = "type";
        type = "string";
        format = "date-time";
        example = "2021-03-23T16:13:08.489+01:00";
      }

      if (field === "email") {
        indicator = "type";
        type = "string";
        format = "email";
        example = "johndoe@example.com";
      }
      if (field === "password") {
        indicator = "type";
        type = "string";
        format = "password";
      }
      if (type === "any") {
        indicator = "$ref";
        type = "#/components/schemas/Any";
      }
      type = type.trim();

      let prop = {};
      if (type === "integer" || type === "number") {
        if (example === null || example === "string") {
          example = 1;
        }
      }
      prop[indicator] = type;
      prop["example"] = example;
      if (
        line.includes("HasMany") ||
        line.includes("ManyToMany") ||
        line.includes("HasManyThrough")
      ) {
        props[field] = { type: "array", items: prop };
      } else {
        props[field] = prop;
        if (format !== "") {
          props[field]["format"] = format;
        }
      }
      if (enums.length > 0) {
        props[field]["enum"] = enums;
      }
    });

    return props;
  }

  private examples(field) {
    const ex = {
      title: "Lorem Ipsum",
      description: "Lorem ipsum dolor sit amet",
      name: "John Doe",
      full_name: "John Doe",
      first_name: "John",
      last_name: "Doe",
      email: "johndoe@example.com",
      address: "1028 Farland Street",
      country: "United States of America",
      country_code: "US",
      zip: 60617,
      city: "Chicago",
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

  private async getFiles(dir, files_) {
    const fs = require("fs");
    files_ = files_ || [];
    var files = await fs.readdirSync(dir);
    for (let i in files) {
      var name = dir + "/" + files[i];
      if (fs.statSync(name).isDirectory()) {
        this.getFiles(name, files_);
      } else {
        files_.push(name);
      }
    }
    return files_;
  }
}
