import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "@/lib/current-user.server";
import { Landing } from "@/client/index";
import { logoutAction } from "@/lib/logout.server";
import { getFavoriteJobIds, getOpenClientJobs } from "@/lib/job-db.server";
import { getProfessionalUsers } from "@/lib/user-db.server";
import { getProfessionalVerificationByUserId } from "@/lib/pro-verification-db.server";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = getCurrentUser();
  return user;
});

const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const user = getCurrentUser();
  const { getPublishedWebsitePage } = await import("@/lib/website-page-cms.server");
  const editorPage = getPublishedWebsitePage("home");

  return {
    homeIntroHtml: editorPage ? extractFirstSection(editorPage.content) : null,
    openJobs: getOpenClientJobs(),
    favoriteJobIds: user ? getFavoriteJobIds(user.id) : [],
    professionals: getProfessionalUsers().map((professional) => ({
      ...professional,
      verification: getProfessionalVerificationByUserId(professional.id),
    })),
  };
});

function extractFirstSection(content: string) {
  const section = content.match(/<section\b[\s\S]*?<\/section>/i)?.[0];
  return section || content;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Servio — Find Trusted Professionals Near You" },
      {
        name: "description",
        content: "Post jobs, hire experts, track work, and manage projects in one platform.",
      },
    ],
  }),
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    return { user, logout: logoutAction };
  },
  loader: () => getHomeData(),
  component: Home,
});

function Home() {
  return <Landing />;
}
