import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Card } from "../src/shared/components/elements/Card.tsx";

const render = props => renderToStaticMarkup(createElement(Card, props, "Card content"));

test("default card uses the subdued zinc surface and shared shell", () => {
    const html = render({});
    assert.match(html, /bg-zinc-900\/40/);
    assert.match(html, /border-zinc-700\/50/);
    assert.match(html, /class="border rounded-lg /);
    assert.match(html, /transition-colors backdrop-blur-sm pointer-events-auto/);
    assert.match(html, /Card content/);
});

test("card variants centralize neutral, empty and feedback surface colors", () => {
    const variants = {
        outer: ["bg-zinc-900/40", "border-zinc-700/50"],
        inner: ["bg-zinc-900/40", "border-zinc-700/50"],
        ghost: ["bg-zinc-900/30", "border-zinc-700/50"],
        empty: ["bg-zinc-900/30", "border-zinc-700/50", "border-dashed"],
        success: ["bg-emerald-950/20", "border-emerald-800/40"],
        info: ["bg-sky-950/20", "border-sky-800/40"],
        warning: ["bg-amber-950/20", "border-amber-800/40"],
        error: ["bg-red-950/30", "border-red-800/50"],
    };
    for (const [variant, classes] of Object.entries(variants)) {
        const html = render({ variant });
        for (const className of classes) assert.ok(html.includes(className), `${variant}: ${className}`);
        assert.match(html, /class="border rounded-lg /);
    }
});

test("cards preserve caller layout, accessibility attributes and refs", () => {
    const html = render({ variant: "info", className: "flex gap-2 p-3", role: "status",
        "aria-live": "polite", id: "transfer", ref: { current: null } });
    assert.match(html, /flex gap-2 p-3/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /id="transfer"/);
    assert.doesNotMatch(html, /variant="/);
});