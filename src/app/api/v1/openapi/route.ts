import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "KS Abroad Studies API v1",
    version: "1.0.0",
    description: "Mobile-friendly read APIs for universities and programmes.",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "API metadata",
          },
        },
      },
    },
    "/search": {
      get: {
        summary: "Search universities and programmes",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Top 20 matches" } },
      },
    },
    "/universities": {
      get: {
        summary: "List universities (summary fields)",
        responses: { "200": { description: "University list" } },
      },
    },
    "/programs": {
      get: {
        summary: "List programmes",
        parameters: [
          {
            name: "level",
            in: "query",
            schema: {
              type: "string",
              enum: ["bachelor", "master", "single-cycle"],
            },
          },
        ],
        responses: { "200": { description: "Programme list" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
