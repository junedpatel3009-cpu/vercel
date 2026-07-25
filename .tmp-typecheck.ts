import { createServerFn } from "@tanstack/react-start";
const getData = createServerFn({ method: "GET" }).handler(async () => ({
  value: 1,
  items: [{ id: 1, label: "x" }],
}));
type Data = Awaited<ReturnType<typeof getData>>;
const data: Data = { value: 1, items: [{ id: 1, label: "x" }] };
const item = data.items[0];
void item;
