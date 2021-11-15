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
const util = require("util");
const extract = require("extract-comments");
const HTTPStatusCode = require("http-status-code");
class AutoSwagger {
    constructor() {
        this.parsedFiles = [];
        this.tagIndex = 2;
    }
    ui(url) {
        return (`<!DOCTYPE html>
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
		</html>`);
    }
    docs(routes, options) {
        var routes_1, routes_1_1;
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function* () {
            routes = routes.root;
            this.path = options.path.replace("/start", "") + "/app";
            this.tagIndex = options.tagIndex;
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
                    models: yield this.getModels(),
                },
                paths: {},
            };
            let paths = {};
            try {
                for (routes_1 = __asyncValues(routes); routes_1_1 = yield routes_1.next(), !routes_1_1.done;) {
                    const route = routes_1_1.value;
                    if (options.ignore.includes(route.pattern))
                        continue;
                    let methods = {};
                    let security = [];
                    const responseCodes = {
                        GET: "200",
                        POST: "201",
                        DELETE: "200",
                        PUT: "203",
                    };
                    if (route.middleware.length > 0 &&
                        route.middleware["auth:api"] !== null) {
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
                                customAnnotations = yield this.getCustomAnnotations(sourceFile, action);
                            }
                        }
                    }
                    let { tags, parameters, pattern } = this.extractInfos(route.pattern);
                    route.methods.forEach((method) => {
                        let responses = {};
                        if (method === "HEAD")
                            return;
                        if (route.methods["PUT"] !== null &&
                            route.methods["PATCH"] !== null &&
                            method === "PATCH")
                            return;
                        let description = "initial desc";
                        responses[responseCodes[method]] = {
                            description: description,
                            content: {
                                "application/json": {},
                            },
                        };
                        if (security.length > 0) {
                            responses["401"] = {
                                description: HTTPStatusCode.getMessage(401),
                            };
                        }
                        if (action !== "" && typeof customAnnotations[action] !== "undefined") {
                            description = customAnnotations[action].description;
                            responses = customAnnotations[action].responses;
                        }
                        methods[method.toLowerCase()] = {
                            summary: sourceFile === "" && action == "" ? "" : sourceFile + "::" + action,
                            description: description,
                            parameters: parameters,
                            tags: tags,
                            responses: responses,
                            security: security,
                        };
                    });
                    pattern = pattern.slice(1);
                    paths[pattern] = methods;
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
        let description = "somedesc";
        let responses = {};
        lines.forEach((line) => {
            if (line.startsWith("@description")) {
                description = line.replace("@description ", "");
            }
            if (line.startsWith("@response")) {
                line = line.replace("@response ", "");
                let [s, d] = line.split(" - ");
                if (typeof s === "undefined")
                    return;
                responses[s] = {};
                if (typeof d === "undefined") {
                    d = HTTPStatusCode.getMessage(s);
                }
                else {
                    let ref = d.substring(d.indexOf("{") + 1, d.lastIndexOf("}"));
                    if (ref !== "") {
                        d = "Returns a single instance of type " + ref;
                        if (ref.includes("[]")) {
                            ref = ref.replace("[]", "");
                            d = "Returns an array of type " + ref;
                            responses[s]["content"] = {
                                "application/json": {
                                    schema: {
                                        type: "array",
                                        items: { $ref: "#/components/models/" + ref },
                                    },
                                },
                            };
                        }
                        else {
                            responses[s]["content"] = {
                                "application/json": {
                                    schema: { $ref: "#/components/models/" + ref },
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
        };
    }
    /*
      extract path-variables, tags and the uri-pattern
    */
    extractInfos(p) {
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
                        type: param === "id" || param.endsWith("_id") ? "integer" : "string",
                    },
                    required: true,
                });
            }
            pattern += "/" + part;
        });
        return { tags, parameters, pattern };
    }
    getModels() {
        return __awaiter(this, void 0, void 0, function* () {
            const models = {};
            const files = yield this.getFiles(this.path + "/Models", []);
            const readFile = util.promisify(fs.readFile);
            for (let file of files) {
                const data = yield readFile(file, "utf8");
                // this.parseProperties(data);
                file = file.replace(".ts", "");
                const split = file.split("/");
                const name = split[split.length - 1].replace(".ts", "");
                file = file.replace("app/", "/app/");
                // // const model = require(file).default;
                let schema = { type: "object", properties: this.parseProperties(data) };
                models[name] = schema;
            }
            return models;
        });
    }
    parseProperties(data) {
        let props = {};
        data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
        const lines = data.split("\n");
        lines.forEach((line) => {
            if (!line.startsWith("public ") && !line.startsWith("public get"))
                return;
            if (line.includes("(") && !line.startsWith("public get"))
                return;
            // if (line.includes("<")) return;
            let s = line.split("public ");
            let s2 = s[1].split(":");
            if (line.startsWith("public get")) {
                //   line = line.replace("()", "");
                //   line = line.slice(0, -1);
                s = line.split("public get");
                let s2 = s[1].split(":");
            }
            let propn = s2[0];
            let propv = s2[1];
            if (typeof propv === "undefined") {
                propv = "string";
            }
            propn = propn.trim();
            propv = propv.trim();
            propn = propn.replace("()", "");
            propn = propn.replace("get ", "");
            propv = propv.replace("{", "");
            let t = "type";
            if (propv.includes("typeof")) {
                s = propv.split("typeof ");
                propv = "#/components/models/" + s[1].slice(0, -1);
                t = "$ref";
            }
            else {
                propv = propv.toLowerCase();
            }
            propv = propv.replace("datetime", "string");
            propv = propv.replace("any", "string");
            propv = propv.trim();
            let prop = {};
            prop[t] = propv;
            if (line.includes("HasMany") || line.includes("ManyToMany")) {
                props[propn] = { type: "array", items: prop };
            }
            else {
                props[propn] = prop;
            }
        });
        return props;
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
