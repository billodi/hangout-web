import { type APIRequestContext, expect, test } from "@playwright/test";

async function signupAndGetUserId(
  contextRequest: APIRequestContext,
  email: string,
  password: string,
  displayName: string,
) {
  const signup = await contextRequest.post("/api/auth/signup", {
    data: { email, password, displayName },
  });
  expect([201, 409]).toContain(signup.status());

  if (signup.status() === 409) {
    const login = await contextRequest.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.ok()).toBeTruthy();
  }

  const meRes = await contextRequest.get("/api/auth/me");
  expect(meRes.ok()).toBeTruthy();
  const me = (await meRes.json()) as { user?: { id: string } | null };
  expect(me.user?.id).toBeTruthy();
  return me.user!.id;
}

test("authenticated flow: create, join, leave, and chat", async ({ browser }) => {
  test.setTimeout(180_000);
  const ts = Date.now();
  const password = "secret123";
  const emailA = `e2e+a_${ts}@example.com`;
  const emailB = `e2e+b_${ts}@example.com`;

  const ctxA = await browser.newContext({ baseURL: "http://localhost:3000" });
  const ctxB = await browser.newContext({ baseURL: "http://localhost:3000" });

  const userAId = await signupAndGetUserId(ctxA.request, emailA, password, "E2E User A");
  const userBId = await signupAndGetUserId(ctxB.request, emailB, password, "E2E User B");

  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const createRes = await ctxA.request.post("/api/activities", {
    data: {
      title: `E2E Activity ${ts}`,
      description: "Automated activity for lifecycle smoke test",
      location: "Riyadh",
      lat: 24.7136,
      lng: 46.6753,
      whenISO: future,
      type: "chill",
      visibility: "public",
      limit: 5,
    },
  });
  expect(createRes.status()).toBe(201);
  const created = (await createRes.json()) as { id: string };
  expect(created.id).toBeTruthy();

  const joinRes = await ctxB.request.post(`/api/activities/${created.id}/join`);
  expect(joinRes.ok()).toBeTruthy();
  const joined = (await joinRes.json()) as { joined?: boolean };
  expect(joined.joined).toBe(true);

  const leaveRes = await ctxB.request.post(`/api/activities/${created.id}/leave`);
  expect(leaveRes.ok()).toBeTruthy();
  const left = (await leaveRes.json()) as { joined?: boolean };
  expect(left.joined).toBe(false);

  const threadRes = await ctxA.request.post("/api/chats", { data: { userId: userBId } });
  expect(threadRes.ok()).toBeTruthy();
  const thread = (await threadRes.json()) as { threadId: string };
  expect(thread.threadId).toBeTruthy();
  const warmupMessagesRes = await ctxA.request.get(`/api/chats/${thread.threadId}/messages`);
  expect(warmupMessagesRes.ok()).toBeTruthy();

  const msgBody = `hello from e2e ${ts}`;
  const sendRes = await ctxA.request.post(`/api/chats/${thread.threadId}/messages`, {
    data: { body: msgBody },
  });
  expect(sendRes.ok()).toBeTruthy();

  const fetchRes = await ctxB.request.get(`/api/chats/${thread.threadId}/messages`);
  expect(fetchRes.ok()).toBeTruthy();
  const rows = (await fetchRes.json()) as Array<{ body: string; authorUserId: string }>;
  expect(rows.some((row) => row.body === msgBody && row.authorUserId === userAId)).toBeTruthy();

  await ctxA.close();
  await ctxB.close();
});
