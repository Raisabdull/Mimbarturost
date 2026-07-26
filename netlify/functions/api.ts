process.env.IS_SERVERLESS = "true";
process.env.NETLIFY = "true";

import serverless from "serverless-http";
import app from "../../api/index";

export const handler = serverless(app);

