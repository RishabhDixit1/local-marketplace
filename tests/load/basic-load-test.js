import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const searchTerms = ["plumber", "electrician", "carpenter", "painter", "cleaner"];

export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`VUs: ${options.vus}, Duration: ${options.duration}`);

  const probe = http.get(`${BASE_URL}/`);
  check(probe, { "setup: landing page reachable": (r) => r.status < 500 });

  return { startedAt: Date.now() };
}

export default function () {
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

  const landing = http.get(`${BASE_URL}/`);
  check(landing, {
    "landing status 200": (r) => r.status === 200,
  });

  sleep(0.5);

  const market = http.get(`${BASE_URL}/market/crossing-republik/electrician`);
  check(market, {
    "market page status 200": (r) => r.status === 200,
  });

  sleep(0.5);

  const search = http.get(`${BASE_URL}/search?q=${term}`, {
    tags: { name: "search" },
  });
  check(search, {
    "search status 200": (r) => r.status === 200,
  });

  sleep(1);
}

export function teardown(data) {
  const elapsed = Date.now() - data.startedAt;
  console.log(`Test finished. Duration: ${elapsed}ms`);
}
