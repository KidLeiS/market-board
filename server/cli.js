import { startMarketServer } from "./index.js";

startMarketServer({ host: "0.0.0.0" }).catch((error) => {
  console.error(error);
  process.exit(1);
});
