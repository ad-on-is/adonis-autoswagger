import HTTPStatusCode from "http-status-code";
import { isJSONString, getBetweenBrackets } from "./helpers";
import util from "util";
import extract from "extract-comments";
import fs from "fs";
import {
  camelCase,
  isEmpty,
  isUndefined,
  max,
  min,
  snakeCase,
  startCase,
} from "lodash";
import ExampleGenerator from "./example";
import type { options, AdonisRoutes, v6Handler } from "./types";
import { standardTypes } from "./types";
import _ from "lodash";
// @ts-expect-error moduleResolution:nodenext issue 54523
import { VineValidator } from "@vinejs/vine";

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
        ] = `Returns **${key}** (${HTTPStatusCode.getMessage(key)}) as **${Object.entries(responses[key]["content"])[0][0]
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
      required = false;
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
    let json = {},
      required = [];
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
      if (ref.required && Array.isArray(ref.required))
        required.push(...ref.required);
      Object.entries(ref.properties).map(([key, value]) => {
        if (typeof parsedRef[key] === "undefined") {
          return;
        }
        ks.push(key);
        if (value["required"]) required.push(key);
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
      for (let key in json) {
        if (json[key].required === "true") {
          required.push(key);
        }
      }
    }
    // No need to try/catch this JSON.parse as we already did that in the isJSONString function

    return {
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: json,
            required,
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
      const o = this.jsonToObj(json);
      return {
        content: {
          "application/json": {
            schema: {
              type: Array.isArray(json) ? "array" : "object",
              ...(Array.isArray(json) ? { items: this.arrayItems(json) } : o),
            },

            example: this.exampleGenerator.jsonToRef(json),
          },
        },
      };
    }
    return this.exampleGenerator.parseRef(line);
  }

  arrayItems(json) {
    const oneOf = [];

    const t = typeof json[0];

    if (t === "string") {
      json.forEach((j) => {
        const value = this.exampleGenerator.parseRef(j);

        if (_.has(value, "content.application/json.schema.$ref")) {
          oneOf.push({
            $ref: value["content"]["application/json"]["schema"]["$ref"],
          });
        }
      });
    }

    if (oneOf.length > 0) {
      return { oneOf: oneOf };
    }
    return { type: typeof json[0] };
  }

  jsonToObj(json) {
    const o = {
      type: "object",
      properties: Object.keys(json)
        .map((key) => {
          const t = typeof json[key];
          const v = json[key];
          let value = v;
          if (t === "object") {
            value = this.jsonToObj(json[key]);
          }
          if (t === "string" && v.includes("<") && v.includes(">")) {
            value = this.exampleGenerator.parseRef(v);
            if (v.includes("[]")) {
              let ref = "";
              if (_.has(value, "content.application/json.schema.$ref")) {
                ref = value["content"]["application/json"]["schema"]["$ref"];
              }
              if (_.has(value, "content.application/json.schema.items.$ref")) {
                ref =
                  value["content"]["application/json"]["schema"]["items"][
                  "$ref"
                  ];
              }
              value = {
                type: "array",
                items: {
                  $ref: ref,
                },
              };
            } else {
              value = {
                $ref: value["content"]["application/json"]["schema"]["$ref"],
              };
            }
          }
          return {
            [key]: value,
          };
        })
        .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
    };
    // console.dir(o, { depth: null });
    // console.log(json);
    return o;
  }

  async getAnnotations(file: string, action: string) {
    let annotations = {};
    let newdata = "";
    if (typeof file === "undefined") return;

    if (typeof this.parsedFiles[file] !== "undefined") {
      newdata = this.parsedFiles[file];
    } else {
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
    let required = [];
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
        line.startsWith("*") ||
        line.startsWith("public static ") ||
        line.startsWith("private static ") ||
        line.startsWith("static ")
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
      let type = s2[1] || "";
      type = type.trim();
      let enums = [];
      let format = "";
      let keyprops = {};
      let example: any = null;

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
          if (type === "number") {
            example = parseInt(m);
          }
        }
      }

      if (index > 0 && lines[index - 1].includes("@required")) {
        required.push(field);
      }

      if (index > 0 && lines[index - 1].includes("@props")) {
        const l = lines[index - 1].replace("@props", "props");
        const j = getBetweenBrackets(l, "props");
        if (isJSONString(j)) {
          keyprops = JSON.parse(j);
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
      if (example === null || example === "string") {
        example =
          this.exampleGenerator.exampleByField(field) ||
          this.exampleGenerator.exampleByType(type);
      }

      if (type === "datetime") {
        indicator = "type";
        type = "string";
        format = "date-time";
      }

      if (type === "date") {
        indicator = "type";
        type = "string";
        format = "date";
      }

      if (field === "email") {
        indicator = "type";
        type = "string";
        format = "email";
      }
      if (field === "password") {
        indicator = "type";
        type = "string";
        format = "password";
      }

      if (enums.length > 0) {
        indicator = "type";
        type = "string";
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
      Object.entries(keyprops).map(([key, value]) => {
        props[field][key] = value;
      });
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

    return { name: name, props: props, required: required };
  }
}

export class ValidatorParser {
  exampleGenerator: ExampleGenerator;
  constructor() {
    this.exampleGenerator = new ExampleGenerator({});
  }
  async validatorToObject(validator: VineValidator<any, any>) {
    // console.dir(validator.toJSON()["refs"], { depth: null });
    // console.dir(json, { depth: null });
    const obj = {
      type: "object",
      properties: this.parseSchema(
        validator.toJSON()["schema"]["schema"],
        validator.toJSON()["refs"]
      ),
    };
    // console.dir(obj, { depth: null });
    const testObj = this.objToTest(obj["properties"]);
    return await this.parsePropsAndMeta(obj, testObj, validator);
  }

  async parsePropsAndMeta(obj, testObj, validator: VineValidator<any, any>) {
    // console.log(Object.keys(errors));
    const { SimpleMessagesProvider } = await import("@vinejs/vine");
    const [e] = await validator.tryValidate(testObj, {
      messagesProvider: new SimpleMessagesProvider({
        required: "REQUIRED",
        string: "TYPE",
        object: "TYPE",
        number: "TYPE",
        boolean: "TYPE",
      }),
    });

    // if no errors, this means all object-fields are of type number (which we use by default)
    // and we can return the object
    if (e === null) {
      obj["example"] = testObj;
      return obj;
    }

    const msgs = e.messages;

    for (const m of msgs) {
      const err = m["message"];
      let objField = m["field"].replace(".", ".properties.");
      if (m["field"].includes(".0")) {
        objField = objField.replaceAll(`.0`, ".items");
      }
      if (err === "TYPE") {
        _.set(obj["properties"], objField, {
          ..._.get(obj["properties"], objField),
          type: m["rule"],
          example: this.exampleGenerator.exampleByType(m["rule"]),
        });
        if (m["rule"] === "string") {
          if (_.get(obj["properties"], objField)["minimum"]) {
            _.set(obj["properties"], objField, {
              ..._.get(obj["properties"], objField),
              minLength: _.get(obj["properties"], objField)["minimum"],
            });
            _.unset(obj["properties"], objField + ".minimum");
          }
          if (_.get(obj["properties"], objField)["maximum"]) {
            _.set(obj["properties"], objField, {
              ..._.get(obj["properties"], objField),
              maxLength: _.get(obj["properties"], objField)["maximum"],
            });
            _.unset(obj["properties"], objField + ".maximum");
          }
        }

        _.set(
          testObj,
          m["field"],
          this.exampleGenerator.exampleByType(m["rule"])
        );
      }

      if (err === "FORMAT") {
        _.set(obj["properties"], objField, {
          ..._.get(obj["properties"], objField),
          format: m["rule"],
          type: "string",
          example: this.exampleGenerator.exampleByValidatorRule(m["rule"]),
        });
        _.set(
          testObj,
          m["field"],
          this.exampleGenerator.exampleByValidatorRule(m["rule"])
        );
      }
    }

    // console.dir(obj, { depth: null });
    obj["example"] = testObj;
    return obj;
  }

  objToTest(obj) {
    const res = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key]["type"] === "object") {
        res[key] = this.objToTest(obj[key]["properties"]);
      } else if (obj[key]["type"] === "array") {
        if (obj[key]["items"]["type"] === "object") {
          res[key] = [this.objToTest(obj[key]["items"]["properties"])];
        } else {
          res[key] = [obj[key]["items"]["example"]];
        }
      } else {
        res[key] = obj[key]["example"];
      }
    });
    return res;
  }

  parseSchema(json, refs) {
    const obj = {};
    for (const p of json["properties"]) {
      let meta: {
        minimum?: number;
        maximum?: number;
        choices?: any;
        pattern?: string;
      } = {};
      for (const v of p["validations"]) {
        if (refs[v["ruleFnId"]].options?.min) {
          meta = { ...meta, minimum: refs[v["ruleFnId"]].options.min };
        }
        if (refs[v["ruleFnId"]].options?.max) {
          meta = { ...meta, maximum: refs[v["ruleFnId"]].options.max };
        }
        if (refs[v["ruleFnId"]].options?.choices) {
          meta = { ...meta, choices: refs[v["ruleFnId"]].options.choices };
        }
        if (refs[v["ruleFnId"]].options?.toString().includes("/")) {
          meta = { ...meta, pattern: refs[v["ruleFnId"]].options.toString() };
        }
      }

      // console.dir(p, { depth: null });
      // console.dir(validations, { depth: null });
      // console.log(min, max, choices, regex);

      obj[p["fieldName"]] =
        p["type"] === "object"
          ? { type: "object", properties: this.parseSchema(p, refs) }
          : p["type"] === "array"
            ? {
              type: "array",
              items:
                p["each"]["type"] === "object"
                  ? {
                    type: "object",
                    properties: this.parseSchema(p["each"], refs),
                  }
                  : {
                    type: "number",
                    example: meta.minimum
                      ? meta.minimum
                      : this.exampleGenerator.exampleByType("number"),
                    ...meta,
                  },
            }
            : {
              type: "number",
              example: meta.minimum
                ? meta.minimum
                : this.exampleGenerator.exampleByType("number"),
              ...meta,
            };
      if (!p["isOptional"]) obj[p["fieldName"]]["required"] = true;
    }
    return obj;
  }
}

export class InterfaceParser {
  exampleGenerator: ExampleGenerator;
  snakeCase: boolean;
  schemas: any = {};

  constructor(snakeCase: boolean, schemas: any = {}) {
    this.snakeCase = snakeCase;
    this.exampleGenerator = new ExampleGenerator({});
    this.schemas = schemas;
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

  getInheritedProperties(baseType: string): any {

    if (this.schemas[baseType]?.properties) {
      return {
        properties: this.schemas[baseType].properties,
        required: this.schemas[baseType].required || []
      };
    }

    const cleanType = baseType
      .split('/')
      .pop()
      ?.replace('.ts', '')
      ?.replace(/^[#@]/, '');

    if (!cleanType) return { properties: {}, required: [] };

    if (this.schemas[cleanType]?.properties) {
      return {
        properties: this.schemas[cleanType].properties,
        required: this.schemas[cleanType].required || []
      };
    }

    const variations = [
      cleanType,
      `#models/${cleanType}`,
      cleanType.replace(/Model$/, ''),
      `${cleanType}Model`
    ];

    for (const variation of variations) {
      if (this.schemas[variation]?.properties) {
        return {
          properties: this.schemas[variation].properties,
          required: this.schemas[variation].required || []
        };
      }
    }

    return { properties: {}, required: [] };
  }

  parseInterfaces(data) {
    data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");

    let currentInterface = null;
    const interfaces = {};
    const interfaceDefinitions = new Map();

    const lines = data.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isDefault = line.startsWith("export default interface")

      if (line.startsWith("interface") || line.startsWith("export interface") || isDefault) {
        const sp = line.split(/\s+/)
        const idx = line.endsWith("}") ? sp.length - 1 : sp.length - 2
        const name = sp[idx].split(/[{\s]/)[0];
        const extendedTypes = this.parseExtends(line);
        interfaceDefinitions.set(name, {
          extends: extendedTypes,
          properties: {},
          required: [],
          startLine: i
        });
        currentInterface = name;
        continue;
      }

      if (currentInterface && line === "}") {
        currentInterface = null;
        continue;
      }

      if (currentInterface && line && !line.startsWith("//") && !line.startsWith("/*") && !line.startsWith("*")) {
        const def = interfaceDefinitions.get(currentInterface);
        if (def) {
          const previousLine = i > 0 ? lines[i - 1].trim() : "";
          const isRequired = previousLine.includes("@required");

          const [prop, type] = line.split(":").map(s => s.trim());
          if (prop && type) {
            const cleanProp = prop.replace("?", "");
            def.properties[cleanProp] = type.replace(";", "");


            if (isRequired || !prop.includes("?")) {
              def.required.push(cleanProp);
            }
          }
        }
      }
    }

    for (const [name, def] of interfaceDefinitions) {
      let allProperties = {};
      let requiredFields = new Set(def.required);

      for (const baseType of def.extends) {
        const baseSchema = this.schemas[baseType];
        if (baseSchema) {
          if (baseSchema.properties) {
            Object.assign(allProperties, baseSchema.properties);
          }

          if (baseSchema.required) {
            baseSchema.required.forEach(field => requiredFields.add(field));
          }
        }
      }

      Object.assign(allProperties, def.properties);

      const parsedProperties = {};
      for (const [key, value] of Object.entries(allProperties)) {
        if (typeof value === 'object' && value !== null && 'type' in value) {
          parsedProperties[key] = value;
        } else {
          parsedProperties[key] = this.parseType(value, key);
        }
      }

      const schema = {
        type: "object",
        properties: parsedProperties,
        required: Array.from(requiredFields),
        description: `${name}${def.extends.length ? ` extends ${def.extends.join(", ")}` : ""} (Interface)`
      };

      if (schema.required.length === 0) {
        delete schema.required;
      }

      interfaces[name] = schema;
    }

    return interfaces;
  }

  parseExtends(line: string): string[] {
    const matches = line.match(/extends\s+([^{]+)/);
    if (!matches) return [];

    return matches[1]
      .split(",")
      .map(type => type.trim())
      .map(type => {
        const cleanType = type.split('/').pop();
        return cleanType?.replace(/\.ts$/, '') || type;
      });
  }

  parseType(type: string | any, field: string) {
    if (typeof type === 'object' && type !== null && 'type' in type) {
      return type;
    }

    let isArray = false;
    if (typeof type === 'string' && type.includes("[]")) {
      type = type.replace("[]", "");
      isArray = true;
    }

    if (typeof type === 'string') {
      type = type.replace(/[;\r\n]/g, '').trim();
    }

    let prop: any = { type: type };
    let notRequired = field.includes("?");
    prop.nullable = notRequired;

    if (typeof type === 'string' && type.toLowerCase() === "datetime") {
      prop.type = "string";
      prop.format = "date-time";
      prop.example = "2021-03-23T16:13:08.489+01:00";
    } else if (typeof type === 'string' && type.toLowerCase() === "date") {
      prop.type = "string";
      prop.format = "date";
      prop.example = "2021-03-23";
    } else {
      const standardTypes = ["string", "number", "boolean", "integer"];
      if (typeof type === 'string' && !standardTypes.includes(type.toLowerCase())) {
        delete prop.type;
        prop.$ref = `#/components/schemas/${type}`;
      } else {
        if (typeof type === 'string') {
          prop.type = type.toLowerCase();
        }
        prop.example = this.exampleGenerator.exampleByType(type) ||
          this.exampleGenerator.exampleByField(field);
      }
    }

    if (isArray) {
      return {
        type: "array",
        items: prop
      };
    }

    return prop;
  }
}

export class EnumParser {
  constructor() { }

  parseEnums(data: string): Record<string, any> {
    const enums: Record<string, any> = {};
    const lines = data.split("\n");
    let currentEnum: string | null = null;
    let description: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("//")) {
        description = trimmedLine.slice(2).trim();
        continue;
      }

      if (
        trimmedLine.startsWith("enum") ||
        trimmedLine.startsWith("export enum")
      ) {
        const match = trimmedLine.match(/(?:export\s+)?enum\s+(\w+)/);
        if (match) {
          currentEnum = match[1];
          enums[currentEnum] = {
            type: "string",
            enum: [],
            properties: {},
            description: description || `${startCase(currentEnum)} enumeration`,
          };
          description = null;
        }
        continue;
      }

      if (currentEnum && trimmedLine !== "{" && trimmedLine !== "}") {
        const [key, value] = trimmedLine.split("=").map((s) => s.trim());
        if (key) {
          const enumValue = value ? this.parseEnumValue(value) : key;
          enums[currentEnum].enum.push(enumValue);
        }
      }

      if (trimmedLine === "}") {
        currentEnum = null;
      }
    }


    return enums;
  }

  private parseEnumValue(value: string): string {
    // Remove quotes and comma
    return value.replace(/['",]/g, "").trim();
  }
}
