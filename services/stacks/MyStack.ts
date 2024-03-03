import { StackContext, Service, StaticSite, Table, WebSocketApi, EventBus } from "sst/constructs";

export function API({ stack }: StackContext) {
  /*
  const service = new Service(stack, "MyService", {
    path: "./service",
    port: 8080,
    
  });
  */

  const bus = new EventBus(stack, "bus", {
    defaults: {
      retries: 10,
    },
  });

  // bus.subscribe("")


  const table = new Table(stack, "Connections", {
    fields: {
      id: "string",
    },
    primaryIndex: { partitionKey: "id" },
  });

  const api = new WebSocketApi(stack, "Api", {
    defaults: {
      function: {
        bind: [table],
      },
    },
    routes: {
      $connect: "serverlessWS/connect.main",
      $disconnect: "serverlessWS/disconnect.main",
      sendmessage: "serverlessWS/sendMessage.main",
    },
  });

  const web = new StaticSite(stack, "web", {
    path: "jsClient/",
    buildOutput: "dist",
    buildCommand: "npm run build",
  })

  stack.addOutputs({
    // serviceURL :service.url,
    webURL: web.url,
    apiUrl: api.url
  })
}
