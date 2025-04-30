import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as nodejsLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { MatchEventsWorkflow } from "./match-events-workflow";
import { MonitoringDashboard } from "./monitoring-dashboard";

export class DeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const matchEventsTableName = `match_events_table`;
    const matchEventsTable = new dynamodb.Table(this, matchEventsTableName, {
      partitionKey: { name: "event_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // TODO: [TEMP] development only
    });

    const matchEventsSecondaryIndexName = `idx_secondary_match_id_event_type`;
    matchEventsTable.addGlobalSecondaryIndex({
      indexName: matchEventsSecondaryIndexName,
      partitionKey: { name: "match_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "event_type", type: dynamodb.AttributeType.STRING },
    });

    const eventBusName = `football_match_events_bus`;
    const eventBus = new events.EventBus(this, eventBusName, {
      eventBusName,
      description: "Event Bus for Football Match Events",
    });

    const rawEventsBucketName = `football_match_raw_events_bucket`;
    const rawEventsBucket = new s3.Bucket(this, rawEventsBucketName, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 1. Ingestion Lambda
    const ingestionLambdaName = `football_match_ingestion_lambda`;
    const ingestionLambda = new nodejsLambda.NodejsFunction(this, ingestionLambdaName, {
      functionName: ingestionLambdaName,
      description: "Lambda for Football Match Events Ingestion",
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../src/lambdas/ingestion/index.ts"),
      handler: "handler",
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
        EVENT_SOURCE: process.env.EVENT_SOURCE || `football_match_events`,
        EVENT_DETAIL_PREFIX: process.env.EVENT_DETAIL_PREFIX || "match.",
        RAW_EVENTS_BUCKET: rawEventsBucket.bucketName,
      },
      bundling: {
        externalModules: [
          "@aws-sdk/client-eventbridge",
          "@aws-sdk/client-dynamodb",
          "@aws-sdk/lib-dynamodb",
          "@aws-sdk/client-s3",
        ],
      },
    });
    eventBus.grantPutEventsTo(ingestionLambda);
    rawEventsBucket.grantWrite(ingestionLambda);

    // 2. Processing Lambda
    const processingLambdaName = `football_match_processing_lambda`;
    const processingLambda = new nodejsLambda.NodejsFunction(this, processingLambdaName, {
      functionName: processingLambdaName,
      description: "Lambda for Football Match Events Processing",
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../src/lambdas/processing/index.ts"),
      handler: "handler",
      environment: {
        MATCH_EVENTS_TABLE: matchEventsTable.tableName,
      },
      bundling: {
        externalModules: [
          "@aws-sdk/client-eventbridge",
          "@aws-sdk/client-dynamodb",
          "@aws-sdk/lib-dynamodb",
          "@aws-sdk/client-s3",
        ],
      },
    });
    matchEventsTable.grantWriteData(processingLambda);
    rawEventsBucket.grantWrite(processingLambda);

    // 3. Query Lambda
    const queryLambdaName = `football_match_query_lambda`;
    const queryLambda = new nodejsLambda.NodejsFunction(this, queryLambdaName, {
      functionName: queryLambdaName,
      description: "Lambda for Football Match Events Query",
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../src/lambdas/query/index.ts"),
      handler: "handler",
      environment: {
        MATCH_EVENTS_TABLE: matchEventsTable.tableName,
      },
      bundling: {
        externalModules: [
          "@aws-sdk/client-eventbridge",
          "@aws-sdk/client-dynamodb",
          "@aws-sdk/lib-dynamodb",
          "@aws-sdk/client-s3",
        ],
      },
    });
    matchEventsTable.grantReadData(queryLambda);

    const eventPatternSource = process.env.EVENT_SOURCE || `football_match_events`; // TODO: move to config?
    const eventPatternDetailTypePrefix = "match."; // TODO: move to config?
    const matchEventsTriggerRuleName = `football_match_events_rule`;
    new events.Rule(this, matchEventsTriggerRuleName, {
      eventBus,
      eventPattern: {
        source: [eventPatternSource],
        detailType: [{ prefix: eventPatternDetailTypePrefix } as any],
      },
      targets: [new targets.LambdaFunction(processingLambda)],
    });

    const matchEventsFlowName = `football_match_events_workflow`;
    const matchEventsWorkflow = new MatchEventsWorkflow(this, matchEventsFlowName, {
      processingLambda,
    });

    const apiGatewayName = `football_match_api_gateway`;
    const api = new apigateway.RestApi(this, apiGatewayName, {
      description: "Football Match Events API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS, // TODO: restrict to specific methods
      },
    });

    // API
    // Events ingestion endpoint
    const eventsResource = api.root.addResource("events");
    eventsResource.addMethod("POST", new apigateway.LambdaIntegration(ingestionLambda));

    // Matches endpoints
    const matchesResource = api.root.addResource("matches");
    const matchIdResource = matchesResource.addResource("{match_id}");

    const goalsResource = matchIdResource.addResource("goals");
    goalsResource.addMethod("GET", new apigateway.LambdaIntegration(queryLambda));

    const passesResource = matchIdResource.addResource("passes");
    passesResource.addMethod("GET", new apigateway.LambdaIntegration(queryLambda));

    const workflowResource = api.root.addResource("workflow");
    const apiGWStepFunctionsIntegration = new apigateway.AwsIntegration({
      service: "states",
      action: "StartExecution",
      options: {
        credentialsRole: new iam.Role(this, "football_events_step_functions_role", {
          assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
          managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AWSStepFunctionsFullAccess")],
        }),
        requestTemplates: {
          "application/json": `{
            "input": "$util.escapeJavaScript($input.body)",
            "stateMachineArn": "${matchEventsWorkflow.stateMachine.stateMachineArn}"
          }`,
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": `{
                "executionArn": "$input.path('$')",
                "startDate": "$context.requestTime"
              }`,
            },
          },
        ],
      },
    });

    workflowResource.addMethod("POST", apiGWStepFunctionsIntegration, {
      methodResponses: [
        {
          statusCode: "200",
          responseModels: {
            "application/json": apigateway.Model.EMPTY_MODEL,
          },
        },
      ],
    });

    const monitoringDashboard = new MonitoringDashboard(this, "football_events_monitoring_dashboard", {
      ingestionLambda,
      processingLambda,
      queryLambda,
      dynamoTable: matchEventsTable,
      api,
      eventBus,
    });

    new cdk.CfnOutput(this, "football_match_api_url", {
      value: api.url,
      description: "Football Match API URL",
    });

    new cdk.CfnOutput(this, "football_match_event_bus_name", {
      value: eventBus.eventBusName,
      description: "Football Match Event Bus Name",
    });

    new cdk.CfnOutput(this, "football_match_dynamo_db_table_name", {
      value: matchEventsTable.tableName,
      description: "Match Events DynamoDB Table Name",
    });

    new cdk.CfnOutput(this, "football_match_state_machine_arn", {
      value: matchEventsWorkflow.stateMachine.stateMachineArn,
      description: "Match Events State Machine ARN",
    });

    new cdk.CfnOutput(this, "football_events_monitoring_dashboard_url", {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards/dasbboard/${monitoringDashboard.node.id}`,
      description: "Football Events Monitoring Dashboard URL",
    });
  }
}
