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
    let tag = "";
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
      if (line.startsWith("@tag")) {
        tag = line.replace("@tag ", "");
      }

      if (line.startsWith("@description")) {
        description = line.replace("@description ", "");
      }

      if (line.startsWith("@operationId")) {
        operationId = line.replace("@operationId ", "");
      }

      if (line.startsWith("@responseBody")) {
        responses = {
          ...responses,
          ...this.parseResponseBody(line),
        };
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
        requestBody = this.parseBody(line, "requestBody");
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
      if (!responses[key]["description"]) {
        responses[key][
          "description"
        ] = `Returns **${key}** (${HTTPStatusCode.getMessage(key)}) as **${
          Object.entries(responses[key]["content"])[0][0]
        }**`;
      }
    }

    return {
      description,
      responses,
      requestBody,
      parameters,
      summary,
      operationId,
      tag,
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
    let [status, res, desc] = line.split(" - ");
    if (typeof status === "undefined") return;
    responses[status] = this.parseBody(res, "responseBody");
    responses[status]["description"] = desc;
    return responses;
  }

  private parseRequestFormDataBody(rawLine: string) {
    const line = rawLine.replace("@requestFormDataBody ", "");
    let json = {};
    const isJson = isJSONString(line);
    if (!isJson) {
      // try to get json from reference
      let rawRef = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));

      const cleandRef = rawRef.replace("[]", "");
      if (cleandRef === "") {
        return;
      }
      const parsedRef = this.exampleGenerator.parseRef(line, true);
      let props = [];
      const ref = this.exampleGenerator.schemas[cleandRef];
      const ks = [];
      Object.entries(ref.properties).map(([key, value]) => {
        if (typeof parsedRef[key] === "undefined") {
          return;
        }
        ks.push(key);
        props.push({
          [key]: {
            type:
              typeof value["type"] === "undefined" ? "string" : value["type"],
            format:
              typeof value["format"] === "undefined"
                ? "string"
                : value["format"],
          },
        });
      });
      const p = props.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      const appends = Object.keys(parsedRef).filter((k) => !ks.includes(k));
      json = p;
      if (appends.length > 0) {
        appends.forEach((a) => {
          json[a] = parsedRef[a];
        });
      }
    } else {
      json = JSON.parse(line);
    }
    // No need to try/catch this JSON.parse as we already did that in the isJSONString function

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

  private parseBody(rawLine: string, type: string) {
    let line = rawLine.replace(`@${type} `, "");

    const isJson = isJSONString(line);

    if (isJson) {
      // No need to try/catch this JSON.parse as we already did that in the isJSONString function
      const json = JSON.parse(line);

      return {
        content: {
          "application/json": {
            schema: {
              type: Array.isArray(json) ? "array" : "object",
              ...(Array.isArray(json)
                ? { items: { type: typeof json[0] } }
                : {}),
            },

            example: this.exampleGenerator.jsonToRef(json),
          },
        },
      };
    }
    return this.exampleGenerator.parseRef(line);
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
        !line.includes("declare ")
      )
        return;
      
      let s = [];

      if (line.includes("declare ")) {
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

      if (index > 0 && lines[index - 1].includes("@format")) {
        const l = lines[index - 1];
        let en = getBetweenBrackets(l, "format");
        if (en !== "") {
          format = en;
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

  objToExample(obj) {
    let example = {};
    Object.entries(obj).map(([key, value]) => {
      if (typeof value === "object") {
        example[key] = this.objToExample(value);
      } else {
        example[key] = this.exampleGenerator.exampleByType(value as string);
        if (example[key] === null) {
          example[key] = this.exampleGenerator.exampleByField(key);
        }
      }
    });
    return example;
  }

  ifToJson(data) {}

  parseProps(obj) {
    const no = {};
    Object.entries(obj).map(([f, value]) => {
      if (typeof value === "object") {
        no[f.replaceAll("?", "")] = {
          type: "object",
          nullable: f.includes("?"),
          properties: this.parseProps(value),
          example: this.objToExample(value),
        };
      } else {
        no[f.replaceAll("?", "")] = {
          ...this.parseType(value, f),
        };
      }
    });
    return no;
  }

  parseType(type, field) {
    let isArray = false;
    if (type.includes("[]")) {
      type = type.replace("[]", "");
      isArray = true;
    }
    let prop: any = { type: type };
    let meta = "";
    let en = getBetweenBrackets(meta, "enum");
    let example = getBetweenBrackets(meta, "example");
    let enums = [];
    if (example === "") {
      example = this.exampleGenerator.exampleByField(field);
    }

    if (example === null) {
      example = this.exampleGenerator.exampleByType(type);
    }

    if (en !== "") {
      enums = en.split(",");
      example = enums[0];
    }
    let indicator = "type";
    let notRequired = field.includes("?");

    prop["nullable"] = notRequired;
    if (type.toLowerCase() === "datetime") {
      prop[indicator] = "string";
      prop["format"] = "date-time";
      prop["example"] = "2021-03-23T16:13:08.489+01:00";
    } else if (type.toLowerCase() === "date") {
      prop[indicator] = "string";
      prop["format"] = "date";
      prop["example"] = "2021-03-23";
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
      prop = { type: "array", items: prop };
    }
    return prop;
  }

  parseInterfaces(data) {
    // remove empty lines
    data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");

    let name = "";
    let props = {};
    const l = data.split("\n");
    let ifs = {};
    l.forEach((line, index) => {
      if (
        line.startsWith("//") ||
        line.startsWith("/*") ||
        line.startsWith("import") ||
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
        name = name.replace("export default interface ", "");
        name = name.replace("export interface ", "");
        name = name.replace("export ", "");
        name = name.replace("interface ", "");
        name = name.replace("{", "");
        name = name.trim();
        ifs[name] = "{";
        return;
      }

      let nl = line;

      let [f, t] = line.split(": ");
      if (f && t) {
        if (f.startsWith("'") && f.endsWith("'")) {
          f = f.replaceAll("'", '"');
        }
        if (!f.startsWith('"') && !f.endsWith('"')) {
          f = `"${f}"`;
        }

        let comma = "";
        if (!t.endsWith("{")) {
          if (l[index + 1] !== "}") {
            comma = ",";
          }
          t = `"${t}"`;
        }
        nl = `${f}: ${t}${comma}`;
      }
      ifs[name] += nl;
    });

    for (const [n, value] of Object.entries(ifs)) {
      try {
        let j = JSON.parse(value as string);
        ifs[n] = {
          type: "object",
          properties: this.parseProps(j),
          description: n + " (Interface)",
        };
      } catch (e) {
        ifs[n] = {};
      }
    }
    const cleaned = {};
    Object.entries(ifs).map(([key, value]) => {
      if (key !== "") {
        cleaned[key] = value;
      }
    });
    return cleaned;
  }
}
