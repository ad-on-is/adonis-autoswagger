"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var YAML = require('json-to-pretty-yaml');
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
        var _this = this;
        routes = routes.root;
        this.modelPath = options.modelPath;
        // return routes
        var docs = {
            openapi: '3.0.0',
            info: {
                title: options.title,
                version: options.version,
            },
            components: {
                securitySchemes: {
                    ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'APIKEY' },
                },
                schemas: this.getSchemas(),
            },
            paths: {},
        };
        var paths = {};
        routes.forEach(function (route) {
            var methods = {};
            var parameters = [];
            var pattern = '';
            var tags = [];
            var security = [];
            var responseCodes = {
                GET: '200',
                POST: '201',
                DELETE: '201',
                PUT: '203',
            };
            if (route.middleware.length > 0 && route.middleware['auth:api'] !== null) {
                security = [{ ApiKeyAuth: ['write'] }];
            }
            if (route.meta.resolvedHandler !== null) {
                var customAnnotations = _this.getCustomAnnotations(route.meta.resolvedHandler.namespace);
                // console.log(file)
            }
            var split = route.pattern.split('/');
            if (split.length > 2) {
                tags = [split[2].toUpperCase()];
            }
            split.forEach(function (part) {
                if (part.startsWith(':')) {
                    var param = part.replace(':', '');
                    part = '{' + param + '}';
                    parameters.push({
                        in: 'path',
                        name: param,
                        schema: {
                            type: param === 'id' || param.endsWith('_id') ? 'integer' : 'string',
                        },
                        required: true,
                    });
                }
                pattern += '/' + part;
            });
            var sourceFile = typeof route.meta.resolvedHandler.namespace === 'undefined' ? '' : route.meta.resolvedHandler.namespace + '.' + route.meta.resolvedHandler.method;
            route.methods.forEach(function (method) {
                var responses = {
                    '404': { description: 'Not found' },
                };
                if (method === 'HEAD')
                    return;
                if (route.methods['PUT'] !== null && route.methods['PATCH'] !== null && method === 'PATCH')
                    return;
                responses[responseCodes[method]] = {
                    description: 'Some desc response',
                };
                methods[method.toLowerCase()] = {
                    summary: sourceFile,
                    description: 'Some description',
                    parameters: parameters,
                    tags: tags,
                    responses: responses,
                    security: security,
                };
            });
            pattern = pattern.slice(1);
            paths[pattern] = methods;
            docs.paths = paths;
        });
        return YAML.stringify(docs);
    };
    AutoSwagger.prototype.getCustomAnnotations = function (file) {
        if (typeof file === 'undefined')
            return;
        file = file.replace('App/', 'app/') + '.ts';
        var fs = require('fs');
        fs.readFile(file, 'utf8', function (err, data) {
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
        var _this = this;
        var schemas = {};
        var files = this.getFiles(this.modelPath, []);
        files.forEach(function (file) {
            console.log(file);
            // file = file.replace('.ts', '')
            var split = file.split('/');
            var name = split[split.length - 1].replace('.ts', '');
            file = file.replace('app/', '/app/');
            var model = require(file).default;
            var schema = { type: 'object', properties: _this.getProperties(model) };
            schemas[name] = schema;
        });
        return schemas;
    };
    AutoSwagger.prototype.getTypeofProperty = function (o, name) {
        return typeof o[name];
    };
    AutoSwagger.prototype.getProperties = function (model) {
        var props = {};
        model.$columnsDefinitions.forEach(function (col) {
            props[col.columnName] = {
                type: typeof col.meta !== 'undefined' ? col.meta.type : 'string',
            };
        });
        model.$computedDefinitions.forEach(function (col) {
            props[col.serializeAs] = {
                type: typeof col.meta !== 'undefined' ? col.meta.type : 'string',
            };
        });
        model.$relationsDefinitions.forEach(function (col) {
            props[col.relationName] =
                col.type === 'hasMany' || col.type === 'manyToMany' ? { type: 'array', items: { type: col.relatedModel().name } } : { type: col.relatedModel().name };
        });
        return props;
    };
    AutoSwagger.prototype.getFiles = function (dir, files_) {
        var fs = require('fs');
        files_ = files_ || [];
        var files = fs.readdirSync(dir);
        for (var i in files) {
            var name = dir + '/' + files[i];
            if (fs.statSync(name).isDirectory()) {
                this.getFiles(name, files_);
            }
            else {
                files_.push(name);
            }
        }
        return files_;
    };
    AutoSwagger.prototype.parseComment = function (comment) {
        // console.log(comment)
        return 'adfadf';
    };
    return AutoSwagger;
}());
exports.default = new AutoSwagger();
//# sourceMappingURL=index.js.map