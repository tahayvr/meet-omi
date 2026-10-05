/* A JSON Schema validator for the part of JSON Schema (2020-12) that
   pack/omi.schema.json is written in, and no more: it throws on a keyword
   it doesn't know, so the schema can't say something this doesn't check.

     const problems = validate(schema, value);   // [] when the value fits
     // each: { at: "modes[3].pieces[0].w", message: "must be above 0" } */
const SAYS = new Set(["$schema", "$id", "$defs", "title", "description"]); // said, not checked
const KNOWN = new Set([
  "$ref",
  "type",
  "const",
  "enum",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "minLength",
  "pattern",
  "anyOf",
  "if",
  "then",
  "else",
]);

const isObject = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v),
  typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  show = (v) => JSON.stringify(v);

function validate(schema, value, root = schema, at = "", out = []) {
  const say = (message) => out.push({ at: at || "the pack", message });
  if (schema === true) return out;
  if (schema === false) {
    say("must not be there");
    return out;
  }
  for (const key of Object.keys(schema))
    if (!KNOWN.has(key) && !SAYS.has(key))
      throw new Error(
        `tools/schema.js doesn't know "${key}": teach it, or say it another way`,
      );

  if (schema.$ref) {
    const name = /^#\/\$defs\/(.+)$/.exec(schema.$ref);
    if (!name || !root.$defs || !root.$defs[name[1]])
      throw new Error(`tools/schema.js can't follow ${schema.$ref}`);
    validate(root.$defs[name[1]], value, root, at, out);
  }
  if (schema.type) {
    const got = typeOf(value),
      fits = (t) =>
        t === "integer"
          ? Number.isInteger(value)
          : t === "number"
            ? got === "number" && Number.isFinite(value)
            : got === t;
    if (![].concat(schema.type).some(fits)) {
      say(
        `must be ${/^[aeio]/.test(schema.type) ? "an" : "a"} ${[].concat(schema.type).join(" or ")}, and is ${show(value)}`,
      );
      return out; // nothing else about it makes sense
    }
  }
  if ("const" in schema && !same(value, schema.const))
    say(`must be ${show(schema.const)}, and is ${show(value)}`);
  if (schema.enum && !schema.enum.some((e) => same(e, value)))
    say(
      `must be one of ${schema.enum.map(show).join(", ")}, and is ${show(value)}`,
    );

  if (typeof value === "number") {
    if ("minimum" in schema && value < schema.minimum)
      say(`must be ${schema.minimum} or more, and is ${value}`);
    if ("maximum" in schema && value > schema.maximum)
      say(`must be ${schema.maximum} or less, and is ${value}`);
    if ("exclusiveMinimum" in schema && value <= schema.exclusiveMinimum)
      say(`must be above ${schema.exclusiveMinimum}, and is ${value}`);
  }
  if (typeof value === "string") {
    if ("minLength" in schema && value.length < schema.minLength)
      say(
        schema.minLength === 1
          ? "must not be empty"
          : `must be ${schema.minLength} characters or more`,
      );
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      say(`must look like ${schema.pattern}, and is ${show(value)}`);
  }
  if (Array.isArray(value)) {
    if ("minItems" in schema && value.length < schema.minItems)
      say(`must have ${schema.minItems} or more, and has ${value.length}`);
    if ("maxItems" in schema && value.length > schema.maxItems)
      say(`must have ${schema.maxItems} or fewer, and has ${value.length}`);
    if (
      schema.uniqueItems &&
      value.some((v, i) => value.findIndex((w) => same(v, w)) !== i)
    )
      say("must not have the same thing twice");
    const first = schema.prefixItems || [];
    value.forEach((v, i) => {
      if (i < first.length) validate(first[i], v, root, `${at}[${i}]`, out);
      else if ("items" in schema)
        validate(schema.items, v, root, `${at}[${i}]`, out);
    });
  }
  if (isObject(value)) {
    const known = schema.properties || {};
    for (const key of schema.required || [])
      if (!(key in value)) say(`has no ${key}`);
    for (const [key, v] of Object.entries(value)) {
      const where = at ? `${at}.${key}` : key;
      if (key in known) validate(known[key], v, root, where, out);
      else if ("additionalProperties" in schema) {
        if (schema.additionalProperties === false)
          out.push({ at: where, message: "is not part of the format" });
        else validate(schema.additionalProperties, v, root, where, out);
      }
    }
  }

  const fits = (s) => validate(s, value, root, at, []).length === 0;
  if (schema.anyOf && !schema.anyOf.some(fits))
    say(`is none of the things it may be: ${show(value)}`);
  if (schema.if) {
    const branch = fits(schema.if) ? schema.then : schema.else;
    if (branch !== undefined) validate(branch, value, root, at, out);
  }
  return out;
}

module.exports = { validate };
