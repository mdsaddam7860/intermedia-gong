function isRetryableError(err) {
  const status = err?.response?.status;

  if (status === 429) {
    const retryAfter = err.response.headers["retry-after"];
    if (retryAfter) {
      return true;
    }
  }

  if (!status) return true; // network / timeout

  return [429, 500, 502, 503, 504].includes(status);
}

async function withRetry(
  fn,
  {
    retries = 5,
    baseDelay = 500,
    maxDelay = 10_000,
    jitter = true,
    shouldRetry = () => true,
    onRetry = () => {},
  } = {}
) {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;

      if (attempt > retries || !shouldRetry(err)) {
        throw err;
      }

      const delay =
        Math.min(baseDelay * 2 ** (attempt - 1), maxDelay) *
        (jitter ? 0.5 + Math.random() : 1);

      onRetry(err, attempt, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export { withRetry, isRetryableError };
