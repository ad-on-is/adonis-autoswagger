const YAML = require("json-to-pretty-yaml");
const fs = require("fs");
const util = require("util");
// const extract = require("extract-comments");

class AutoSwagger {
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

  public async docs(routes, options) {
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
        responses: {
          UnauthorizedError: {
            description: "Acces token is missing or invalid",
          },
        },
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
        schemas: await this.getSchemas(),
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
        security = [{ BearerAuth: ["write"] }];
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

  private async getSchemas() {
    const schemas = {};
    const files = await this.getFiles(this.modelPath, []);
    const readFile = util.promisify(fs.readFile);
    for (let file of files) {
      const data = await readFile(file, "utf8");
      // this.parseProperties(data);
      file = file.replace(".ts", "");
      const split = file.split("/");
      const name = split[split.length - 1].replace(".ts", "");
      file = file.replace("app/", "/app/");
      // // const model = require(file).default;
      let schema = { type: "object", properties: this.parseProperties(data) };
      schemas[name] = schema;
    }

    return schemas;
  }

  private parseProperties(data) {
    let props = {};
    data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
    const lines = data.split("\n");

    lines.forEach((line) => {
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
        propv = "#/components/schemas/" + s[1].slice(0, -1);
        t = "$ref";
      } else {
        propv = propv.toLowerCase();
      }

      propv = propv.replace("datetime", "string");
      propv = propv.replace("any", "string");
      propv = propv.trim();

      let prop = {};
      prop[t] = propv;
      if (line.includes("HasMany") || line.includes("ManyToMany")) {
        props[propn] = { type: "array", items: prop };
      } else {
        props[propn] = prop;
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

  private parseComment(comment: string) {
    // console.log(comment)
    return "adfadf";
  }
}

export default new AutoSwagger();
