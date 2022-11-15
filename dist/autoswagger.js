"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoSwagger = void 0;
const YAML = require("json-to-pretty-yaml");
const fs = require("fs");
const path = require("path");
const util = require("util");
const extract = require("extract-comments");
const HTTPStatusCode = require("http-status-code");
const _ = require("lodash/core");
const change_case_1 = require("change-case");
const fs_1 = require("fs");
class AutoSwagger {
    constructor() {
        this.parsedFiles = [];
        this.schemas = {};
        this.standardTypes = [
            "string",
            "number",
            "integer",
            "datetime",
            "boolean",
        ];
    }
    ui(url) {
        return (`<!DOCTYPE html>
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
		</html>`);
    }
    rapidoc(url, style = "view") {
        return (`
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
    `);
    }
    writeFile(routes, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const contents = yield this.generate(routes, options);
            const filePath = path.join(options.path + "/../swagger.yml");
            fs.writeFileSync(filePath, contents);
        });
    }
    readFile(rootPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = path.join(rootPath + "/../swagger.yml");
            const data = fs.readFileSync(filePath, "utf-8");
            if (!data) {
                console.error("Error reading file");
                return;
            }
            return data;
        });
    }
    docs(routes, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.NODE_ENV === "production") {
                return this.readFile(options.path);
            }
            return this.generate(routes, options);
        });
    }
    generate(routes, options) {
        var routes_1, routes_1_1;
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function* () {
            this.options = Object.assign({
                snakeCase: true,
                preferredPutPatch: "PUT",
            }, options);
            routes = routes.root;
            this.options.path = path.join(this.options.path + "/../app");
            this.schemas = yield this.getSchemas();
            const docs = {
                openapi: "3.0.0",
                info: {
                    title: options.title,
                    version: options.version,
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
                    },
                    schemas: this.schemas,
                },
                paths: {},
                tags: [],
            };
            let paths = {};
            let securities = {
                auth: { BearerAuth: ["access"] },
                "auth:api": { BearerAuth: ["access"] },
            };
            let globalTags = [];
            try {
                for (routes_1 = __asyncValues(routes); routes_1_1 = yield routes_1.next(), !routes_1_1.done;) {
                    const route = routes_1_1.value;
                    if (options.ignore.includes(route.pattern))
                        continue;
                    let security = [];
                    const responseCodes = {
                        GET: "200",
                        POST: "201",
                        DELETE: "202",
                        PUT: "204",
                    };
                    route.middleware.forEach((m) => {
                        if (typeof securities[m] !== "undefined") {
                            security.push(securities[m]);
                        }
                    });
                    let sourceFile = "";
                    let action = "";
                    let customAnnotations;
                    if (route.meta.resolvedHandler !== null) {
                        if (typeof route.meta.resolvedHandler.namespace !== "undefined" &&
                            route.meta.resolvedHandler.method !== "handle") {
                            sourceFile = route.meta.resolvedHandler.namespace;
                            action = route.meta.resolvedHandler.method;
                            if (sourceFile !== "" && action !== "") {
                                customAnnotations = yield this.getCustomAnnotations(sourceFile, action);
                            }
                        }
                    }
                    let { tags, parameters, pattern } = this.extractInfos(route.pattern);
                    tags.forEach((tag) => {
                        if (globalTags.filter((e) => e.name === tag).length > 0)
                            return;
                        if (tag === "")
                            return;
                        globalTags.push({
                            name: tag,
                            description: "Everything related to " + tag,
                        });
                    });
                    route.methods.forEach((method) => {
                        let responses = {};
                        if (method === "HEAD")
                            return;
                        if (route.methods.includes("PUT") &&
                            route.methods.includes("PATCH") &&
                            method !== this.options.preferredPutPatch)
                            return;
                        let description = "";
                        let summary = "";
                        if (security.length > 0) {
                            responses["401"] = {
                                description: HTTPStatusCode.getMessage(401),
                            };
                            responses["403"] = {
                                description: HTTPStatusCode.getMessage(403),
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
                            responses = Object.assign(Object.assign({}, responses), customAnnotations[action].responses);
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
                        }
                        else {
                            if (typeof responses[responseCodes[method]] !== "undefined" &&
                                typeof responses[responseCodes[method]]["summary"] !== "undefined") {
                                if (summary === "") {
                                    summary = responses[responseCodes[method]]["summary"];
                                }
                                delete responses[responseCodes[method]]["summary"];
                            }
                            if (typeof responses[responseCodes[method]] !== "undefined" &&
                                typeof responses[responseCodes[method]]["description"] !==
                                    "undefined") {
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
                            summary: sourceFile === "" && action == ""
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
                        paths = Object.assign(Object.assign({}, paths), { [pattern]: Object.assign(Object.assign({}, paths[pattern]), { [method.toLowerCase()]: m }) });
                    });
                    docs.tags = globalTags;
                    docs.paths = paths;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (routes_1_1 && !routes_1_1.done && (_a = routes_1.return)) yield _a.call(routes_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return YAML.stringify(docs);
        });
    }
    mergeParams(initial, custom) {
        let merge = Object.assign(initial, custom);
        let params = [];
        for (const [key, value] of Object.entries(merge)) {
            params.push(value);
        }
        return params;
    }
    getCustomAnnotations(file, action) {
        return __awaiter(this, void 0, void 0, function* () {
            let annotations = {};
            if (typeof file === "undefined")
                return;
            if (typeof this.parsedFiles[file] !== "undefined")
                return;
            this.parsedFiles.push(file);
            file = file.replace("App/", "app/") + ".ts";
            const readFile = util.promisify(fs.readFile);
            const data = yield readFile(file, "utf8");
            const comments = extract(data);
            if (comments.length > 0) {
                comments.forEach((comment) => {
                    if (comment.type !== "BlockComment")
                        return;
                    if (!comment.value.includes("@" + action))
                        return;
                    let lines = comment.value.split("\n");
                    lines = lines.filter((l) => l != "");
                    annotations[action] = this.parseAnnotations(lines);
                });
            }
            return annotations;
        });
    }
    parseAnnotations(lines) {
        let summary = "";
        let upload = "";
        let description = "";
        let responses = {};
        let requestBody = {};
        requestBody = {
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                    },
                    example: "",
                },
            },
        };
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
                responses = Object.assign(Object.assign({}, responses), this.parseResponse(line));
            }
            if (line.startsWith("@responseHeader")) {
                const header = this.parseResponseHeader(line);
                if (header === null) {
                    console.error("Error with line: " + line);
                    return;
                }
                headers[header["status"]] = Object.assign(Object.assign({}, headers[header["status"]]), header["header"]);
            }
            if (line.startsWith("@requestBody")) {
                requestBody = this.parseRequestBody(line);
            }
            if (line.startsWith("@param")) {
                parameters = Object.assign(Object.assign({}, parameters), this.parseParam(line));
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
    parseParam(line) {
        let where = "path";
        let required = true;
        let type = "string";
        let example = null;
        let enums = [];
        if (line.startsWith("@paramUse")) {
            let use = this.getBetweenBrackets(line, "paramUse");
            const used = use.split(",");
            let h = [];
            used.forEach((u) => {
                if (typeof this.options.common.parameters[u] === "undefined") {
                    return;
                }
                const common = this.options.common.parameters[u];
                h = [...h, ...common];
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
    parseResponseHeader(line) {
        let description = "";
        let example = "";
        let type = "string";
        let enums = [];
        line = line.replace("@responseHeader ", "");
        let [status, name, desc, meta] = line.split(" - ");
        if (typeof status === "undefined" || typeof name === "undefined") {
            return null;
        }
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
                h = Object.assign(Object.assign({}, h), common);
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
    parseResponse(line) {
        let responses = {};
        line = line.replace("@responseBody ", "");
        let [status, res] = line.split(" - ");
        let sum = "";
        if (typeof status === "undefined")
            return;
        responses[status] = {};
        if (typeof res === "undefined") {
            res = HTTPStatusCode.getMessage(status);
        }
        else {
            res = HTTPStatusCode.getMessage(status) + ": " + res;
            let ref = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));
            let json = line.substring(line.indexOf("{") + 1, line.lastIndexOf("}"));
            if (json !== "") {
                try {
                    let j = JSON.parse("{" + json + "}");
                    j = this.jsonToRef(j);
                    responses[status]["content"] = {
                        "application/json": {
                            schema: {
                                type: "object",
                            },
                            example: j,
                        },
                    };
                }
                catch (_a) {
                    console.error("Invalid JSON for: " + line);
                }
            }
            // references a schema
            if (typeof ref !== "undefined" && ref !== "") {
                const inc = this.getBetweenBrackets(res, "with");
                const exc = this.getBetweenBrackets(res, "exclude");
                const only = this.getBetweenBrackets(res, "only");
                const append = this.getBetweenBrackets(res, "append");
                let app = {};
                try {
                    app = JSON.parse("{" + append + "}");
                }
                catch (_b) { }
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
                            example: [
                                Object.assign(this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only), app),
                            ],
                        },
                    };
                }
                else {
                    responses[status]["content"] = {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/" + ref },
                            example: Object.assign(this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only), app),
                        },
                    };
                }
                if (only !== "") {
                    res += " **only containing** _" + only.replace(/,/g, ", ") + "_";
                }
                if (inc !== "") {
                    res += " **including** _" + inc.replace(/,/g, ", ") + "_";
                }
                else {
                    res += " **without** any _relations_";
                }
                if (exc !== "") {
                    res += " and **excludes** _" + exc.replace(/,/g, ", ") + "_";
                }
                res += ". Take a look at the example for further details.";
            }
        }
        responses[status]["description"] = res;
        // responses[status]['summary'] = sum
        return responses;
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
                    const inc = this.getBetweenBrackets(v, "with");
                    const exc = this.getBetweenBrackets(v, "exclude");
                    const append = this.getBetweenBrackets(v, "append");
                    const only = this.getBetweenBrackets(v, "only");
                    let app = {};
                    try {
                        app = JSON.parse("{" + append + "}");
                    }
                    catch (_a) { }
                    // references a schema array
                    if (ref.includes("[]")) {
                        ref = ref.replace("[]", "");
                        v = [
                            Object.assign(this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only), app),
                        ].reduce((a) => a);
                    }
                    else {
                        v = Object.assign(this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only), app);
                    }
                }
            }
            out[k] = v;
        }
        return out;
    }
    parseRequestBody(line) {
        let requestBody = {};
        line = line.replace("@requestBody ", "");
        let json = line.substring(line.indexOf("{") + 1, line.lastIndexOf("}"));
        if (json !== "") {
            try {
                let j = JSON.parse("{" + json + "}");
                j = this.jsonToRef(j);
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
            }
            catch (_a) {
                console.error("Invalid JSON for " + line);
            }
        }
        let ref = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));
        // references a schema
        if (ref !== "" && json === "") {
            const inc = this.getBetweenBrackets(line, "with");
            const exc = this.getBetweenBrackets(line, "exclude");
            const append = this.getBetweenBrackets(line, "append");
            const only = this.getBetweenBrackets(line, "only");
            let app = {};
            try {
                app = JSON.parse("{" + append + "}");
            }
            catch (_b) { }
            // references a schema array
            if (ref.includes("[]")) {
                ref = ref.replace("[]", "");
                requestBody = {
                    content: {
                        "application/json": {
                            schema: {
                                type: "array",
                                items: { $ref: "#/components/schemas/" + ref },
                            },
                            example: [
                                Object.assign(this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only), app),
                            ],
                        },
                    },
                };
            }
            else {
                requestBody = {
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/" + ref,
                            },
                            example: Object.assign(this.getSchemaExampleBasedOnAnnotation(ref, inc, exc, only), app),
                        },
                    },
                };
            }
        }
        return requestBody;
    }
    getBetweenBrackets(value, start) {
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
    getSchemaExampleBasedOnAnnotation(schema, inc = "", exc = "", onl = "", first = "", parent = "", level = 0) {
        let props = {};
        if (!this.schemas[schema]) {
            return props;
        }
        let properties = this.schemas[schema].properties;
        let include = inc.toString().split(",");
        let exclude = exc.toString().split(",");
        let only = onl.toString().split(",");
        only = only.length === 1 && only[0] === "" ? [] : only;
        if (typeof properties === "undefined")
            return;
        // skip nested if not requested
        if (parent !== "" &&
            schema !== "" &&
            parent.includes(".") &&
            this.schemas[schema].description === "Model" &&
            !inc.includes(parent) &&
            !inc.includes(parent + ".relations") &&
            !inc.includes(first + ".relations")) {
            return null;
        }
        for (const [key, value] of Object.entries(properties)) {
            let isArray = false;
            if (exclude.includes(key))
                continue;
            if (exclude.includes(parent + "." + key))
                continue;
            if (key === "password" &&
                !include.includes("password") &&
                !only.includes("password"))
                continue;
            if (key === "password_confirmation" &&
                !include.includes("password_confirmation") &&
                !only.includes("password_confirmation"))
                continue;
            if ((key === "created_at" ||
                key === "updated_at" ||
                key === "deleted_at") &&
                exc.includes("timestamps"))
                continue;
            let rel = "";
            let example = value["example"];
            if (parent === "" && only.length > 0 && !only.includes(key))
                continue;
            if (typeof value["$ref"] !== "undefined") {
                rel = value["$ref"].replace("#/components/schemas/", "");
            }
            if (typeof value["items"] !== "undefined" &&
                typeof value["items"]["$ref"] !== "undefined") {
                rel = value["items"]["$ref"].replace("#/components/schemas/", "");
            }
            if (typeof value["items"] !== "undefined") {
                isArray = true;
                example = value["items"]["example"];
            }
            if (rel !== "") {
                // skip related models of main schema
                if (parent === "" &&
                    rel !== "" &&
                    typeof this.schemas[rel] !== "undefined" &&
                    this.schemas[rel].description === "Model" &&
                    !include.includes("relations") &&
                    !include.includes(key)) {
                    continue;
                }
                if (typeof value["items"] !== "undefined" &&
                    typeof value["items"]["$ref"] !== "undefined") {
                    rel = value["items"]["$ref"].replace("#/components/schemas/", "");
                }
                if (rel == "") {
                    return;
                }
                let propdata = "";
                if (level <= 10) {
                    propdata = this.getSchemaExampleBasedOnAnnotation(rel, inc, exc, onl, parent, parent === "" ? key : parent + "." + key, level++);
                }
                if (propdata === null) {
                    continue;
                }
                props[key] = isArray ? [propdata] : propdata;
            }
            else {
                props[key] = isArray ? [example] : example;
            }
        }
        return props;
    }
    /*
      extract path-variables, tags and the uri-pattern
    */
    extractInfos(p) {
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
                parameters = Object.assign(Object.assign({}, parameters), { [param]: {
                        in: "path",
                        name: param,
                        schema: {
                            type: "string",
                        },
                        required: true,
                    } });
            }
            pattern += "/" + part;
        });
        return { tags, parameters, pattern };
    }
    getSchemas() {
        return __awaiter(this, void 0, void 0, function* () {
            let schemas = {
                Any: {
                    description: "Any JSON object not defined as schema",
                },
            };
            schemas = Object.assign(Object.assign(Object.assign({}, schemas), (yield this.getInterfaces())), (yield this.getModels()));
            return schemas;
        });
    }
    getModels() {
        return __awaiter(this, void 0, void 0, function* () {
            const models = {};
            const p = path.join(this.options.path, "/Models");
            if (!(0, fs_1.existsSync)(p)) {
                return models;
            }
            const files = yield this.getFiles(p, []);
            const readFile = util.promisify(fs.readFile);
            for (let file of files) {
                const data = yield readFile(file, "utf8");
                file = file.replace(".ts", "");
                const split = file.split("/");
                const name = split[split.length - 1].replace(".ts", "");
                file = file.replace("app/", "/app/");
                let schema = {
                    type: "object",
                    properties: this.parseModelProperties(data),
                    description: "Model",
                };
                models[name] = schema;
            }
            return models;
        });
    }
    getInterfaces() {
        return __awaiter(this, void 0, void 0, function* () {
            let interfaces = {};
            const p = path.join(this.options.path, "/Interfaces");
            if (!(0, fs_1.existsSync)(p)) {
                return interfaces;
            }
            const files = yield this.getFiles(p, []);
            const readFile = util.promisify(fs.readFile);
            for (let file of files) {
                const data = yield readFile(file, "utf8");
                file = file.replace(".ts", "");
                const split = file.split("/");
                const name = split[split.length - 1].replace(".ts", "");
                file = file.replace("app/", "/app/");
                interfaces = Object.assign(Object.assign({}, interfaces), this.parseInterfaces(data));
            }
            return interfaces;
        });
    }
    parseInterfaces(data) {
        let interfaces = {};
        let name = "";
        let props = {};
        // remove empty lines
        data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
        const lines = data.split("\n");
        lines.forEach((line, index) => {
            line = line.trim();
            if (line.startsWith("export") && !line.startsWith("export default"))
                return;
            if (line.startsWith("//") ||
                line.startsWith("/*") ||
                line.startsWith("*"))
                return;
            if (line.startsWith("interface ") ||
                line.startsWith("export default interface ")) {
                props = {};
                name = line;
                name = name.replace("export default ", "");
                name = name.replace("interface ", "");
                name = name.replace("{", "");
                name = name.trim();
                return;
            }
            if (line === "}") {
                if (name === "")
                    return;
                interfaces[name] = {
                    type: "object",
                    properties: props,
                    description: "Interface",
                };
                return;
            }
            let meta = "";
            if (index > 0) {
                meta = lines[index - 1];
            }
            const s = line.split(":");
            let field = s[0];
            let type = s[1];
            let notRequired = false;
            if (!field || !type)
                return;
            if (field.endsWith("?")) {
                field = field.replace("?", "");
                notRequired = true;
            }
            let en = this.getBetweenBrackets(meta, "enum");
            let example = this.getBetweenBrackets(meta, "example");
            let enums = [];
            if (example === "") {
                example = this.examples(field);
            }
            if (en !== "") {
                enums = en.split(",");
                example = enums[0];
            }
            field = field.trim();
            type = type.trim();
            if (this.options.snakeCase) {
                field = (0, change_case_1.snakeCase)(field);
            }
            let isArray = false;
            if (type.includes("[]")) {
                type = type.replace("[]", "");
                isArray = true;
            }
            let indicator = "type";
            if (!this.standardTypes.includes(type)) {
                indicator = "$ref";
                type = "#/components/schemas/" + type;
            }
            let prop = {};
            prop[indicator] = type;
            prop["example"] = example;
            if (isArray) {
                props[field] = { type: "array", items: prop };
            }
            else {
                props[field] = prop;
            }
            if (enums.length > 0) {
                props[field]["enum"] = enums;
            }
        });
        return interfaces;
    }
    parseModelProperties(data) {
        let props = {};
        // remove empty lines
        data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
        const lines = data.split("\n");
        let softDelete = false;
        lines.forEach((line, index) => {
            line = line.trim();
            // skip comments
            if (line.includes("@swagger-softdelete") ||
                line.includes("SoftDeletes")) {
                softDelete = true;
            }
            if (line.startsWith("//") ||
                line.startsWith("/*") ||
                line.startsWith("*"))
                return;
            if (index > 0 && lines[index - 1].includes("serializeAs: null"))
                return;
            if (index > 0 && lines[index - 1].includes("@no-swagger"))
                return;
            if (!line.startsWith("public ") && !line.startsWith("public get"))
                return;
            if (line.includes("(") && !line.startsWith("public get"))
                return;
            let s = line.split("public ");
            let s2 = s[1].replace(/;/g, "").split(":");
            if (line.startsWith("public get")) {
                s = line.split("public get");
                let s2 = s[1].replace(/;/g, "").split(":");
            }
            let field = s2[0];
            let type = s2[1];
            let enums = [];
            let format = "";
            let example = this.examples(field);
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
            //TODO: make oneOf
            if (type.includes(" | ")) {
                const types = type.split(" | ");
                type = types.filter((t) => t !== "null")[0];
            }
            field = field.replace("()", "");
            field = field.replace("get ", "");
            type = type.replace("{", "");
            if (this.options.snakeCase) {
                field = (0, change_case_1.snakeCase)(field);
            }
            let indicator = "type";
            if (example === null) {
                example = "string";
            }
            // if relation to another model
            if (type.includes("typeof")) {
                s = type.split("typeof ");
                type = "#/components/schemas/" + s[1].slice(0, -1);
                indicator = "$ref";
            }
            else {
                if (this.standardTypes.includes(type.toLowerCase())) {
                    type = type.toLowerCase();
                }
                else {
                    // assume its a custom interface
                    indicator = "$ref";
                    type = "#/components/schemas/" + type;
                }
            }
            type = type.trim();
            let isArray = false;
            if (line.includes("HasMany") ||
                line.includes("ManyToMany") ||
                line.includes("HasManyThrough") ||
                type.includes("[]")) {
                isArray = true;
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
            let prop = {};
            if (type === "integer" || type === "number") {
                if (example === null || example === "string") {
                    example = Math.floor(Math.random() * 1000);
                }
            }
            if (type === "boolean") {
                example = true;
            }
            prop[indicator] = type;
            prop["example"] = example;
            // if array
            if (isArray) {
                props[field] = { type: "array", items: prop };
            }
            else {
                props[field] = prop;
                if (format !== "") {
                    props[field]["format"] = format;
                }
            }
            if (enums.length > 0) {
                props[field]["enum"] = enums;
            }
        });
        if (softDelete) {
            props["deleted_at"] = {
                type: "string",
                format: "date-time",
                example: "2021-03-23T16:13:08.489+01:00",
            };
        }
        return props;
    }
    examples(field) {
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
    getFiles(dir, files_) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = require("fs");
            files_ = files_ || [];
            var files = yield fs.readdirSync(dir);
            for (let i in files) {
                var name = dir + "/" + files[i];
                if (fs.statSync(name).isDirectory()) {
                    this.getFiles(name, files_);
                }
                else {
                    files_.push(name);
                }
            }
            return files_;
        });
    }
}
exports.AutoSwagger = AutoSwagger;
