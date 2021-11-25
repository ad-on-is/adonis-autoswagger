const YAML = require("json-to-pretty-yaml");
const fs = require("fs");
const util = require("util");
const extract = require("extract-comments");
const HTTPStatusCode = require("http-status-code");
const _ = require("lodash/core");
import { camelCase, snakeCase } from "change-case";

export class AutoSwagger {
  public path: string;
  private parsedFiles: string[] = [];
  private tagIndex = 2;
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

  async docs(routes, options) {
    routes = routes.root;
    this.path = options.path.replace("/start", "") + "/app";
    this.tagIndex = options.tagIndex;
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

      let methods = {};

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
        security = [{ BearerAuth: ["write"] }];
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

        if (security.length > 0) {
          responses["401"] = {
            description: HTTPStatusCode.getMessage(401),
          };
        }

        let requestBody = {};

        if (action !== "" && typeof customAnnotations[action] !== "undefined") {
          description = customAnnotations[action].description;
          responses = { ...responses, ...customAnnotations[action].responses };
          requestBody = customAnnotations[action].requestBody;
        }

        if (_.isEmpty(responses)) {
          responses[responseCodes[method]] = {
            description: HTTPStatusCode.getMessage(responseCodes[method]),
            content: {
              "application/json": {},
            },
          };
        }

        methods[method.toLowerCase()] = {
          summary:
            sourceFile === "" && action == ""
              ? ""
              : sourceFile.replace("App/Controllers/Http/", "") + "::" + action,
          description: description,
          parameters: parameters,
          tags: tags,
          responses: responses,
          requestBody: requestBody,
          security: security,
        };
      });
      pattern = pattern.slice(1);
      paths[pattern] = methods;
      docs.paths = paths;
    }
    return YAML.stringify(docs);
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
    let description = "somedesc";
    let responses = {};
    let requestBody = {};
    // requestBody = {
    //   content: {
    //     "application/json": {
    //       schema: {
    //         $ref: "#/components/schemas/Product",
    //       },
    //     },
    //   },
    // };
    lines.forEach((line) => {
      if (line.startsWith("@description")) {
        description = line.replace("@description ", "");
      }
      // if (line.startsWith("@requestBody")) {
      //   line = line.replace("@requestBody ", "");
      //   requestBody = {
      //     content: {
      //       "application/json": {
      //         schema: {
      //           $ref: "#/components/schemas/Product",
      //         },
      //       },
      //     },
      //   };
      // }
      if (line.startsWith("@response")) {
        line = line.replace("@response ", "");
        let [s, d] = line.split(" - ");
        if (typeof s === "undefined") return;
        responses[s] = {};
        if (typeof d === "undefined") {
          d = HTTPStatusCode.getMessage(s);
        } else {
          d = HTTPStatusCode.getMessage(s) + ": " + d;
          let ref = line.substring(
            line.indexOf("{") + 1,
            line.lastIndexOf("}")
          );
          // references a schema
          if (ref !== "") {
            let inc = d
              .substring(d.indexOf("with("), d.lastIndexOf(")"))
              .replace("with(", "");
            let only = d.substring(d.indexOf("only(") + 1, d.lastIndexOf(")"));
            d = "Returns a single instance of type " + ref;
            // references a schema array
            if (ref.includes("[]")) {
              ref = ref.replace("[]", "");
              d = "Returns an array of type " + ref;
              responses[s]["content"] = {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/" + ref },
                  },
                  example: [this.getSchemaExampleBasedOnAnnotation(ref, inc)],
                },
              };
            } else {
              responses[s]["content"] = {
                "application/json": {
                  schema: { $ref: "#/components/schemas/" + ref },
                  example: this.getSchemaExampleBasedOnAnnotation(ref, inc),
                },
              };
            }
          }
        }
        responses[s]["description"] = d;
      }
    });
    return {
      description: description,
      responses: responses,
      requestBody: requestBody,
    };
  }

  private getSchemaExampleBasedOnAnnotation(schema, inc = "", parent = "") {
    let props = {};
    let properties = this.schemas[schema].properties;
    let include = inc.toString().split(",");
    if (typeof properties === "undefined") return;
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value["$ref"] !== "undefined") {
        if (
          parent === "" &&
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

        const rel = value["$ref"].replace("#/components/schemas/", "");
        props[key] = this.getSchemaExampleBasedOnAnnotation(
          rel,
          inc,
          parent === "" ? key : parent + "." + key
        );
      } else {
        props[key] = value["example"];
      }
    }
    return props;
  }

  /*
    extract path-variables, tags and the uri-pattern
  */
  private extractInfos(p) {
    let parameters = [];
    let pattern = "";
    let tags = [];
    const split = p.split("/");
    if (split.length > this.tagIndex) {
      tags = [split[this.tagIndex].toUpperCase()];
    }
    split.forEach((part) => {
      if (part.startsWith(":")) {
        const param = part.replace(":", "");
        part = "{" + param + "}";
        parameters.push({
          in: "path",
          name: param,
          schema: {
            type:
              param === "id" || param.endsWith("_id") ? "integer" : "string",
          },
          required: true,
        });
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
    const files = await this.getFiles(this.path + "/Models", []);
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
    data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
    const lines = data.split("\n");

    lines.forEach((line, index) => {
      if (index > 0 && lines[index - 1].includes("serializeAs: null")) return;
      if (!line.startsWith("public ") && !line.startsWith("public get")) return;
      if (line.includes("(") && !line.startsWith("public get")) return;
      // if (line.includes("<")) return;
      let s = line.split("public ");
      let s2 = s[1].split(":");
      if (line.startsWith("public get")) {
        //   line = line.replace("()", "");
        //   line = line.slice(0, -1);
        s = line.split("public get");
        let s2 = s[1].split(":");
      }

      let field = s2[0];
      let type = s2[1];

      let format = "";

      if (typeof type === "undefined") {
        type = "string";
        format = "undefined";
      }

      field = field.trim();

      type = type.trim();

      field = field.replace("()", "");
      field = field.replace("get ", "");
      type = type.replace("{", "");

      let indicator = "type";
      let example: any = "string";

      // if relation to another model
      if (type.includes("typeof")) {
        s = type.split("typeof ");
        type = "#/components/schemas/" + s[1].slice(0, -1);
        indicator = "$ref";
      } else {
        type = type.toLowerCase();
      }

      field = snakeCase(field);

      if (field == "id" || field.includes("_id")) {
        type = "integer";
      }

      if (type === "datetime") {
        indicator = "type";
        type = "string";
        format = "date-time";
        example = "21.10.2021";
      }

      if (type === "integer" || type === "number") {
        example = 123;
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
          props[field][format] = format;
        }
      }
    });
    return props;
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
