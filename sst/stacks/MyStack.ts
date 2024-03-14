import { StackContext, Service, StaticSite, Table, WebSocketApi, EventBus } from "sst/constructs";

export function API({ stack }: StackContext) {
  const web = new StaticSite(stack, "web", {
    path: "../jsClient/",
    buildOutput: "dist",
    buildCommand: "npm run build",
  })

  stack.addOutputs({
    webURL: web.url,
  })
}
