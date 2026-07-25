declare module "@tanstack/react-start/api" {
  export interface ApiRouteContext {
    request: Request;
    params?: Record<string, string>;
  }

  export type ApiRouteHandler = (ctx: ApiRouteContext) => Response | Promise<Response>;

  export interface ApiRouteHandlers {
    GET?: ApiRouteHandler;
    POST?: ApiRouteHandler;
    PATCH?: ApiRouteHandler;
    PUT?: ApiRouteHandler;
    DELETE?: ApiRouteHandler;
    OPTIONS?: ApiRouteHandler;
    HEAD?: ApiRouteHandler;
  }

  export function createAPIFileRoute(path: string): (handlers: ApiRouteHandlers) => {
    path: string;
    handlers: ApiRouteHandlers;
  };
}
