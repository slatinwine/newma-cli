/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number },
  timeoutMs: number = 60000 // Default 60 seconds
): Promise<Response> {
  const { timeout = timeoutMs, ...fetchOptions } = options;

  // Create abort controller for timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

  // Merge signals if one already exists
  if (fetchOptions.signal) {
    // If there's already a signal (e.g., from user cancellation),
    // we need to abort when either signal is triggered
    const originalSignal = fetchOptions.signal;

    // Create a combined controller that aborts when either signal aborts
    const combinedController = new AbortController();

    originalSignal.addEventListener('abort', () => combinedController.abort());
    timeoutController.signal.addEventListener('abort', () => combinedController.abort());

    fetchOptions.signal = combinedController.signal;
  } else {
    fetchOptions.signal = timeoutController.signal;
  }

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Check if it's a timeout error
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }

    throw error;
  }
}
