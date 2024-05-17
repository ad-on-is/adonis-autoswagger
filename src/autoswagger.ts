import YAML from "json-to-pretty-yaml";
import fs from "fs";
import path from "path";
import util from "util";
import HTTPStatusCode from "http-status-code";
import _ from "lodash";
import { isEmpty, isUndefined } from "lodash";
import { existsSync } from "fs";
import { scalarCustomCss } from "./scalarCustomCss";
import { serializeV6Middleware, serializeV6Handler } from "./adonishelpers";
import {
  InterfaceParser,
  ModelParser,
  CommentParser,
  RouteParser,
} from "./parsers";

import type { options, AdonisRoutes, v6Handler, AdonisRoute } from "./types";

import { mergeParams, formatOperationId } from "./helpers";
import ExampleGenerator, { ExampleInterfaces } from "./example";

export class AutoSwagger {
  private options: options;
  private schemas = {};
  private commentParser: CommentParser;
  private modelParser: ModelParser;
  private interfaceParser: InterfaceParser;
  private routeParser: RouteParser;
  private customPaths = {};

  ui(url: string, options?: options) {
    const persistAuthString = options?.persistAuthorization
      ? "persistAuthorization: true,"
      : "";
    return `<!DOCTYPE html>
		<html lang="en">
		<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="X-UA-Compatible" content="ie=edge">
				<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.3/swagger-ui-standalone-preset.js"></script>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.3/swagger-ui-bundle.js"></script>
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.3/swagger-ui.css" />
				<title>Documentation</title>
		</head>
		<body>
				<div id="swagger-ui"></div>
				<script>
						window.onload = function() {
							SwaggerUIBundle({
								url: "${url}",
								dom_id: '#swagger-ui',
								presets: [
									SwaggerUIBundle.presets.apis,
									SwaggerUIStandalonePreset
								],
								layout: "BaseLayout",
                ${persistAuthString}
							})
						}
				</script>
		</body>
		</html>`;
  }

  rapidoc(url: string, style = "view") {
    return (
      `
    <!doctype html> <!-- Important: must specify -->
    <html>
      <head>
        <meta charset="utf-8"> <!-- Important: rapi-doc uses utf8 characters -->
        <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
        <title>Documentation</title>
      </head>
      <body>
        <rapi-doc
          spec-url = "` +
      url +
      `"
      theme = "dark"
      bg-color = "#24283b"
      header-color = "#1a1b26"
      nav-hover-bg-color = "#1a1b26"
      nav-bg-color = "#24283b"
      text-color = "#c0caf5"
      nav-text-color = "#c0caf5"
      primary-color = "#9aa5ce"
      heading-text = "Documentation"
      sort-tags = "true"
      render-style = "` +
      style +
      `"
      default-schema-tab = "example"
      show-components = "true"
      allow-spec-url-load = "false"
      allow-spec-file-load = "false"
      sort-endpoints-by = "path"

        > </rapi-doc>
      </body>
    </html>
    `
    );
  }

  scalar(url: string) {
    return `
      <!doctype html>
      <html>
        <head>
          <title>API Reference</title>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1" />
          <style>
          ${scalarCustomCss}
          </style>
        </head>
        <body>
          <script
            id="api-reference"
            data-url="${url}"
            data-proxy-url="https://api.scalar.com/request-proxy"></script>
          <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
        </body>
      </html>
    `;
  }

  jsonToYaml(json: any) {
    return YAML.stringify(json);
  }

  async json(routes: any, options: options) {
    if (process.env.NODE_ENV === "production") {
      return this.readFile(options.path, "json");
    }
    return await this.generate(routes, options);
  }

  async writeFile(routes: any, options: options) {
    const json = await this.generate(routes, options);
    const contents = this.jsonToYaml(json);
    const filePath = options.path + "swagger.yml";
    const filePathJson = options.path + "swagger.json";

    fs.writeFileSync(filePath, contents);
    fs.writeFileSync(filePathJson, JSON.stringify(json, null, 2));
  }

  private async readFile(rootPath, type = "yml") {
    const filePath = rootPath + "swagger." + type;
    const data = fs.readFileSync(filePath, "utf-8");
    if (!data) {
      console.error("Error reading file");
      return;
    }
    return data;
  }

  async docs(routes: any, options: options) {
    if (process.env.NODE_ENV === "production") {
      return this.readFile(options.path);
    }
    return this.jsonToYaml(await this.generate(routes, options));
  }

  private async generate(adonisRoutes: AdonisRoutes, options: options) {
    this.options = {
      ...{
        snakeCase: true,
        preferredPutPatch: "PUT",
        debug: false,
      },
      ...options,
    };

    const routes = adonisRoutes.root;
    this.options.appPath = this.options.path + "app";

    try {
      const pj = fs.readFileSync(path.join(this.options.path, "package.json"));

      const pjson = JSON.parse(pj.toString());
      if (pjson.imports) {
        Object.entries(pjson.imports).forEach(([key, value]) => {
          const k = (key as string).replaceAll("/*", "");
          this.customPaths[k] = (value as string)
            .replaceAll("/*.js", "")
            .replaceAll("./", "");
        });
      }
    } catch (e) {
      console.error(e);
    }

    this.commentParser = new CommentParser(this.options);
    this.routeParser = new RouteParser(this.options);
    this.modelParser = new ModelParser(this.options.snakeCase);
    this.interfaceParser = new InterfaceParser(this.options.snakeCase);
    this.schemas = await this.getSchemas();
    if (this.options.debug) {
      console.log("Schemas", this.schemas);
      console.log("CustomPaths", this.customPaths);
    }
    this.commentParser.exampleGenerator = new ExampleGenerator(this.schemas);

    if (this.options.debug) {
      console.log("AdonisJS AutoSwagger");
      console.log(this.options);
    }

    const docs = {
      openapi: "3.0.0",
      info: options.info || {
        title: options.title,
        version: options.version,
        description:
          options.description ||
          "Generated by AdonisJS AutoSwagger https://github.com/ad-on-is/adonis-autoswagger",
      },

      components: {
        responses: {
          Forbidden: {
            description: "Access token is missing or invalid",
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
          BasicAuth: {
            type: "http",
            scheme: "basic",
          },
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
          },
          ...this.options.securitySchemes,
        },
        schemas: this.schemas,
      },
      paths: {},
      tags: [],
    };
    let paths = {};

    let sscheme = "BearerAuth";
    if (this.options.defaultSecurityScheme) {
      sscheme = this.options.defaultSecurityScheme;
    }

    let securities = {
      "auth": { [sscheme]: ["access"] },
      "auth:api": { [sscheme]: ["access"] },
      ...this.options.authMiddlewares
        ?.map((am) => ({
          [am]: { [sscheme]: ["access"] },
        }))
        .reduce((acc, val) => ({ ...acc, ...val }), {}),
    };

    let globalTags = [];
    for await (const route of routes) {
      let ignore = false;
      for (const i of options.ignore) {
        if (
          route.pattern.includes(i) ||
          (i.endsWith("*") && route.pattern.startsWith(i.slice(0, -1))) ||
          (i.startsWith("*") && route.pattern.endsWith(i.slice(1)))
        ) {
          ignore = true;
          break;
        }
      }
      if (ignore) continue;

      let security = [];
      const responseCodes = {
        GET: "200",
        POST: "201",
        DELETE: "202",
        PUT: "204",
      };

      if (!Array.isArray(route.middleware)) {
        route.middleware = serializeV6Middleware(route.middleware) as string[];
      }

      (route.middleware as string[]).forEach((m) => {
        if (typeof securities[m] !== "undefined") {
          security.push(securities[m]);
        }
      });

      let { tags, parameters, pattern } = this.routeParser.extractInfos(
        route.pattern
      );

      tags.forEach((tag) => {
        if (globalTags.filter((e) => e.name === tag).length > 0) return;
        if (tag === "") return;
        globalTags.push({
          name: tag,
          description: "Everything related to " + tag,
        });
      });

      const { sourceFile, action, customAnnotations, operationId } =
        await this.getDataBasedOnAdonisVersion(route);

      route.methods.forEach((method) => {
        let responses = {};
        if (method === "HEAD") return;

        if (
          route.methods.includes("PUT") &&
          route.methods.includes("PATCH") &&
          method !== this.options.preferredPutPatch
        )
          return;

        let description = "";
        let summary = "";
        let tag = "";
        let operationId: string;

        if (security.length > 0) {
          responses["401"] = {
            description: `Returns **401** (${HTTPStatusCode.getMessage(401)})`,
          };
          responses["403"] = {
            description: `Returns **403** (${HTTPStatusCode.getMessage(403)})`,
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
          operationId = customAnnotations[action].operationId;
          responses = { ...responses, ...customAnnotations[action].responses };
          requestBody = customAnnotations[action].requestBody;
          actionParams = customAnnotations[action].parameters;
          tag = customAnnotations[action].tag;
        }
        parameters = mergeParams(parameters, actionParams);

        if (tag != "") {
          globalTags.push({
            name: tag.toUpperCase(),
            description: "Everything related to " + tag.toUpperCase(),
          });
          tags = [tag.toUpperCase()];
        }

        if (isEmpty(responses)) {
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
          // Solve toLowerCase undefined exception
          // https://github.com/ad-on-is/adonis-autoswagger/issues/28
          tags[0] = tags[0] ?? "";

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

        const sf = sourceFile.split("/").at(-1).replace(".ts", "");
        let m = {
          summary: `${summary}${action !== "" ? ` (${action})` : "route"}`,
          description:
            description + "\n\n _" + sourceFile + "_ - **" + action + "**",
          operationId: operationId,
          parameters: parameters,
          tags: tags,
          responses: responses,
          security: security,
        };

        if (method !== "GET" && method !== "DELETE") {
          m["requestBody"] = requestBody;
        }

        pattern = pattern.slice(1);
        if (pattern === "") {
          pattern = "/";
        }

        paths = {
          ...paths,
          [pattern]: { ...paths[pattern], [method.toLowerCase()]: m },
        };
      });
    }

    // filter unused tags
    const usedTags = _.uniq(
      Object.entries(paths)
        .map(([p, val]) => Object.entries(val)[0][1].tags)
        .flat()
    );

    docs.tags = globalTags.filter((tag) => usedTags.includes(tag.name));
    docs.paths = paths;
    return docs;
  }

  private async getDataBasedOnAdonisVersion(route: AdonisRoute) {
    let sourceFile = "";
    let action = "";
    let customAnnotations;
    let operationId = "";
    if (
      route.meta.resolvedHandler !== null &&
      route.meta.resolvedHandler !== undefined
    ) {
      if (
        typeof route.meta.resolvedHandler.namespace !== "undefined" &&
        route.meta.resolvedHandler.method !== "handle"
      ) {
        sourceFile = route.meta.resolvedHandler.namespace;

        action = route.meta.resolvedHandler.method;
        // If not defined by an annotation, use the combination of "controllerNameMethodName"
        if (action !== "" && isUndefined(operationId) && route.handler) {
          operationId = formatOperationId(route.handler as string);
        }
      }
    }

    let v6handler = <v6Handler>route.handler;
    if (
      v6handler.reference !== null &&
      v6handler.reference !== undefined &&
      v6handler.reference !== ""
    ) {
      if (!Array.isArray(v6handler.reference)) {
        // handles magic strings
        // router.resource('/test', '#controllers/test_controller')
        [sourceFile, action] = v6handler.reference.split(".");
        const split = sourceFile.split("/");

        if (split[0].includes("#")) {
          sourceFile = sourceFile.replaceAll(
            split[0],
            this.customPaths[split[0]]
          );
        } else {
          sourceFile = this.options.appPath + "/controllers/" + sourceFile;
        }
        operationId = formatOperationId(v6handler.reference);
      } else {
        // handles lazy import
        // const TestController = () => import('#controllers/test_controller')
        v6handler = await serializeV6Handler(v6handler);
        action = v6handler.method;
        sourceFile = v6handler.moduleNameOrPath;
        operationId = formatOperationId(sourceFile + "." + action);
        const split = sourceFile.split("/");
        if (split[0].includes("#")) {
          sourceFile = sourceFile.replaceAll(
            split[0],
            this.customPaths[split[0]]
          );
        } else {
          sourceFile = this.options.appPath + "/" + sourceFile;
        }
      }
    }

    if (sourceFile !== "" && action !== "") {
      sourceFile = sourceFile.replace("App/", "app/") + ".ts";
      sourceFile = sourceFile.replace(".js", "");

      customAnnotations = await this.commentParser.getAnnotations(
        sourceFile,
        action
      );
    }
    if (
      typeof customAnnotations !== "undefined" &&
      typeof customAnnotations.operationId !== "undefined" &&
      customAnnotations.operationId !== ""
    ) {
      operationId = customAnnotations.operationId;
    }
    if (this.options.debug) {
      console.log(route.pattern, sourceFile, action);
    }
    return { sourceFile, action, customAnnotations, operationId };
  }

  private async getSchemas() {
    let schemas = {
      Any: {
        description: "Any JSON object not defined as schema",
      },
    };

    schemas = {
      ...schemas,
      ...(await this.getInterfaces()),
      ...(await this.getModels()),
    };

    return schemas;
  }

  private async getModels() {
    const models = {};
    let p = path.join(this.options.appPath, "/Models");
    let p6 = path.join(this.options.appPath, "/models");

    if (typeof this.customPaths["#models"] !== "undefined") {
      // it's v6
      p6.replaceAll("app/models", this.customPaths["#models"]);
    }

    if (!existsSync(p) && !existsSync(p6)) {
      if (this.options.debug) {
        console.log("Model paths don't exist", p, p6);
      }
      return models;
    }
    if (existsSync(p6)) {
      p = p6;
    }
    const files = await this.getFiles(p, []);
    const readFile = util.promisify(fs.readFile);
    if (this.options.debug) {
      console.log("Found model files", files);
    }
    for (let file of files) {
      file = file.replace(".js", "");
      const data = await readFile(file, "utf8");
      file = file.replace(".ts", "");
      const split = file.split("/");
      let name = split[split.length - 1].replace(".ts", "");
      file = file.replace("app/", "/app/");
      const parsed = this.modelParser.parseModelProperties(data);
      if (parsed.name !== "") {
        name = parsed.name;
      }
      let schema = {
        type: "object",
	required: parsed.required,
        properties: parsed.props,
        description: name + " (Model)",
      };
      models[name] = schema;
    }
    return models;
  }

  private async getInterfaces() {
    let interfaces = {};
    let p = path.join(this.options.appPath, "/Interfaces");
    const p6 = path.join(this.options.appPath, "/interfaces");

    if (typeof this.customPaths["#interfaces"] !== "undefined") {
      // it's v6
      p6.replaceAll("app/interfaces", this.customPaths["#interfaces"]);
    }

    if (!existsSync(p) && !existsSync(p6)) {
      if (this.options.debug) {
        console.log("Interface paths don't exist", p, p6);
      }
      return interfaces;
    }
    if (existsSync(p6)) {
      p = p6;
    }
    const files = await this.getFiles(p, []);
    if (this.options.debug) {
      console.log("Found interfaces files", files);
    }
    const readFile = util.promisify(fs.readFile);
    for (let file of files) {
      file = file.replace(".js", "");
      const data = await readFile(file, "utf8");
      file = file.replace(".ts", "");
      const split = file.split("/");
      const name = split[split.length - 1].replace(".ts", "");
      file = file.replace("app/", "/app/");
      interfaces = {
        ...interfaces,
        ...this.interfaceParser.parseInterfaces(data),
      };
    }

    interfaces = {
      ...interfaces,
      ...ExampleInterfaces.paginationInterface(),
    };
    return interfaces;
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
