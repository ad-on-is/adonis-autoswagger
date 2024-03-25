import HTTPStatusCode from "http-status-code";
import { isJSONString, getBetweenBrackets } from "./helpers";
import util from "util";
import extract from "extract-comments";
import fs from "fs";
import { camelCase, isEmpty, isUndefined, snakeCase, startCase } from "lodash";
import ExampleGenerator from "./example";
import type { options, AdonisRoutes, v6Handler } from "./types";
import { standardTypes } from "./types";

export class CommentParser {
  private parsedFiles: { [file: string]: string } = {};
  public exampleGenerator: ExampleGenerator;

  options: options;

  constructor(options: options) {
    this.options = options;
  }

  private parseAnnotations(lines: string[]) {
    let summary = "";
    let upload = "";
    let description = "";
    let operationId;
    let responses = {};
    let requestBody;
    let parameters = {};
    let headers = {};
    lines.forEach((line) => {
      if (line.startsWith("@summary")) {
        summary = line.replace("@summary ", "");
      }

      if (line.startsWith("@description")) {
        description = line.replace("@description ", "");
      }

      if (line.startsWith("@operationId")) {
        operationId = line.replace("@operationId ", "");
      }

      if (line.startsWith("@responseBody")) {
        responses = { ...responses, ...this.parseResponseBody(line) };
      }
      if (line.startsWith("@responseHeader")) {
        const header = this.parseResponseHeader(line);
        if (header === null) {
          console.error("Error with line: " + line);
          return;
        }
        headers[header["status"]] = {
          ...headers[header["status"]],
          ...header["header"],
        };
      }
      if (line.startsWith("@requestBody")) {
        requestBody = this.parseRequestBody(line);
      }
      if (line.startsWith("@requestFormDataBody")) {
        const parsedBody = this.parseRequestFormDataBody(line);
        if (parsedBody) {
          requestBody = parsedBody;
        }
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
      description,
      responses,
      requestBody,
      parameters,
      summary,
      operationId,
    };
  }

  private parseParam(line: string) {
    let where = "path";
    let required = true;
    let type = "string";
    let example: any = null;
    let enums = [];

    if (line.startsWith("@paramUse")) {
      let use = getBetweenBrackets(line, "paramUse");
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
      let en = getBetweenBrackets(meta, "enum");
      example = getBetweenBrackets(meta, "example");
      const mtype = getBetweenBrackets(meta, "type");
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

  private parseResponseHeader(responseLine: string) {
    let description = "";
    let example: any = "";
    let type = "string";
    let enums = [];
    const line = responseLine.replace("@responseHeader ", "");
    let [status, name, desc, meta] = line.split(" - ");

    if (typeof status === "undefined" || typeof name === "undefined") {
      return null;
    }

    if (typeof desc !== "undefined") {
      description = desc;
    }

    if (name.includes("@use")) {
      let use = getBetweenBrackets(name, "use");
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
      example = getBetweenBrackets(meta, "example");
      const mtype = getBetweenBrackets(meta, "type");
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

  private parseResponseBody(responseLine: string) {
    let responses = {};
    const line = responseLine.replace("@responseBody ", "");
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
          let j = JSON.parse("{" + json + "}");
          j = this.exampleGenerator.jsonToRef(j);
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
      if (typeof ref !== "undefined" && ref !== "") {
        const inc = getBetweenBrackets(res, "with");
        const exc = getBetweenBrackets(res, "exclude");
        const only = getBetweenBrackets(res, "only");
        const append = getBetweenBrackets(res, "append");
        let app = {};
        try {
          app = JSON.parse("{" + append + "}");
        } catch {}

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
                Object.assign(
                  this.exampleGenerator.getSchemaExampleBasedOnAnnotation(
                    ref,
                    inc,
                    exc,
                    only
                  ),
                  app
                ),
              ],
            },
          };
        } else {
          responses[status]["content"] = {
            "application/json": {
              schema: { $ref: "#/components/schemas/" + ref },
              example: Object.assign(
                this.exampleGenerator.getSchemaExampleBasedOnAnnotation(
                  ref,
                  inc,
                  exc,
                  only
                ),
                app
              ),
            },
          };
        }
        if (only !== "") {
          res += " **only containing** _" + only.replace(/,/g, ", ") + "_";
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
    // responses[status]['summary'] = sum
    return responses;
  }

  private parseRequestFormDataBody(rawLine: string) {
    const line = rawLine.replace("@requestFormDataBody ", "");

    const isJson = isJSONString(line);

    if (!isJson) {
      return;
    }

    // No need to try/catch this JSON.parse as we already did that in the isJSONString function
    const json = JSON.parse(line);

    return {
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: json,
          },
        },
      },
    };
  }

  private parseRequestBody(rawLine: string) {
    const line = rawLine.replace("@requestBody ", "");

    const isJson = isJSONString(line);

    if (isJson) {
      // No need to try/catch this JSON.parse as we already did that in the isJSONString function
      const json = JSON.parse(line);

      return {
        content: {
          "application/json": {
            schema: {
              type: "object",
            },
            example: this.exampleGenerator.jsonToRef(json),
          },
        },
      };
    }

    let rawRef = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));

    if (rawRef === "") {
      // No format valid, returning empty responseBody
      return;
    }

    const inc = getBetweenBrackets(line, "with");
    const exc = getBetweenBrackets(line, "exclude");
    const append = getBetweenBrackets(line, "append");
    const only = getBetweenBrackets(line, "only");

    let app = {};
    try {
      app = JSON.parse("{" + append + "}");
    } catch {}

    // references a schema array
    if (rawRef.includes("[]")) {
      const cleandRef = rawRef.replace("[]", "");

      return {
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: { $ref: "#/components/schemas/" + cleandRef },
            },
            example: [
              Object.assign(
                this.exampleGenerator.getSchemaExampleBasedOnAnnotation(
                  cleandRef,
                  inc,
                  exc,
                  only
                ),
                app
              ),
            ],
          },
        },
      };
    }

    return {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/" + rawRef,
          },
          example: Object.assign(
            this.exampleGenerator.getSchemaExampleBasedOnAnnotation(
              rawRef,
              inc,
              exc,
              only
            ),
            app
          ),
        },
      },
    };
  }

  async getAnnotations(file: string, action: string) {
    let annotations = {};
    let newdata = "";
    if (typeof file === "undefined") return;

    if (typeof this.parsedFiles[file] !== "undefined") {
      newdata = this.parsedFiles[file];
    } else {
      if (this.options.debug) {
        console.log(`Parsing comments: ${file}`);
      }
      const readFile = util.promisify(fs.readFile);
      const data = await readFile(file, "utf8");
      for (const line of data.split("\n")) {
        const l = line.trim();
        if (!l.startsWith("@")) {
          newdata += l + "\n";
        }
      }
      this.parsedFiles[file] = newdata;
    }

    const comments = extract(newdata);
    if (comments.length > 0) {
      comments.forEach((comment) => {
        if (comment.type !== "BlockComment") return;
        let lines = comment.value.split("\n").filter((l) => l != "");
        // fix for decorators
        if (lines[0].trim() !== "@" + action) return;
        lines = lines.filter((l) => l != "");

        annotations[action] = this.parseAnnotations(lines);
      });
    }
    return annotations;
  }
}

export class RouteParser {
  options: options;
  constructor(options: options) {
    this.options = options;
  }

  /*
    extract path-variables, tags and the uri-pattern
  */
  extractInfos(p: string) {
    let parameters = {};
    let pattern = "";
    let tags = [];
    let required: boolean;

    const split = p.split("/");
    if (split.length > this.options.tagIndex) {
      tags = [split[this.options.tagIndex].toUpperCase()];
    }
    split.forEach((part) => {
      if (part.startsWith(":")) {
        required = !part.endsWith("?");
        const param = part.replace(":", "").replace("?", "");
        part = "{" + param + "}";
        parameters = {
          ...parameters,
          [param]: {
            in: "path",
            name: param,
            schema: {
              type: "string",
            },
            required: required,
          },
        };
      }
      pattern += "/" + part;
    });
    if (pattern.endsWith("/")) {
      pattern = pattern.slice(0, -1);
    }
    return { tags, parameters, pattern };
  }
}

export class ModelParser {
  exampleGenerator: ExampleGenerator;
  snakeCase: boolean;
  constructor(snakeCase: boolean) {
    this.snakeCase = snakeCase;
    this.exampleGenerator = new ExampleGenerator({});
  }

  parseModelProperties(data) {
    let props = {};
    // remove empty lines
    data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
    const lines = data.split("\n");
    let softDelete = false;
    let name = "";
    lines.forEach((line, index) => {
      line = line.trim();
      // skip comments
      if (line.startsWith("export default class")) {
        name = line.split(" ")[3];
      }
      if (
        line.includes("@swagger-softdelete") ||
        line.includes("SoftDeletes")
      ) {
        softDelete = true;
      }
      if (
        line.startsWith("//") ||
        line.startsWith("/*") ||
        line.startsWith("*")
      )
        return;
      if (index > 0 && lines[index - 1].includes("serializeAs: null")) return;
      if (index > 0 && lines[index - 1].includes("@no-swagger")) return;
      if (
        !line.startsWith("public ") &&
        !line.startsWith("public get") &&
        !line.startsWith("declare ")
      )
        return;
      if (line.includes("(") && !line.startsWith("public get")) return;

      let s = [];

      if (line.startsWith("declare ")) {
        s = line.split("declare ");
      }
      if (line.startsWith("public ")) {
        if (line.startsWith("public get")) {
          s = line.split("public get");
          let s2 = s[1].replace(/;/g, "").split(":");
        } else {
          s = line.split("public ");
        }
      }

      let s2 = s[1].replace(/;/g, "").split(":");

      let field = s2[0];
      let type = s2[1];
      let enums = [];
      let format = "";
      let example: any = this.exampleGenerator.exampleByField(field);
      if (index > 0 && lines[index - 1].includes("@enum")) {
        const l = lines[index - 1];
        let en = getBetweenBrackets(l, "enum");
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
      type = type.replace("{", "").trim();

      if (this.snakeCase) {
        field = snakeCase(field);
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
      } else {
        if (standardTypes.includes(type.toLowerCase())) {
          type = type.toLowerCase();
        } else {
          // assume its a custom interface
          indicator = "$ref";
          type = "#/components/schemas/" + type;
        }
      }
      type = type.trim();
      let isArray = false;

      if (
        line.includes("HasMany") ||
        line.includes("ManyToMany") ||
        line.includes("HasManyThrough") ||
        type.includes("[]")
      ) {
        isArray = true;
        if (type.slice(type.length - 2, type.length) === "[]") {
          type = type.split("[]")[0];
        }
      }

      if (type === "datetime") {
        indicator = "type";
        type = "string";
        format = "date-time";
        example = "2021-03-23T16:13:08.489+01:00";
      }

      if (type === "date") {
        indicator = "type";
        type = "string";
        format = "date";
        example = "2021-03-23";
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

    if (softDelete) {
      props["deleted_at"] = {
        type: "string",
        format: "date-time",
        example: "2021-03-23T16:13:08.489+01:00",
      };
    }

    return { name: name, props: props };
  }
}

export class InterfaceParser {
  exampleGenerator: ExampleGenerator;
  snakeCase: boolean;
  constructor(snakeCase: boolean) {
    this.snakeCase = snakeCase;
    this.exampleGenerator = new ExampleGenerator({});
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

      if (
        line.startsWith("//") ||
        line.startsWith("/*") ||
        line.startsWith("*")
      )
        return;
      if (
        line.startsWith("interface ") ||
        line.startsWith("export default interface ") ||
        line.startsWith("export interface ")
      ) {
        props = {};
        name = line;
        name = name.replace("export default ", "");
        name = name.replace("export ", "");
        name = name.replace("interface ", "");
        name = name.replace("{", "");
        name = name.trim();
        return;
      }

      if (line === "}") {
        if (name === "") return;
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

      if (!field || !type) return;

      if (field.endsWith("?")) {
        field = field.replace("?", "");
        notRequired = true;
      }

      let en = getBetweenBrackets(meta, "enum");
      let example = getBetweenBrackets(meta, "example");
      let enums = [];
      if (example === "") {
        example = this.exampleGenerator.exampleByField(field);
      }
      if (en !== "") {
        enums = en.split(",");
        example = enums[0];
      }

      field = field.trim();
      type = type.trim();
      if (this.snakeCase) {
        field = snakeCase(field);
      }
      let isArray = false;
      if (type.includes("[]")) {
        type = type.replace("[]", "");
        isArray = true;
      }
      let indicator = "type";
      let prop = {};

      if (type.toLowerCase() === "datetime") {
        prop[indicator] = "string";
        prop["format"] = "date-time";
        prop["example"] = "2021-03-23T16:13:08.489+01:00";
        prop["nullable"] = notRequired;
      } else if (type.toLowerCase() === "date") {
        prop[indicator] = "string";
        prop["format"] = "date";
        prop["example"] = "2021-03-23";
        prop["nullable"] = notRequired;
      } else {
        if (!standardTypes.includes(type)) {
          indicator = "$ref";
          type = "#/components/schemas/" + type;
        }

        prop[indicator] = type;
        prop["example"] = example;
        prop["nullable"] = notRequired;
      }

      if (isArray) {
        props[field] = { type: "array", items: prop };
      } else {
        props[field] = prop;
      }
      if (enums.length > 0) {
        props[field]["enum"] = enums;
      }
    });

    return interfaces;
  }
}
