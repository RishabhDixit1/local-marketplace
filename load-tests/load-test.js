/* eslint-disable */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000", "p(99)<5000"],
    http_req_failed: ["rate<0.02"],
  },
};

const localities = [
  "Baner", "Koregaon Park", "Viman Nagar", "Hinjawadi", "Kharadi",
];

export default function () {
  const loc = localities[Math.floor(Math.random() * localities.length)];

  // Cached reads
  http.get(`${BASE_URL}/api/localities`);
  http.get(`${BASE_URL}/api/service-categories?locality_id=${encodeURIComponent(loc)}`);

  // Provider search with category filter (simulates browsing)
  const search = http.get(
    `${BASE_URL}/api/community/providers-by-category?category=${encodeURIComponent("Home Cleaning")}&locality=${encodeURIComponent(loc)}`,
  );
  check(search, {
    "search ok": (r) => r.status === 200 || r.status === 401,
  });

  sleep(0.5 + Math.random());
}
