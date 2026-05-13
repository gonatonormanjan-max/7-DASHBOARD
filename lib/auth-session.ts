const DEFAULT_AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const MIN_AUTH_SESSION_MAX_AGE_SECONDS = 60 * 30;
const MAX_AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function resolveAuthSessionMaxAgeSeconds(
  rawValue = process.env.AUTH_SESSION_MAX_AGE_SECONDS
) {
  if (!rawValue) {
    return DEFAULT_AUTH_SESSION_MAX_AGE_SECONDS;
  }

  const parsed = Number(rawValue);

  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_AUTH_SESSION_MAX_AGE_SECONDS ||
    parsed > MAX_AUTH_SESSION_MAX_AGE_SECONDS
  ) {
    return DEFAULT_AUTH_SESSION_MAX_AGE_SECONDS;
  }

  return parsed;
}

