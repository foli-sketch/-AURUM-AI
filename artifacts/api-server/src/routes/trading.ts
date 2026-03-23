import { Router, type IRouter, type Request, type Response } from "express";
import http from "http";

const router: IRouter = Router();
const PYTHON_PORT = process.env["PYTHON_PORT"] || "8082";

function proxyToPython(req: Request, res: Response) {
  const body = req.method !== "GET" ? JSON.stringify(req.body) : undefined;
  const options: http.RequestOptions = {
    hostname: "localhost",
    port: parseInt(PYTHON_PORT),
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${PYTHON_PORT}`,
      ...(body ? { "content-length": Buffer.byteLength(body).toString() } : {}),
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (e) => {
    req.log.error({ err: e }, "Python proxy error");
    if (!res.headersSent) {
      res.status(503).json({ error: "Trading service unavailable", detail: e.message });
    }
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
}

router.get("/trading/signal",   proxyToPython);
router.get("/trading/news",     proxyToPython);
router.get("/trading/history",  proxyToPython);
router.get("/trading/analysis", proxyToPython);
router.post("/trading/chat",     proxyToPython);
router.post("/trading/telegram", proxyToPython);

export default router;
