import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { ServicesPageContent } from "@/client/services";
import { getServiceCategories, getTotalProfessionalsCount } from "@/lib/services-db.server";

const loadServicesData = createServerFn({ method: "GET" }).handler(async () => {
  return {
    categories: getServiceCategories(),
    totalPros: getTotalProfessionalsCount(),
  };
});

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services - Browse all categories | Servio" },
      {
        name: "description",
        content:
          "From plumbing to web design, explore every category of service offered by vetted pros on Servio.",
      },
    ],
  }),
  loader: () => loadServicesData(),
  component: Services,
});

function Services() {
  const { categories, totalPros } = useLoaderData({ from: "/services" });
  return <ServicesPageContent categories={categories} totalPros={totalPros} />;
}
