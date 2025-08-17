import axios from "axios";

export default function cachedDataRetriever<T = unknown>(
  baseURL: string,
  {
    headers,
    cacheTime = 30000,
    timeout = 1000
  }: {
    headers: Record<string, string>;
    cacheTime?: number;
    timeout?: number;
  }
) {
  let lastOnlineCheck = 0;
  let lastResponse: T | null = null;

  return async (): Promise<T | null> => {
    if (lastOnlineCheck < Date.now() - cacheTime) {
      try {
        const res = await axios.get(baseURL, { headers, timeout });
        lastResponse = res.data;
        lastOnlineCheck = Date.now();
      } catch (_err) {
        lastResponse = null;
      }
    }
    return lastResponse;
  };
}
