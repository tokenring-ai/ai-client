import axios from "axios";

export default function cachedDataRetriever(
  baseURL: any,
  {
    headers,
    cacheTime = 30000,
    timeout = 1000
  }: {
    headers: any;
    cacheTime?: number;
    timeout?: number;
  }
) {
  let lastOnlineCheck = 0;
  let lastResponse: any;

  return async (): Promise<any> => {
    if (lastOnlineCheck < Date.now() - cacheTime) {
      try {
        const res = await axios.get(baseURL, {headers, timeout});
        lastResponse = res.data;
        lastOnlineCheck = Date.now();
      } catch (_err) {
        lastResponse = null;
      }
    }
    return lastResponse;
  };
}