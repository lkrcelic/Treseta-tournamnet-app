import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {join, relative} from "node:path";
import {test} from "node:test";

// Every colour comes from _styles/tokens.ts (handoff §1): no hex or rgb()/hsl() values anywhere else in the app.

const APP = join(__dirname, "..", "..");
const SKIP = new Set(["_styles", "__tests__", "node_modules"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(e.name) ? [path] : [];
  });
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCTION = /\b(rgba?|hsla?)\(/;
// a # that is a link target or part of a URL or a word, not a colour: href="#top", "/page#add", "a#b".
// The attribute must be a whole word, so keys and names that merely end in one (grid, solid, avoid) are still checked.
const NOT_A_COLOUR = /(\b(href|src|url|id)\s*[=:(]\s*\{?\s*["'`]?|[\w/.?&=-])$/i;

function colourLiterals(source: string): {line: number; text: string}[] {
  const found: {line: number; text: string}[] = [];
  source.split("\n").forEach((text, i) => {
    const hex = Array.from(text.matchAll(HEX)).some((m) => !NOT_A_COLOUR.test(text.slice(0, m.index)));
    if (hex || FUNCTION.test(text)) found.push({line: i + 1, text: text.trim()});
  });
  return found;
}

test("the guard finds colours and ignores link targets", () => {
  assert.deepEqual(colourLiterals(`a\nsx={{color: "#FFFFFF"}}`).map((f) => f.line), [2]);
  assert.equal(colourLiterals(`border: "1px solid rgba(60,74,103,.2)"`).length, 1);
  assert.equal(colourLiterals("boxShadow: `0 0 0 2px #fff`").length, 1);
  assert.equal(colourLiterals(`<a href="#add">`).length, 0);
  assert.equal(colourLiterals(`router.push("/burza#face")`).length, 0);
  assert.equal(colourLiterals("label: `Stol #${n}`").length, 0);
  assert.equal(colourLiterals(`{href: "#add"}`).length, 0);
  for (const line of [`{to: "#fff"}`, `const avoid = "#fff"`, `grid: "#fff"`, `solid: "#abc"`, `{photo: "#ABCDEF"}`]) {
    assert.equal(colourLiterals(line).length, 1, line);
  }
});

test("no colour values outside _styles/", () => {
  const files = sourceFiles(APP);
  assert.ok(files.length > 100, `only ${files.length} source files found under ${APP}`);
  const offenders = files.flatMap((file) =>
    colourLiterals(readFileSync(file, "utf8")).map((f) => `src/app/${relative(APP, file)}:${f.line}  ${f.text}`)
  );
  assert.deepEqual(offenders, [], `use the tokens from _styles/tokens.ts instead of:\n${offenders.join("\n")}`);
});
