import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchReferenceCollectionItems } from "../../api/reference.js";

function createFetchResponse(payload = {}) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload;
    }
  };
}

describe("reference API contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards dynamic collection filters without hardcoded query lock-in", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createFetchResponse({ ok: true, items: [] }));

    await fetchReferenceCollectionItems({
      collectionId: "dispatches",
      offset: 0,
      limit: 25,
      search: "dispatch",
      status: "draft",
      ownerId: "aut-001",
      collaboratorId: ["aut-001", "aut-002"]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/reference/collections/dispatches/items?");
    expect(url).toContain("offset=0");
    expect(url).toContain("limit=25");
    expect(url).toContain("search=dispatch");
    expect(url).toContain("status=draft");
    expect(url).toContain("ownerId=aut-001");
    expect(url).toContain("collaboratorId=aut-001%2Caut-002");
  });
});
