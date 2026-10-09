import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

// Run the existing TypeScript directly with Node's built-in test runner, no new dependencies.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith(".") && context.parentURL) {
            const url = new URL(specifier, context.parentURL);
            for (const extension of [".ts", ".tsx"]) {
                if (existsSync(new URL(url.href + extension))) {
                    return { url: url.href + extension, shortCircuit: true };
                }
            }
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (/\.tsx?$/.test(url)) {
            const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
                compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
                    jsx: ts.JsxEmit.ReactJSX },
                fileName: new URL(url).pathname,
            }).outputText;
            return { format: "module", source, shortCircuit: true };
        }
        return nextLoad(url, context);
    },
});