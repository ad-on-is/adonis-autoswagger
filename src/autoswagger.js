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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var YAML = require("json-to-pretty-yaml");
var fs = require("fs");
var util = require("util");
// const extract = require("extract-comments");
var AutoSwagger = /** @class */ (function () {
    function AutoSwagger() {
    }
    AutoSwagger.prototype.ui = function (url) {
        return ("<!DOCTYPE html>\n\t\t<html lang=\"en\">\n\t\t<head>\n\t\t\t\t<meta charset=\"UTF-8\">\n\t\t\t\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n\t\t\t\t<meta http-equiv=\"X-UA-Compatible\" content=\"ie=edge\">\n\t\t\t\t<script src=\"//unpkg.com/swagger-ui-dist@3/swagger-ui-standalone-preset.js\"></script>\n\t\t\t\t<!-- <script src=\"https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-standalone-preset.js\"></script> -->\n\t\t\t\t<script src=\"//unpkg.com/swagger-ui-dist@3/swagger-ui-bundle.js\"></script>\n\t\t\t\t<!-- <script src=\"https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-bundle.js\"></script> -->\n\t\t\t\t<link rel=\"stylesheet\" href=\"//unpkg.com/swagger-ui-dist@3/swagger-ui.css\" />\n\t\t\t\t<!-- <link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui.css\" /> -->\n\t\t\t\t<title>Swagger</title>\n\t\t</head>\n\t\t<body>\n\t\t\t\t<div id=\"swagger-ui\"></div>\n\t\t\t\t<script>\n\t\t\t\t\t\twindow.onload = function() {\n\t\t\t\t\t\t\tSwaggerUIBundle({\n\t\t\t\t\t\t\t\turl: \"" +
            url +
            "\",\n\t\t\t\t\t\t\t\tdom_id: '#swagger-ui',\n\t\t\t\t\t\t\t\tpresets: [\n\t\t\t\t\t\t\t\t\tSwaggerUIBundle.presets.apis,\n\t\t\t\t\t\t\t\t\tSwaggerUIStandalonePreset\n\t\t\t\t\t\t\t\t],\n\t\t\t\t\t\t\t\tlayout: \"BaseLayout\"\n\t\t\t\t\t\t\t})\n\t\t\t\t\t\t}\n\t\t\t\t</script>\n\t\t</body>\n\t\t</html>");
    };
    AutoSwagger.prototype.docs = function (routes, options) {
        return __awaiter(this, void 0, void 0, function () {
            var docs, paths;
            var _a, _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        routes = routes.root;
                        this.modelPath = options.modelPath;
                        _a = {
                            openapi: "3.0.0",
                            info: {
                                title: options.title,
                                version: options.version
                            }
                        };
                        _b = {
                            responses: {
                                UnauthorizedError: {
                                    description: "Acces token is missing or invalid"
                                }
                            },
                            securitySchemes: {
                                BearerAuth: {
                                    type: "http",
                                    scheme: "bearer"
                                }
                            }
                        };
                        return [4 /*yield*/, this.getSchemas()];
                    case 1:
                        docs = (_a.components = (_b.schemas = _c.sent(),
                            _b),
                            _a.paths = {},
                            _a);
                        paths = {};
                        routes.forEach(function (route) {
                            var methods = {};
                            var parameters = [];
                            var pattern = "";
                            var tags = [];
                            var security = [];
                            var responseCodes = {
                                GET: "200",
                                POST: "201",
                                DELETE: "201",
                                PUT: "203"
                            };
                            if (route.middleware.length > 0 &&
                                route.middleware["auth:api"] !== null) {
                                security = [{ BearerAuth: ["write"] }];
                            }
                            if (route.meta.resolvedHandler !== null) {
                                var customAnnotations = _this.getCustomAnnotations(route.meta.resolvedHandler.namespace);
                                // console.log(file)
                            }
                            var split = route.pattern.split("/");
                            if (split.length > 2) {
                                tags = [split[2].toUpperCase()];
                            }
                            split.forEach(function (part) {
                                if (part.startsWith(":")) {
                                    var param = part.replace(":", "");
                                    part = "{" + param + "}";
                                    parameters.push({
                                        "in": "path",
                                        name: param,
                                        schema: {
                                            type: param === "id" || param.endsWith("_id") ? "integer" : "string"
                                        },
                                        required: true
                                    });
                                }
                                pattern += "/" + part;
                            });
                            var sourceFile = typeof route.meta.resolvedHandler.namespace === "undefined"
                                ? ""
                                : route.meta.resolvedHandler.namespace +
                                    "." +
                                    route.meta.resolvedHandler.method;
                            route.methods.forEach(function (method) {
                                var responses = {
                                    "404": { description: "Not found" }
                                };
                                if (method === "HEAD")
                                    return;
                                if (route.methods["PUT"] !== null &&
                                    route.methods["PATCH"] !== null &&
                                    method === "PATCH")
                                    return;
                                responses[responseCodes[method]] = {
                                    description: "Some desc response"
                                };
                                methods[method.toLowerCase()] = {
                                    summary: sourceFile,
                                    description: "Some description",
                                    parameters: parameters,
                                    tags: tags,
                                    responses: responses,
                                    security: security
                                };
                            });
                            pattern = pattern.slice(1);
                            paths[pattern] = methods;
                            docs.paths = paths;
                        });
                        return [2 /*return*/, YAML.stringify(docs)];
                }
            });
        });
    };
    AutoSwagger.prototype.getCustomAnnotations = function (file) {
        if (typeof file === "undefined")
            return;
        file = file.replace("App/", "app/") + ".ts";
        fs.readFile(file, "utf8", function (err, data) {
            if (err) {
                console.error(err);
                return;
            }
            // console.log(file)
            // const comments = extract(data);
            // if (comments.length > 0) {
            //   let comment = comments[0];
            //   if (comment.type !== "BlockComment") return;
            //   // comment.replace('\\n', '')
            //   // comment.replace('\t', '')
            //   console.log(this.parseComment(comment));
            // }
            // comments.foreach((comment) => {
            // console.log(comment.length)
            // })
            // console.log(comments)
        });
        // console.log(file)
    };
    AutoSwagger.prototype.getSchemas = function () {
        return __awaiter(this, void 0, void 0, function () {
            var schemas, files, readFile, _i, files_1, file, data, split, name_1, schema;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        schemas = {};
                        return [4 /*yield*/, this.getFiles(this.modelPath, [])];
                    case 1:
                        files = _a.sent();
                        readFile = util.promisify(fs.readFile);
                        _i = 0, files_1 = files;
                        _a.label = 2;
                    case 2:
                        if (!(_i < files_1.length)) return [3 /*break*/, 5];
                        file = files_1[_i];
                        return [4 /*yield*/, readFile(file, "utf8")];
                    case 3:
                        data = _a.sent();
                        // this.parseProperties(data);
                        file = file.replace(".ts", "");
                        split = file.split("/");
                        name_1 = split[split.length - 1].replace(".ts", "");
                        file = file.replace("app/", "/app/");
                        schema = { type: "object", properties: this.parseProperties(data) };
                        schemas[name_1] = schema;
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, schemas];
                }
            });
        });
    };
    AutoSwagger.prototype.parseProperties = function (data) {
        var props = {};
        data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
        var lines = data.split("\n");
        lines.forEach(function (line) {
            if (!line.startsWith("public ") && !line.startsWith("public get"))
                return;
            if (line.includes("(") && !line.startsWith("public get"))
                return;
            // if (line.includes("<")) return;
            var s = line.split("public ");
            var s2 = s[1].split(":");
            if (line.startsWith("public get")) {
                //   line = line.replace("()", "");
                //   line = line.slice(0, -1);
                s = line.split("public get");
                var s2_1 = s[1].split(":");
            }
            var propn = s2[0];
            var propv = s2[1];
            if (typeof propv === "undefined") {
                propv = "string";
            }
            propn = propn.trim();
            propv = propv.trim();
            propn = propn.replace("()", "");
            propn = propn.replace("get ", "");
            propv = propv.replace("{", "");
            var t = "type";
            if (propv.includes("typeof")) {
                s = propv.split("typeof ");
                propv = "#/components/schemas/" + s[1].slice(0, -1);
                t = "$ref";
            }
            else {
                propv = propv.toLowerCase();
            }
            propv = propv.replace("datetime", "string");
            propv = propv.replace("any", "string");
            propv = propv.trim();
            var prop = {};
            prop[t] = propv;
            if (line.includes("HasMany") || line.includes("ManyToMany")) {
                props[propn] = { type: "array", items: prop };
            }
            else {
                props[propn] = prop;
            }
        });
        return props;
    };
    AutoSwagger.prototype.getFiles = function (dir, files_) {
        return __awaiter(this, void 0, void 0, function () {
            var fs, files, i, name;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fs = require("fs");
                        files_ = files_ || [];
                        return [4 /*yield*/, fs.readdirSync(dir)];
                    case 1:
                        files = _a.sent();
                        for (i in files) {
                            name = dir + "/" + files[i];
                            if (fs.statSync(name).isDirectory()) {
                                this.getFiles(name, files_);
                            }
                            else {
                                files_.push(name);
                            }
                        }
                        return [2 /*return*/, files_];
                }
            });
        });
    };
    AutoSwagger.prototype.parseComment = function (comment) {
        // console.log(comment)
        return "adfadf";
    };
    return AutoSwagger;
}());
exports["default"] = AutoSwagger;
