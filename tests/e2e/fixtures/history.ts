import { expect, type APIRequestContext } from "@playwright/test";

const unknownId = "Y".repeat(20);

export async function expectMissingMatch(
  request: APIRequestContext,
  id: string,
) {
  for (const suffix of ["", "/__data.json"]) {
    const [denied, unknown] = await Promise.all(
      [id, unknownId].map((matchId) =>
        request.get(`/match/${matchId}${suffix}`),
      ),
    );
    // SvelteKit carries loader error codes in the data response's error node.
    expect(denied!.status()).toBe(unknown!.status());
    expect(denied!.headers()["cache-control"]).toBe("no-store");
    expect(unknown!.headers()["cache-control"]).toBe("no-store");
    const body = await denied!.text();
    expect(body.replaceAll(id, unknownId)).toBe(await unknown!.text());
    if (suffix) expect(body).toContain('"status":404');
    else expect(denied!.status()).toBe(404);
  }
}
