import { createFileRoute, redirect } from "@tanstack/react-router";

// Keep previously shared professional direct-hire links working while the
// tracker lives on the original project-tracking route.
export const Route = createFileRoute("/hire-track/$contractId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/project-track/$trackingId",
      params: { trackingId: params.contractId },
      replace: true,
    });
  },
  component: () => null,
});
