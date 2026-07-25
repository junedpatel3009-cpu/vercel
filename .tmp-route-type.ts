import { Route as IndexRoute } from "./src/routes/index";
const data = IndexRoute.useLoaderData();
const check: { openJobs: string } = data;
void check;
