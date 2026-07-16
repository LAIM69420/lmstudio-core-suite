import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchUrl, isSafePageUrl } from "../dist/searxng.js";

test("buildSearchUrl preserves hosted paths and filters", () => {
  const url = new URL(buildSearchUrl("https://example.test/searx/", {
    query: "LM Studio",
    safeSearch: "1",
    categories: "news",
    language: "en-US",
    extra: { time_range: "month" },
  }));
  assert.equal(url.pathname, "/searx/search");
  assert.equal(url.searchParams.get("q"), "LM Studio");
  assert.equal(url.searchParams.get("categories"), "news");
  assert.equal(url.searchParams.get("language"), "en-US");
  assert.equal(url.searchParams.get("time_range"), "month");
});

test("buildSearchUrl rejects non-HTTP servers", () => {
  assert.throws(() => buildSearchUrl("file:///tmp/search", {
    query: "test",
    safeSearch: "0",
  }), /HTTP or HTTPS/);
});

test("page fetching blocks local and unsafe targets", () => {
  assert.equal(isSafePageUrl("https://example.com/article"), true);
  assert.equal(isSafePageUrl("http://localhost:8080/private"), false);
  assert.equal(isSafePageUrl("http://127.0.0.1/private"), false);
  assert.equal(isSafePageUrl("http://192.168.1.5/private"), false);
  assert.equal(isSafePageUrl("file:///etc/passwd"), false);
});
