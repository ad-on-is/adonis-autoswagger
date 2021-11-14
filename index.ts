const YAML = require("json-to-pretty-yaml");
// const extract = require("extract-comments");

class Adonis5AutoSwagger {
  public modelPath: string;

  public ui(url: string) {
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

  public docs(routes, options) {
    routes = routes.root;
    this.modelPath = options.modelPath;
    // return routes
    const docs = {
      openapi: "3.0.0",
      info: {
        title: options.title,
        version: options.version,
      },

      components: {
        securitySchemes: {
          ApiKeyAuth: { type: "apiKey", in: "header", name: "APIKEY" },
        },
        schemas: this.getSchemas(),
      },
      paths: {},
    };
    let paths = {};

    routes.forEach((route) => {
      let methods = {};
      let parameters = [];
      let pattern = "";
      let tags = [];
      let security = [];
      const responseCodes = {
        GET: "200",
        POST: "201",
        DELETE: "201",
        PUT: "203",
      };
      if (
        route.middleware.length > 0 &&
        route.middleware["auth:api"] !== null
      ) {
        security = [{ ApiKeyAuth: ["write"] }];
      }

      if (route.meta.resolvedHandler !== null) {
        const customAnnotations = this.getCustomAnnotations(
          route.meta.resolvedHandler.namespace
        );
        // console.log(file)
      }

      const split = route.pattern.split("/");
      if (split.length > 2) {
        tags = [split[2].toUpperCase()];
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

      const sourceFile =
        typeof route.meta.resolvedHandler.namespace === "undefined"
          ? ""
          : route.meta.resolvedHandler.namespace +
            "." +
            route.meta.resolvedHandler.method;

      route.methods.forEach((method) => {
        let responses = {
          "404": { description: "Not found" },
        };
        if (method === "HEAD") return;
        if (
          route.methods["PUT"] !== null &&
          route.methods["PATCH"] !== null &&
          method === "PATCH"
        )
          return;
        responses[responseCodes[method]] = {
          description: "Some desc response",
        };
        methods[method.toLowerCase()] = {
          summary: sourceFile,
          description: "Some description",
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
  }

  private getCustomAnnotations(file: string) {
    if (typeof file === "undefined") return;
    file = file.replace("App/", "app/") + ".ts";
    const fs = require("fs");
    fs.readFile(file, "utf8", (err, data) => {
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
  }

  private getSchemas() {
    const schemas = {};
    const files = this.getFiles(this.modelPath, []);
    files.forEach((file) => {
      console.log(file);
      // file = file.replace('.ts', '')
      const split = file.split("/");
      const name = split[split.length - 1].replace(".ts", "");
      file = file.replace("app/", "/app/");
      const model = require(file).default;
      let schema = { type: "object", properties: this.getProperties(model) };
      schemas[name] = schema;
    });
    return schemas;
  }

  private getTypeofProperty<T, K extends keyof T>(o: T, name: K) {
    return typeof o[name];
  }

  private getProperties(model) {
    let props = {};
    model.$columnsDefinitions.forEach((col) => {
      props[col.columnName] = {
        type: typeof col.meta !== "undefined" ? col.meta.type : "string",
      };
    });
    model.$computedDefinitions.forEach((col) => {
      props[col.serializeAs] = {
        type: typeof col.meta !== "undefined" ? col.meta.type : "string",
      };
    });

    model.$relationsDefinitions.forEach((col) => {
      props[col.relationName] =
        col.type === "hasMany" || col.type === "manyToMany"
          ? { type: "array", items: { type: col.relatedModel().name } }
          : { type: col.relatedModel().name };
    });
    return props;
  }

  private getFiles(dir, files_) {
    const fs = require("fs");
    files_ = files_ || [];
    var files = fs.readdirSync(dir);
    for (var i in files) {
      var name = dir + "/" + files[i];
      if (fs.statSync(name).isDirectory()) {
        this.getFiles(name, files_);
      } else {
        files_.push(name);
      }
    }
    return files_;
  }

  private parseComment(comment: string) {
    // console.log(comment)
    return "adfadf";
  }
}

export = new Adonis5AutoSwagger();
