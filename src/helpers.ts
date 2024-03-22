/**
 * Check if a string is a valid JSON
 */

import { getSchemaExampleBasedOnAnnotation } from "./example";
export function isJSONString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}

export function getBetweenBrackets(value: string, start: string) {
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

export function mergeParams(initial, custom) {
  let merge = Object.assign(initial, custom);
  let params = [];
  for (const [key, value] of Object.entries(merge)) {
    params.push(value);
  }

  return params;
}

export function jsonToRef(json) {
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
        const inc = getBetweenBrackets(v, "with");
        const exc = getBetweenBrackets(v, "exclude");
        const append = getBetweenBrackets(v, "append");
        const only = getBetweenBrackets(v, "only");

        let app = {};
        try {
          app = JSON.parse("{" + append + "}");
        } catch {}

        // references a schema array
        if (ref.includes("[]")) {
          ref = ref.replace("[]", "");
          v = [
            Object.assign(
              getSchemaExampleBasedOnAnnotation(ref, inc, exc, only),
              app
            ),
          ].reduce((a) => a);
        } else {
          v = Object.assign(
            getSchemaExampleBasedOnAnnotation(ref, inc, exc, only),
            app
          );
        }
      }
    }
    out[k] = v;
  }
  return out;
}
