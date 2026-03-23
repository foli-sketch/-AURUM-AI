import { Router, type IRouter, type Request, type Response } from "express";
import http from "http";

const router: IRouter = Router();
const PYTHON_PORT = process.env["PYTHON_PORT"] || "8082";

function proxyToPython(req: Request, res: Response) {
  const options = {
    hostname: "localhost",
    port: parseInt(PYTHON_PORT),
    path: req.originalUrl,
    method: req.method,
    headers: req.headers,
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

  if (req.body && Object.keys(req.body).length > 0) {
    proxyReq.write(JSON.stringify(req.body));
  }

  proxyReq.end();
}

router.get("/trading/signal", proxyToPython);
router.get("/trading/news", proxyToPython);
router.get("/trading/history", proxyToPython);

export default router;
