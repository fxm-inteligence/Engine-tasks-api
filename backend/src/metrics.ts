import { timingSafeEqual } from "node:crypto";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/** Where the scrape is served. The scrape itself is not counted. */
export const METRICS_ROUTE = "/metrics";

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const requests = new Counter({
  name: "http_requests_total",
  help: "Requests answered, by method, route pattern and status.",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});
const durations = new Histogram({
  name: "http_request_duration_seconds",
  help: "How long requests took to answer, in seconds.",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/** `/orders/:id` is written `/orders/{id}`, the way the API documentation writes it. */
function pattern(route: string): string {
  return route.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
}

/** Counts one answered request; `route` is the pattern it matched, or nothing when no route did. */
function record(method: string, route: string | undefined, status: number, seconds: number): void {
  const label = route === undefined ? "unmatched" : pattern(route);
  if (label === METRICS_ROUTE) return;
  const labels = { method, route: label, status: String(status) };
  requests.inc(labels);
  durations.observe(labels, seconds);
}

/** Whether the request may read the metrics: always when METRICS_TOKEN is empty, else only with that bearer token. */
function authorized(header: string | string[] | undefined): boolean {
  const token = process.env.METRICS_TOKEN;
  if (!token) return true;
  const given = Buffer.from(typeof header === "string" ? header : "");
  const wanted = Buffer.from(`Bearer ${token}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

interface MetricsRequest {
  method?: string;
  baseUrl?: string;
  route?: { path?: unknown };
  headers: { authorization?: string };
}
interface MetricsResponse {
  statusCode: number;
  once(event: "finish", listener: () => void): unknown;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
}

/** Express middleware: counts every request once its answer is sent. The route is known by then. */
export function metricsMiddleware(req: MetricsRequest, res: MetricsResponse, next: () => void): void {
  const started = process.hrtime.bigint();
  res.once("finish", () => {
    const path = req.route?.path;
    record(
      req.method ?? "GET",
      typeof path === "string" ? (req.baseUrl ?? "") + path : undefined,
      res.statusCode,
      Number(process.hrtime.bigint() - started) / 1e9,
    );
  });
  next();
}

/** The scrape: the metrics in the Prometheus text format. */
export function metricsHandler(req: MetricsRequest, res: MetricsResponse): void {
  if (!authorized(req.headers.authorization)) {
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", "Bearer");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  registry
    .metrics()
    .then((body) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", registry.contentType);
      res.end(body);
    })
    .catch(() => {
      res.statusCode = 500;
      res.end();
    });
}
