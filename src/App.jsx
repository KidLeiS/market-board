import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Activity,
  BarChart3,
  Clock3,
  LineChart,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X
} from "lucide-react";

const API_BASE =
  window.marketConfig?.apiBase || import.meta.env.VITE_API_BASE || "http://localhost:4173";
const STORAGE_KEY = "market-v2-dashboard";
const DEFAULT_SYMBOLS = [
  { symbol: "AAPL", name: "Apple Inc.", range: "1M" },
  { symbol: "MSFT", name: "Microsoft Corporation", range: "1M" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", range: "1M" }
];
const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y"];

function loadSecurities() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(stored) && stored.length) {
      return stored;
    }
  } catch {
    // Ignore corrupt local storage and start with the default board.
  }

  return DEFAULT_SYMBOLS;
}

function currency(value, code = "USD") {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    maximumFractionDigits: value > 1000 ? 2 : 4
  }).format(value);
}

function number(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function percent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTime(value) {
  if (!value) return "Awaiting tick";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatAxis(value, range) {
  const date = new Date(value);

  if (range === "1D") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function getLineColor(changePercent) {
  if (!Number.isFinite(changePercent)) return "#2563eb";
  return changePercent >= 0 ? "#0f9f6e" : "#d92d20";
}

function App() {
  const [securities, setSecurities] = useState(loadSecurities);
  const [quotes, setQuotes] = useState({});
  const [history, setHistory] = useState({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState("");
  const searchAbort = useRef(null);

  const symbols = useMemo(
    () => securities.map((security) => security.symbol).join(","),
    [securities]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(securities));
  }, [securities]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return undefined;
    }

    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const data = await response.json();
        setResults(data.results || []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  async function refreshQuotes() {
    if (!symbols) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/api/quotes?symbols=${encodeURIComponent(symbols)}`);
      const data = await response.json();
      const nextQuotes = {};
      for (const quote of data.quotes || []) {
        nextQuotes[quote.symbol] = quote;
      }
      setQuotes(nextQuotes);
      setLastRefresh(new Date());
      setError("");
    } catch {
      setError("Market data is temporarily unavailable.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refreshHistory(security) {
    const key = `${security.symbol}:${security.range}`;

    setHistory((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: "" }
    }));

    try {
      const response = await fetch(
        `${API_BASE}/api/history/${encodeURIComponent(security.symbol)}?range=${security.range}`
      );
      const data = await response.json();
      setHistory((current) => ({
        ...current,
        [key]: { points: data.points || [], loading: false, error: "" }
      }));
    } catch {
      setHistory((current) => ({
        ...current,
        [key]: { points: [], loading: false, error: "Chart unavailable" }
      }));
    }
  }

  useEffect(() => {
    refreshQuotes();
    const timer = window.setInterval(refreshQuotes, 10000);
    return () => window.clearInterval(timer);
  }, [symbols]);

  useEffect(() => {
    securities.forEach(refreshHistory);
  }, [securities]);

  function addSecurity(result) {
    const symbol = result.symbol.toUpperCase();
    if (securities.some((security) => security.symbol === symbol)) {
      setQuery("");
      setResults([]);
      return;
    }

    setSecurities((current) => [
      { symbol, name: result.name || symbol, range: "1M" },
      ...current
    ]);
    setQuery("");
    setResults([]);
  }

  function addTypedSymbol(event) {
    event.preventDefault();
    const symbol = query.trim().toUpperCase();
    if (!symbol || securities.some((security) => security.symbol === symbol)) return;
    addSecurity({ symbol, name: symbol });
  }

  function updateRange(symbol, range) {
    setSecurities((current) =>
      current.map((security) =>
        security.symbol === symbol ? { ...security, range } : security
      )
    );
  }

  function removeSecurity(symbol) {
    setSecurities((current) => current.filter((security) => security.symbol !== symbol));
  }

  const movers = useMemo(() => {
    const list = Object.values(quotes).filter((quote) =>
      Number.isFinite(quote.changePercent)
    );
    return {
      up: list.filter((quote) => quote.changePercent >= 0).length,
      down: list.filter((quote) => quote.changePercent < 0).length
    };
  }, [quotes]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Activity size={21} />
          </span>
          <div>
            <h1>Market Board</h1>
            <p>Public instruments with live quote polling and independent chart ranges.</p>
          </div>
        </div>

        <div className="status-strip" aria-label="Dashboard status">
          <div className="status-item">
            <BarChart3 size={17} />
            <span>{securities.length} watched</span>
          </div>
          <div className="status-item gain">
            <TrendingUp size={17} />
            <span>{movers.up} up</span>
          </div>
          <div className="status-item loss">
            <TrendingDown size={17} />
            <span>{movers.down} down</span>
          </div>
          <button className="icon-button" onClick={refreshQuotes} title="Refresh quotes">
            <RefreshCw size={18} className={isRefreshing ? "spin" : ""} />
          </button>
        </div>
      </header>

      <section className="command-band" aria-label="Add securities">
        <form className="search-box" onSubmit={addTypedSymbol}>
          <Search size={19} />
          <input
            aria-label="Search ticker or company"
            autoComplete="off"
            placeholder="Add ticker, ETF, index, or company"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              className="ghost-icon"
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              title="Clear search"
            >
              <X size={17} />
            </button>
          )}
          <button className="add-button" type="submit">
            <Plus size={18} />
            <span>Add</span>
          </button>
        </form>

        {(results.length > 0 || isSearching) && (
          <div className="results-panel">
            {isSearching ? (
              <div className="result-row muted">Searching...</div>
            ) : (
              results.map((result) => (
                <button
                  className="result-row"
                  key={`${result.symbol}-${result.exchange}`}
                  onClick={() => addSecurity(result)}
                  type="button"
                >
                  <strong>{result.symbol}</strong>
                  <span>{result.name}</span>
                  <em>{result.exchange || result.type}</em>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="market-grid" aria-label="Watched instruments">
        {securities.map((security) => (
          <SecurityCard
            history={history[`${security.symbol}:${security.range}`]}
            key={security.symbol}
            onRangeChange={updateRange}
            onRemove={removeSecurity}
            quote={quotes[security.symbol]}
            security={security}
          />
        ))}
      </section>

      <footer className="footer-note">
        <Clock3 size={16} />
        <span>
          {lastRefresh
            ? `Quotes refreshed ${formatTime(lastRefresh.toISOString())}`
            : "Quote refresh starts automatically"}
        </span>
      </footer>
    </main>
  );
}

function SecurityCard({ security, quote, history, onRangeChange, onRemove }) {
  const data = history?.points || [];
  const chartColor = getLineColor(quote?.changePercent);
  const positive = Number.isFinite(quote?.changePercent) && quote.changePercent >= 0;
  const badgeClass = positive ? "quote-badge positive" : "quote-badge negative";
  const gradientId = `fill-${security.symbol.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <article className="security-card">
      <div className="card-head">
        <div>
          <div className="ticker-row">
            <h2>{security.symbol}</h2>
            <span className="exchange">{quote?.exchange || "Public market"}</span>
          </div>
          <p>{quote?.name || security.name}</p>
        </div>
        <button
          className="icon-button subtle"
          onClick={() => onRemove(security.symbol)}
          title={`Remove ${security.symbol}`}
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="price-row">
        <div>
          <span className="label">Last price</span>
          <strong>{currency(quote?.price, quote?.currency)}</strong>
        </div>
        <span className={badgeClass}>
          {number(quote?.change)} ({percent(quote?.changePercent)})
        </span>
      </div>

      <div className="range-row" aria-label={`${security.symbol} chart range`}>
        {RANGES.map((range) => (
          <button
            className={security.range === range ? "active" : ""}
            key={range}
            onClick={() => onRangeChange(security.symbol, range)}
            type="button"
          >
            {range}
          </button>
        ))}
      </div>

      <div className="chart-wrap">
        {history?.loading ? (
          <div className="chart-state">
            <LineChart size={20} />
            Loading chart
          </div>
        ) : history?.error ? (
          <div className="chart-state error">{history.error}</div>
        ) : data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(value) => formatAxis(value, security.range)}
                minTickGap={26}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(value) => currency(value, quote?.currency)}
                tickLine={false}
                axisLine={false}
                width={78}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <span>{formatTime(label)}</span>
                      <strong>{currency(payload[0].value, quote?.currency)}</strong>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={chartColor}
                fill={`url(#${gradientId})`}
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-state">No chart data</div>
        )}
      </div>

      <div className="meta-row">
        <span>{quote?.marketState || "Market state pending"}</span>
        <span>{formatTime(quote?.marketTime)}</span>
      </div>
    </article>
  );
}

export default App;
