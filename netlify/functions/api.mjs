import serverless from "serverless-http";
import { createMarketApp } from "../../server/index.js";

const app = createMarketApp();

export const handler = serverless(app);
