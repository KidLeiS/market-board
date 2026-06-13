import express from "express";
import cors from "cors";
import YahooFinance from "yahoo-finance2";
import { pathToFileURL } from "node:url";

const rangeConfig = {
  "1D": { days: 1, interval: "5m" },
  "5D": { days: 5, interval: "15m" },
  "1M": { days: 31, interval: "1d" },
  "6M": { days: 183, interval: "1d" },
  YTD: { ytd: true, interval: "1d" },
  "1Y": { days: 366, interval: "1d" },
  "5Y": { days: 365 * 5, interval: "1wk" }
};

export function createMarketApp() {
  const app = express();
  const yahooFinance = new YahooFinance({
    suppressNotices: ["yahooSurvey"]
  });

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/search", async (req, res) => {
    const query = String(req.query.q || "").trim();

    if (query.length < 1) {
      res.json({ results: [] });
      return;
    }

    try {
      const response = await yahooFinance.search(query, {
        quotesCount: 10,
        newsCount: 0,
        enableFuzzyQuery: true
      });

      const results = (response.quotes || [])
        .filter((item) => item.symbol && item.shortname)
        .map((item) => ({
          symbol: item.symbol,
          name: item.shortname || item.longname || item.symbol,
          exchange: item.exchDisp || item.exchange || "",
          type: item.quoteType || "EQUITY"
        }));

      res.json({ results });
    } catch (error) {
      res.status(502).json({ error: "Search failed", detail: error.message });
    }
  });

  app.get("/api/quotes", async (req, res) => {
    const symbols = String(req.query.symbols || "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);

    if (!symbols.length) {
      res.json({ quotes: [] });
      return;
    }

    try {
      const responses = await Promise.allSettled(
        symbols.map((symbol) => yahooFinance.quote(symbol))
      );
      const quotes = responses.map((response, index) => {
        if (response.status === "rejected") {
          return {
            symbol: symbols[index],
            error: response.reason?.message || "Quote unavailable"
          };
        }

        const quote = response.value;
        return {
          symbol: quote.symbol || symbols[index],
          name: quote.shortName || quote.longName || quote.displayName || symbols[index],
          exchange: quote.fullExchangeName || quote.exchange || "",
          currency: quote.currency || "USD",
          price: quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? null,
          change: quote.regularMarketChange ?? null,
          changePercent: quote.regularMarketChangePercent ?? null,
          marketState: quote.marketState || "",
          marketTime: quote.regularMarketTime || quote.postMarketTime || quote.preMarketTime || null,
          previousClose: quote.regularMarketPreviousClose ?? null
        };
      });

      res.json({ quotes });
    } catch (error) {
      res.status(502).json({ error: "Quote request failed", detail: error.message });
    }
  });

  app.get("/api/history/:symbol", async (req, res) => {
    const symbol = req.params.symbol.trim().toUpperCase();
    const selectedRange = String(req.query.range || "1M").toUpperCase();
    const config = rangeConfig[selectedRange] || rangeConfig["1M"];
    const now = new Date();
    let period1;

    if (config.ytd) {
      period1 = new Date(now.getFullYear(), 0, 1);
    } else {
      period1 = new Date(now);
      period1.setDate(period1.getDate() - config.days);
    }

    try {
      const response = await yahooFinance.chart(symbol, {
        period1,
        period2: now,
        interval: config.interval,
        includePrePost: selectedRange === "1D"
      });

      const points = (response.quotes || [])
        .filter((point) => point.date && Number.isFinite(point.close))
        .map((point) => ({
          time: point.date.toISOString(),
          close: point.close,
          high: point.high ?? null,
          low: point.low ?? null,
          open: point.open ?? null,
          volume: point.volume ?? null
        }));

      res.json({
        symbol,
        range: selectedRange,
        currency: response.meta?.currency || "USD",
        points
      });
    } catch (error) {
      res.status(502).json({ error: "History request failed", detail: error.message });
    }
  });

  return app;
}

export function startMarketServer({ port = Number(process.env.PORT || 4173), host = "127.0.0.1" } = {}) {
  const app = createMarketApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const resolvedPort = typeof address === "object" && address ? address.port : port;
      console.log(`Market data server listening on http://${host}:${resolvedPort}`);
      resolve({
        app,
        server,
        port: resolvedPort,
        url: `http://${host}:${resolvedPort}`
      });
    });

    server.on("error", reject);
  }
  );
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  startMarketServer({ host: "0.0.0.0" }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
