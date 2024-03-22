export function serializeV6Middleware(mw: any): string[] {
  return [...mw.all()].reduce<string[]>((result, one) => {
    if (typeof one === "function") {
      result.push(one.name || "closure");
      return result;
    }

    if ("name" in one && one.name) {
      result.push(one.name);
    }

    return result;
  }, []);
}

export async function serializeV6Handler(handler: any): Promise<any> {
  /**
   * Value is a controller reference
   */
  if ("reference" in handler) {
    return {
      type: "controller" as const,
      ...(await parseBindingReference(handler.reference)),
    };
  }

  /**
   * Value is an inline closure
   */
  return {
    type: "closure" as const,
    name: handler.name || "closure",
  };
}

export async function parseBindingReference(
  binding: string | [any | any, any]
): Promise<{ moduleNameOrPath: string; method: string }> {
  const parseImports = (await import("parse-imports")).default;
  /**
   * The binding reference is a magic string. It might not have method
   * name attached to it. Therefore we split the string and attempt
   * to find the method or use the default method name "handle".
   */
  if (typeof binding === "string") {
    const tokens = binding.split(".");
    if (tokens.length === 1) {
      return { moduleNameOrPath: binding, method: "handle" };
    }
    return { method: tokens.pop()!, moduleNameOrPath: tokens.join(".") };
  }

  const [bindingReference, method] = binding;

  /**
   * Parsing the binding reference for dynamic imports and using its
   * import value.
   */
  const imports = [...(await parseImports(bindingReference.toString()))];
  const importedModule = imports.find(
    ($import) => $import.isDynamicImport && $import.moduleSpecifier.value
  );
  if (importedModule) {
    return {
      moduleNameOrPath: importedModule.moduleSpecifier.value!,
      method: method || "handle",
    };
  }

  /**
   * Otherwise using the name of the binding reference.
   */
  return {
    moduleNameOrPath: bindingReference.name,
    method: method || "handle",
  };
}
