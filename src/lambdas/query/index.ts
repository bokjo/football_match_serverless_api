import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BadRequestResponse, InternalServerErrorResponse, NotFoundResponse, SuccessResponse } from "../../responses";
import { MatchEventType } from "../../types";

interface StatisticsResponse {
  match_id: string;
  total: number;
}

const client = new DynamoDBClient();
const dynamoDB = DynamoDBDocumentClient.from(client);
const MATCH_EVENTS_TABLE = process.env.MATCH_EVENTS_TABLE || "default";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`API Gateway event: ${JSON.stringify(event)}`);

    const matchId = event.pathParameters?.match_id;
    const path = event.path;

    if (!matchId) {
      return new BadRequestResponse("Missing match_id parameter");
    }

    let eventType: MatchEventType;

    // TODO: initial implementation, dynamically map the path to the event type based on retrieved API Gateway configuration?
    if (path.includes("/goals")) {
      eventType = MatchEventType.goal;
    } else if (path.includes("/passes")) {
      eventType = MatchEventType.pass;
    } else {
      return new BadRequestResponse(
        "Invalid endpoint. Available oneof: ['/matches/{match_id}/goals', '/matches/{match_id}/passes']", // TODO: get all the available endpoints from API GW/Stack Ref.?
      );
    }

    const queyMatchByEventTypeCommand = new QueryCommand({
      TableName: MATCH_EVENTS_TABLE,
      IndexName: process.env.EVENT_TYPE_INDEX || `idx_secondary_match_id_event_type`, // TODO: get it from the stack ref. directly somehow? or ENV. var!
      KeyConditionExpression: "match_id = :matchId AND event_type = :eventType",
      ExpressionAttributeValues: {
        ":matchId": matchId,
        ":eventType": eventType,
      },
      Select: "COUNT",
    });

    // TODO: check and count only if the match_id exists in DDB, if not return 404 NotFound?

    const result = await dynamoDB.send(queyMatchByEventTypeCommand);
    const count = result.Count || 0;

    const payload: StatisticsResponse = { match_id: matchId, total: count };

    return new SuccessResponse(`Match: ${matchId} statistics retrieved successfully`, payload);
  } catch (error) {
    if (error instanceof DynamoDBServiceException) {
      console.error("DynamoDB error:", error);
      return new InternalServerErrorResponse("Failed to query match statistics from datastore");
    }

    console.error("Error querying match statistics:", error);
    return new InternalServerErrorResponse("Unexpected error occurred while querying match statistics");
  }
};
