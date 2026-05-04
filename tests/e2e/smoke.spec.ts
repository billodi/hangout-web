import { expect, test } from "@playwright/test";

test("home redirects to map and renders main nav", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByText("BilliXa")).toBeVisible();
  await expect(page.getByRole("link", { name: "Map" }).first()).toBeVisible();
});

test("core pages are reachable", async ({ page }) => {
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();

  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
});

test("health endpoint responds with json", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { ok?: boolean; db?: string };
  expect(typeof body.ok).toBe("boolean");
  if (body.ok) expect(body.db).toBe("connected");
});

