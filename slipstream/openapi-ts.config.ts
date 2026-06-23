import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../openapi.json",
  output: {
    path: "src/lib/api",
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      enums: "javascript",
    },
    {
      name: "@hey-api/sdk",
    },
    "@hey-api/client-fetch",
  ],
});
