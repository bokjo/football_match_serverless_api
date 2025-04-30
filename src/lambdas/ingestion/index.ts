import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { EventBridgeClient, PutEventsCommand, EventBridgeServiceException } from "@aws-sdk/client-eventbridge";
import { BadRequestResponse, CreatedResponse, InternalServerErrorResponse } from "../../responses";
import { MatchEventSchema } from "../../validation";
import { ZodError } from "zod";

const eventBridgeClient = new EventBridgeClient();
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "default";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    let body = null;

    try {
      body = JSON.parse(event.body!);
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new BadRequestResponse("Invalid JSON input format");
    }

    if (!body) {
      return new BadRequestResponse("Request body is required");
    }

    try {
      MatchEventSchema.parse(body);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      if (validationError instanceof ZodError) {
        const errorMessages = validationError.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return new BadRequestResponse(`[VALIDATION_ERROR] ${errorMessages}`);
      }
      return new BadRequestResponse(`Invalid event input: ${validationError}`);
    }

    const eventSource = process.env.EVENT_SOURCE || "football_match_events"; // TODO: load from config
    const eventDetailPrefix = process.env.EVENT_DETAIL_PREFIX || "match."; // TODO: load from config
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: eventSource,
          DetailType: `${eventDetailPrefix}${body.event_type}`,
          Detail: JSON.stringify(body),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });

    console.log("Publishing event to EventBridge:", command);

    const result = await eventBridgeClient.send(command);

    console.log("Event published to EventBridge:", result);

    // TODO: Optional: push the event to the S3 raw events bucket or optionally add StepFunction/ApiGateway integration!

    const eventId = result.Entries && result.Entries[0].EventId;
    if (!eventId) {
      return new InternalServerErrorResponse(`Failed to ingest event`);
    }

    return new CreatedResponse("Event ingested successfully", { eventId });
  } catch (error) {
    if (error instanceof EventBridgeServiceException) {
      console.error("EventBridge error:", error);
      return new InternalServerErrorResponse(`Failed to ingest event`);
    }

    console.error("Error ingesting match event:", error);
    return new InternalServerErrorResponse("Unexpected error occurred while ingesting event");
  }
};
