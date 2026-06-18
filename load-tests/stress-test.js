/* eslint-disable */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 200 },
    { duration: "1m", target: 200 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  // Hit a mix of cached and uncached endpoints
  const endpoints = [
    "/api/localities",
    "/api/service-categories",
    "/api/community/providers-by-category",
  ];

  const url = `${BASE_URL}${endpoints[Math.floor(Math.random() * endpoints.length)]}`;
  const res = http.get(url);
  check(res, {
    "status ok": (r) => r.status < 500,
  });

  sleep(0.2 + Math.random() * 0.3);
}
