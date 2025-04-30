import { EventBridgeEvent } from "aws-lambda";
import { DynamoDBClient, DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { MatchEvent } from "../../types";

const client = new DynamoDBClient();
const dynamoDB = DynamoDBDocumentClient.from(client);
const MATCH_EVENTS_TABLE = process.env.MATCH_EVENTS_TABLE || "default";

function determineSeason(timestamp: string): string {
  const date = new Date(timestamp);

  if (isNaN(date.getTime())) {
    console.error(`Invalid timestamp: ${timestamp}`);
    return "unknown-unknown";
  }

  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 7) {
    return `${year}-${year + 1}`; // Aug-Dec
  }

  return `${year - 1}-${year}`; // Jan-Jul
}

export const handler = async (event: EventBridgeEvent<string, MatchEvent>): Promise<void> => {
  try {
    console.log(`Received event: ${JSON.stringify(event)}`);

    const matchEvent = event.detail;

    if (!matchEvent || !matchEvent.match_id) {
      throw new Error("Invalid event data"); // TODO: convert to a proper Validation error type
    }

    const season = determineSeason(matchEvent.timestamp);

    const eventId = `${matchEvent.match_id}#${matchEvent.event_type}#${Date.now()}`; // TODO: use UUIDv7 or let the database generate it?

    interface MatchEventModel {
      event_id: string;
      event_type: string;
      match_id: string;
      player: string;
      processed_at: string;
      season: string;
      team: string;
      timestamp: string;
    }

    const matchEventItem: MatchEventModel = {
      event_id: eventId,
      event_type: matchEvent.event_type,
      match_id: matchEvent.match_id,
      player: matchEvent.player,
      processed_at: new Date().toISOString(),
      season,
      team: matchEvent.team,
      timestamp: matchEvent.timestamp,
    };

    const command = new PutCommand({ TableName: MATCH_EVENTS_TABLE, Item: matchEventItem });

    await dynamoDB.send(command);

    console.log("Successfully stored match event in DynamoDB:", matchEventItem);
  } catch (error) {
    // TODO: if storing in DynamoDB fails, save the event to a dead letter queue or a special folder in S3 raw events bucket?
    if (error instanceof DynamoDBServiceException) {
      console.error("DynamoDB error:", error);
      throw new Error("Failed to store match event in datastore");
    }

    console.error("Error processing match event:", error);
    throw error;
  }
};
