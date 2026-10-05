import test from "node:test";
import assert from "node:assert/strict";
import {
  isServerFunctionRequest,
  unexpectedRequestErrorResponse,
} from "../src/lib/request-error.ts";

test("server-function failures stay errors for TanStack Start to serialize", () => {
  assert.throws(() => unexpectedRequestErrorResponse("serverFn", () => "<html>fallback</html>"), {
    name: "Error",
    message: "We couldn't complete that request. Please try again.",
  });
});

test("router failures retain the branded HTML fallback", async () => {
  const response = unexpectedRequestErrorResponse("router", () => "<html>fallback</html>");

  assert.equal(response.status, 500);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(await response.text(), "<html>fallback</html>");
});

test("recognizes TanStack server-function requests without misclassifying pages", () => {
  assert.equal(
    isServerFunctionRequest(new Request("https://cometx.example/_serverFn/checkout")),
    true,
  );
  assert.equal(isServerFunctionRequest(new Request("https://cometx.example/membership")), false);
  assert.equal(
    isServerFunctionRequest(
      new Request("https://cometx.example/rpc/plan", {
        headers: { "x-tsr-serverFn": "true" },
      }),
    ),
    true,
  );
});
