import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as Deploy from "../lib/deploy-stack";

describe("Infrastructure tests", () => {
  let app: cdk.App;
  let stack: Deploy.DeployStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new Deploy.DeployStack(app, "MyTestStack");
    template = Template.fromStack(stack);
  });

  it("Should create DynamoDB Table with correct configuration", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [
        {
          AttributeName: "event_id",
          KeyType: "HASH",
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  it("Should create API Gateway REST API", () => {
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
  });

  it("Should create three Lambda Functions", () => {
    template.resourceCountIs("AWS::Lambda::Function", 3); // Ingestion, Processing, Query
    template.hasResourceProperties("AWS::Lambda::Function", {
      Name: "football_match_ingestion_lambda",
      Runtime: "nodejs22x",
      Handler: "index.handler",
      MemorySize: 128,
      Timeout: 10,
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Name: "football_match_processing_lambda",
      Runtime: "nodejs22x",
      Handler: "index.handler",
      MemorySize: 128,
      Timeout: 10,
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Name: "football_match_query_lambda",
      Runtime: "nodejs22x",
      Handler: "index.handler",
      MemorySize: 128,
      Timeout: 10,
    });
  });

  it("Should create EventBridge Event Bus", () => {
    template.resourceCountIs("AWS::Events::EventBus", 1);
  });
});
