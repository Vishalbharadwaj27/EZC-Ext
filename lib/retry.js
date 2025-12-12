// lib/retry.js
// Safe exponential-backoff retry wrapper with jitter for network/LLM calls.

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * retryAsync(fn, options)
 *  - fn: async function that does the work (should throw on non-retriable errors)
 *  - options:
 *      retries (default 5)
 *      minDelay (ms, default 500)
 *      maxDelay (ms, default 10000)
 *      factor (default 2)
 *      jitter (true/false, default true)
 *      shouldRetry(err) => boolean // optional predicate to determine if error is retriable
 *      onRetry(attempt, delay, err) => void // optional callback for logging retries
 */
async function retryAsync(fn, options = {}) {
  const {
    retries = 5,
    minDelay = 500,
    maxDelay = 10000,
    factor = 2,
    jitter = true,
    shouldRetry = null,
    onRetry = null
  } = options;

  let attempt = 0;
  let delay = minDelay;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const willRetry = attempt <= retries && (typeof shouldRetry === 'function' ? shouldRetry(err) : true);
      
      if (!willRetry) {
        throw err;
      }
      
      // Compute backoff with optional jitter
      let backoff = Math.min(delay * Math.pow(factor, attempt - 1), maxDelay);
      if (jitter) {
        // Full jitter: randomize between 0 and computed backoff
        backoff = Math.floor(Math.random() * backoff);
      }
      // Safety clamp to minimum 100ms
      backoff = Math.max(100, backoff);
      
      // Call optional onRetry callback for logging
      if (typeof onRetry === 'function') {
        onRetry(attempt, backoff, err);
      }
      
      // Wait then retry
      await wait(backoff);
    }
  }
}

module.exports = { retryAsync };
