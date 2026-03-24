import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/tasks/help-requests/route";

describe("GET /api/tasks/help-requests", () => {
  it("returns 401 when Authorization is missing", async () => {
    const request = new Request("http://localhost:3000/api/tasks/help-requests", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Missing bearer token.",
    });
  });
});
