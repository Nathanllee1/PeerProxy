import { APIGatewayProxyHandler } from "aws-lambda";
import { Table } from "sst/node/table";
import { DynamoDB, ApiGatewayManagementApi } from "aws-sdk";

const dynamoDb = new DynamoDB.DocumentClient();

const sleep = (ms:number) => {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

export const main: APIGatewayProxyHandler = async (event) => {
  const params = {
    TableName: Table.Connections.tableName,
    Item: {
      id: event.requestContext.connectionId,
    },
  };

  await dynamoDb.put(params).promise();


  const { stage, domainName } = event.requestContext;

  const apiG = new ApiGatewayManagementApi({
    endpoint: `${domainName}/${stage}`,
  });

  console.log(event.requestContext.connectionId)

  try {
    await apiG.postToConnection({ ConnectionId: event.requestContext.connectionId!, 
      Data: JSON.stringify({ id: "foo" }) 
    }).promise();
  } catch(e) {
    console.error(e)
  }
  


  return { statusCode: 200, body: "Connected" };
};