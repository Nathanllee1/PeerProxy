import { StackContext, Service, StaticSite, Table, WebSocketApi, EventBus } from "sst/constructs";

export function API({ stack }: StackContext) {
  /*
  const service = new Service(stack, "MyService", {
    path: "./service",
    port: 8080,
    
  });
  */

 

  const web = new StaticSite(stack, "web", {
    path: "../jsClient/",
    buildOutput: "dist",
    buildCommand: "npm run build",
  })

  stack.addOutputs({
    // serviceURL :service.url,
    webURL: web.url,
    // apiUrl: api.url
  })
}
