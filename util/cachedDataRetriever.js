import axios from "axios";

export default function cachedDataRetriever(
	baseURL,
	{ headers, cacheTime = 30000, timeout = 1000 },
) {
	let lastOnlineCheck = 0;
	let lastResponse;
	return async () => {
		if (lastOnlineCheck < Date.now() - cacheTime) {
			try {
				const res = await axios.get(baseURL, { headers, timeout });

				lastResponse = res.data;

				lastOnlineCheck = Date.now();
			} catch (err) {
				lastResponse = null;
			}
		}
		return lastResponse;
	};
}
