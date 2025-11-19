import axios from "axios";

export default function cachedDataRetriever<T = unknown>(
  baseURL: string,
  {
    headers,
    cacheTime = 30000,
    timeout = 1000,
  }: {
    headers: Record<string, string>;
    cacheTime?: number;
    timeout?: number;
  },
) {
  let lastOnlineCheck = 0;
  let lastResponse: T | null = null;
  let pendingRequest: Promise<T | null> | null = null;

  return async (): Promise<T | null> => {
    if (lastOnlineCheck < Date.now() - cacheTime) {
      // If there's already a request in-flight, return it
      if (pendingRequest) {
        return pendingRequest;
      }

      // Create new request
      pendingRequest = (async () => {
        try {
          const res = await axios.get(baseURL, {headers, timeout});
          lastResponse = res.data;
          lastOnlineCheck = Date.now();
          return lastResponse;
        } catch (_err) {
          lastResponse = null;
          return lastResponse;
        } finally {
          pendingRequest = null;
        }
      })();

      return pendingRequest;
    }
    return lastResponse;
  };
}
