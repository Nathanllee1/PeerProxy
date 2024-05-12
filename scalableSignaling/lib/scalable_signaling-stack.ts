import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from "aws-cdk-lib/aws-ecr"

export class ScalableSignalingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'MyVpc', { maxAzs: 3 });

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'MyCluster', { vpc });

    // Define the task definition with a single container
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'MyTask');

    const repository = new ecr.Repository(this, 'MyRepository', {
      repositoryName: 'my-custom-repo',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete the repo when the stack is destroyed
      imageScanOnPush: true // Enable scanning of images on push
    });

    // Define the container using the Dockerfile in the app directory
    const container = taskDefinition.addContainer('MyContainer', {
      image: ecs.ContainerImage.fromAsset('./app'), // Path to the Docker context
      memoryLimitMiB: 512,
      cpu: 256
    });

    // Map port 8080 of the container
    container.addPortMappings({
      containerPort: 4141
    });

    // Define the Fargate service
    const fargate = new ecs.FargateService(this, 'MyService', {
      cluster,
      taskDefinition,
      assignPublicIp: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    });

    new cdk.CfnOutput(this, 'RespositoryURI', {
      value: repository.repositoryUri
    })
    
    new cdk.CfnOutput(this, 'FargateServiceURL', {
      value: fargate.
    )
  }
}
