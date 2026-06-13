# Market Board

A real-time market dashboard for publicly traded instruments. Add stocks, ETFs, indexes, and other Yahoo Finance-supported symbols, then view each instrument's latest quote and independent chart range.

## Install From Source

Users who are comfortable with the terminal can run the app directly from GitHub:

```bash
git clone https://github.com/KidLeiS/market-board.git
cd market-board
npm install
npm run desktop
```

## Web Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` and the market data proxy runs at `http://localhost:4173`.

## Desktop App

Open the desktop app locally:

```bash
npm run desktop
```

Build downloadable macOS artifacts:

```bash
npm run package:mac
```

The generated `.dmg` and `.zip` files are placed in `release/`.

## Downloadable Releases

For non-technical users, download the latest macOS build from the GitHub Releases page:

https://github.com/KidLeiS/market-board/releases

This app is currently unsigned, so macOS may show a security warning the first time it opens.

## Web Deployment

The app is also configured for Netlify:

```bash
npm install
npm run build
npx netlify deploy --prod
```

Netlify serves the Vite frontend from `dist/` and rewrites `/api/*` to a stateless serverless function in `netlify/functions/api.mjs`. Watchlists and chart ranges stay in each user's browser local storage.

Only the symbol and selected chart range are persisted locally. Quotes, company metadata, prices, and chart history are fetched fresh and are not stored.

## Notes

- Market data is fetched through the app's local Node proxy using `yahoo-finance2`.
- Quotes refresh every 10 seconds while the dashboard is open.
- Chart ranges are stored per security in your browser's local storage.
- Data availability, exchange delay, and real-time entitlement depend on Yahoo Finance coverage for each instrument.
