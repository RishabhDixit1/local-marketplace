/* eslint-disable */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // Warmup — first request primes cache
  http.get(`${BASE_URL}/api/localities`);

  // Cached endpoints (should be fast after warmup)
  const localities = http.get(`${BASE_URL}/api/localities`);
  check(localities, {
    "localities: status 200": (r) => r.status === 200,
    "localities: fast": (r) => r.timings.duration < 500,
  });

  const categories = http.get(`${BASE_URL}/api/service-categories`);
  check(categories, {
    "categories: status 200": (r) => r.status === 200,
  });

  // Uncached — provider search (any locality)
  const search = http.get(`${BASE_URL}/api/community/providers-by-category`);
  check(search, {
    "search: status 200 or 401": (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
