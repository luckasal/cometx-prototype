export function unexpectedRequestErrorResponse(
  handlerType: "serverFn" | "router",
  renderErrorPage: () => string,
): Response {
  if (handlerType === "serverFn") {
    // TanStack Start serializes thrown server-function errors for the client.
    // Returning HTML here makes the entire document the customer-facing error.
    throw new Error("We couldn't complete that request. Please try again.");
  }

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function isServerFunctionRequest(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  return pathname.startsWith("/_serverFn/") || request.headers.get("x-tsr-serverFn") === "true";
}
