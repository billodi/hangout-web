const SESSION_COOKIE_BASE = "billixa_session";

function cleanDeployTag(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return "dev";
  return cleaned.slice(0, 12);
}

function resolveDeployTag(): string {
  const raw =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.NEXT_PUBLIC_COOKIE_VERSION ??
    "dev";
  return cleanDeployTag(raw);
}

export const COOKIE_DEPLOY_TAG = resolveDeployTag();
export const SESSION_COOKIE_PREFIX = `${SESSION_COOKIE_BASE}_`;
export const SESSION_COOKIE = `${SESSION_COOKIE_PREFIX}${COOKIE_DEPLOY_TAG}`;
export const LEGACY_SESSION_COOKIE = SESSION_COOKIE_BASE;

