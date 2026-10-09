import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressBar } from "../src/shared/components/primitives/ProgressBar.tsx";

const render = props => renderToStaticMarkup(createElement(ProgressBar, props));

test("progress bar renders proportional width, app styling and accessible values", () => {
    const html = render({ value: 240, max: 960, "aria-label": "Download", className: "h-1.5" });
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-label="Download"/);
    assert.match(html, /aria-valuemin="0"/);
    assert.match(html, /aria-valuemax="960"/);
    assert.match(html, /aria-valuenow="240"/);
    assert.match(html, /width:25%/);
    assert.match(html, /bg-zinc-900\/60/);
    assert.match(html, /border-zinc-700\/60/);
    assert.match(html, /rounded-lg/);
    assert.match(html, /bg-sky-400\/80/);
    assert.match(html, /h-1\.5/);
});

test("determinate zero, complete and out-of-range values are clamped", () => {
    for (const [value, expected] of [[0, 0], [-10, 0], [100, 100], [150, 100]]) {
        const html = render({ value });
        assert.match(html, new RegExp(`aria-valuenow="${expected}"`));
        assert.match(html, new RegExp(`width:${expected}%`));
        assert.doesNotMatch(html, /animate-pulse/);
    }
});

test("unknown/nonfinite progress is indeterminate and respects reduced motion", () => {
    for (const value of [undefined, NaN, Infinity]) {
        const html = render({ value, max: 960 });
        assert.doesNotMatch(html, /aria-valuenow/);
        assert.doesNotMatch(html, /width:/);
        assert.match(html, /animate-pulse/);
        assert.match(html, /motion-reduce:animate-none/);
    }
});

test("invalid maxima use a safe default without invalid CSS or ARIA values", () => {
    for (const max of [0, -1, NaN, Infinity]) {
        const html = render({ value: 50, max });
        assert.match(html, /aria-valuemax="100"/);
        assert.match(html, /width:50%/);
        assert.doesNotMatch(html, /NaN|Infinity/);
    }
});

test("all tones, refs and native attributes are supported", () => {
    for (const [tone, color] of Object.entries({ neutral: "zinc-500", info: "sky-400",
        ok: "emerald-400", warn: "amber-400", danger: "red-400" })) {
        const html = render({ value: 25, tone, id: "transfer-progress", title: "Transfer", ref: { current: null } });
        assert.match(html, new RegExp(`bg-${color}/80`));
        assert.match(html, /id="transfer-progress"/);
        assert.match(html, /title="Transfer"/);
    }
});