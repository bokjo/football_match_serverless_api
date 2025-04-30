import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";

interface MonitoringDashboardProps {
  ingestionLambda: lambda.Function;
  processingLambda: lambda.Function;
  queryLambda: lambda.Function;
  dynamoTable: dynamodb.Table;
  api: apigateway.RestApi;
  eventBus: events.EventBus;
}

export class MonitoringDashboard extends Construct {
  constructor(scope: Construct, id: string, props: MonitoringDashboardProps) {
    super(scope, id);

    const dashboardName = "football_match_events_dashboard";
    const dashboard = new cloudwatch.Dashboard(this, dashboardName, { dashboardName });

    const lambdaErrorsWidget = new cloudwatch.GraphWidget({
      title: "Lambda Errors",
      left: [
        props.ingestionLambda.metricErrors({ statistic: "sum" }),
        props.processingLambda.metricErrors({ statistic: "sum" }),
        props.queryLambda.metricErrors({ statistic: "sum" }),
      ],
      width: 12,
    });

    const lambdaInvocationsWidget = new cloudwatch.GraphWidget({
      title: "Lambda Invocations",
      left: [
        props.ingestionLambda.metricInvocations({ statistic: "sum" }),
        props.processingLambda.metricInvocations({ statistic: "sum" }),
        props.queryLambda.metricInvocations({ statistic: "sum" }),
      ],
      width: 12,
    });

    const lambdaDurationWidget = new cloudwatch.GraphWidget({
      title: "Lambda Duration",
      left: [
        props.ingestionLambda.metricDuration({ statistic: "avg" }),
        props.processingLambda.metricDuration({ statistic: "avg" }),
        props.queryLambda.metricDuration({ statistic: "avg" }),
      ],
      width: 12,
    });

    const dynamoDBReadCapacityWidget = new cloudwatch.GraphWidget({
      title: "DynamoDB Read Cap.",
      left: [props.dynamoTable.metricConsumedReadCapacityUnits({ statistic: "sum" })],
      width: 12,
    });

    const dynamoDBWriteCapacityWidget = new cloudwatch.GraphWidget({
      title: "DynamoDB Write Cap.",
      left: [props.dynamoTable.metricConsumedWriteCapacityUnits({ statistic: "sum" })],
      width: 12,
    });

    const apiGatewayLatencyWidget = new cloudwatch.GraphWidget({
      title: "API Gateway Latency",
      left: [props.api.metricLatency({ statistic: "avg" }), props.api.metricIntegrationLatency({ statistic: "avg" })],
      width: 12,
    });

    // TODO: add separate widgets for 4xx and 5xx?
    const apiGatewayRequestsWidget = new cloudwatch.GraphWidget({
      title: "API Gateway Requests",
      left: [props.api.metricCount({ statistic: "sum" })],
      width: 12,
    });

    const eventBridgeInvocationsWidget = new cloudwatch.GraphWidget({
      title: "EventBridge Invocations",
      left: [
        new cloudwatch.Metric({
          namespace: "AWS/Events",
          metricName: "Invocations",
          dimensionsMap: { EventBusName: props.eventBus.eventBusName },
          statistic: "sum",
        }),
      ],
      width: 12,
    });

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Football Match Events Monitoring Dashboard",
        width: 24,
        height: 2,
      }),
      lambdaInvocationsWidget,
      lambdaErrorsWidget,
      lambdaDurationWidget,
      dynamoDBReadCapacityWidget,
      dynamoDBWriteCapacityWidget,
      apiGatewayLatencyWidget,
      apiGatewayRequestsWidget,
      eventBridgeInvocationsWidget,
    );
  }
}
