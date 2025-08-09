export default function cachedDataRetriever(baseURL: any, { headers, cacheTime, timeout }: {
    headers: any;
    cacheTime?: number;
    timeout?: number;
}): () => Promise<any>;
