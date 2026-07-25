import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getData = createServerFn({ method: "GET" }).handler(async () => ({
  value: 1,
  items: [{ id: 1, label: "x" }],
}));

export const Route = createFileRoute("/")({
  loader: () => getData(),
  component: () => {
    const data = Route.useLoaderData();
    const item = data.items[0];
    return <div>{item.label}</div>;
  },
});
