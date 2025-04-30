#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DeployStack } from "../lib/deploy-stack";
import * as dotenv from "dotenv";

dotenv.config();

const app = new cdk.App();

const environment = app.node.tryGetContext("stage") || process.env.ENVIRONMENT || "dev";
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || "eu-central-1";

const stackName = `che-football-match-events-stack-${environment}`;
new DeployStack(app, stackName, {
  description: `Football Match Serverless App [(${environment})]`,
  env: {
    account,
    region,
  },
  tags: {
    app: stackName,
    stage: environment,
    owner: "che-cloud-team",
  },
});

/* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
