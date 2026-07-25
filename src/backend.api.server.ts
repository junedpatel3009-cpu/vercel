import { handleBackendApi } from "./backend/api.server";

export async function backendApiHandler(request: Request): Promise<Response | null> {
  return handleBackendApi(request);
}

export { handleBackendApi };
