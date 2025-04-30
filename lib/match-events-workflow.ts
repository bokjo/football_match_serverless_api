import * as cdk from "aws-cdk-lib";
import * as stepfunctions from "aws-cdk-lib/aws-stepfunctions";
import * as stepfunctionsTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

interface MatchEventsWorkflowProps {
  processingLambda: lambda.Function;
}

export class MatchEventsWorkflow extends Construct {
  public readonly stateMachine: stepfunctions.StateMachine;

  constructor(scope: Construct, id: string, props: MatchEventsWorkflowProps) {
    super(scope, id);

    const extractBody = new stepfunctions.Pass(this, "extract_body", {
      parameters: {
        "data.$": "$.body",
      },
      outputPath: "$.data",
    });

    const useDirectInput = new stepfunctions.Pass(this, "use_direct_input", {
      inputPath: "$",
    });

    const inputChoice = new stepfunctions.Choice(this, "check_input_format")
      .when(stepfunctions.Condition.isPresent("$.body"), extractBody)
      .otherwise(useDirectInput);

    const transformInput = new stepfunctions.Pass(this, "transform_input", {
      parameters: {
        "id.$": "$$.Execution.Id",
        "detail-type": "match.event",
        source: "football_match_events_workflow",
        "time.$": "$$.Execution.StartTime",
        "detail.$": "$",
        region: cdk.Stack.of(this).region,
        account: cdk.Stack.of(this).account,
      },
    });

    const processEvent = new stepfunctionsTasks.LambdaInvoke(this, "process_match_event", {
      lambdaFunction: props.processingLambda,
      resultPath: "$.processResult",
    });

    const errorHandler = new stepfunctions.Pass(this, "error_handler", {
      parameters: {
        "error.$": "$.error",
        "cause.$": "$.cause",
        "originalInput.$": "$",
        timestamp: "$$.Execution.StartTime",
        errorType: "WorkflowProcessingError",
      },
      resultPath: "$.errorInfo",
    });

    const successNotification = new stepfunctions.Pass(this, "success_notification", {
      parameters: {
        status: "success",
        message: "Event processed successfully",
        timestamp: "$$.Execution.StartTime",
        "processResult.$": "$.processResult",
      },
      resultPath: "$.notification",
    });

    // Connect the workflow states
    extractBody.next(transformInput);
    useDirectInput.next(transformInput);

    const processWithErrorHandling = processEvent.addCatch(errorHandler, {
      resultPath: "$.error",
    });

    transformInput.next(processWithErrorHandling);
    processWithErrorHandling.next(successNotification);

    const stateMachineName = "match_events_state_machine";
    this.stateMachine = new stepfunctions.StateMachine(this, stateMachineName, {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(inputChoice),
      timeout: cdk.Duration.seconds(10),
      tracingEnabled: true,
      stateMachineName: stateMachineName,
      comment: "Football match events Workflow",
      logs: {
        destination: new cdk.aws_logs.LogGroup(this, `${stateMachineName}_logs`, {
          logGroupName: `/aws/states/${stateMachineName}`,
          retention: cdk.aws_logs.RetentionDays.THREE_DAYS,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: stepfunctions.LogLevel.ALL,
        includeExecutionData: true,
      },
    });
  }
}
