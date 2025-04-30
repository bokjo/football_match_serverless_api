import { mock } from "node:test";
import { handler } from "./index";
import { EventBridgeClient, PutEventsCommand, EventBridgeServiceException } from "@aws-sdk/client-eventbridge";

jest.mock("@aws-sdk/client-eventbridge", () => {
  const mockSend = jest.fn().mockResolvedValue({
    Entries: [{ EventId: "test-event-id" }],
  });

  return {
    EventBridgeClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutEventsCommand: jest.fn().mockImplementation((params) => params),
    EventBridgeServiceException: jest.fn(),
  };
});

describe("Ingestion Lambda", () => {
  const mockEvent = {
    body: JSON.stringify({
      match_id: "000001",
      event_type: "goal",
      team: "Team A",
      player: "Player 1",
      timestamp: "2023-10-15T14:30:00Z",
    }),
  };

  beforeEach(() => {
    process.env.EVENT_BUS_NAME = "mock-event-bus";
    process.env.EVENT_SOURCE = "mock-event-source";
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Should successfully ingest a valid event", async () => {
    const result = await handler(mockEvent as any);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).message).toBe("Event ingested successfully");

    expect(PutEventsCommand).toHaveBeenCalledWith({
      Entries: [
        {
          Source: "mock-event-source",
          DetailType: "match.goal",
          Detail: mockEvent.body,
          EventBusName: "mock-event-bus",
        },
      ],
    });

    const eventBridgeClient = new EventBridgeClient();
    expect(eventBridgeClient.send).toHaveBeenCalled();
  });

  it("Should return 400 and validation error for missing required fields", async () => {
    const invalidEvent = {
      body: JSON.stringify({
        match_id: "000001",
        // Missing event_type
        team: "Team A",
        player: "Player 1",
        timestamp: "2023-10-15T14:30:00Z",
      }),
    };

    const result = await handler(invalidEvent as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain("[VALIDATION_ERROR] event_type: Invalid event type.");
  });

  it("Should return 400 and validation error for invalid event type", async () => {
    const invalidEvent = {
      body: JSON.stringify({
        match_id: "000001",
        event_type: "invalid_type",
        team: "Team A",
        player: "Player 1",
        timestamp: "2023-10-15T14:30:00Z",
      }),
    };

    const result = await handler(invalidEvent as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain("[VALIDATION_ERROR] event_type: Invalid event type.");
  });

  it("Should return 400 and validation error if match_id is not a string", async () => {
    const invalidEvent = {
      body: JSON.stringify({
        match_id: 123456,
        event_type: "goal",
        team: "Team A",
        player: "Player 1",
        timestamp: "2023-10-15T14:30:00Z",
      }),
    };

    const result = await handler(invalidEvent as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain("[VALIDATION_ERROR] match_id: Expected string, received number");
  });

  it("Should handle error during event ingestion", async () => {
    const mockEventBridgeServiceException = new EventBridgeServiceException({
      name: "EventBridgeServiceException",
      message: "EventBridge error",
      $fault: "server",
      $metadata: { httpStatusCode: 500 },
    });

    const mockClient = new EventBridgeClient();
    const mockSend = mockClient.send as jest.Mock;

    mockSend.mockReset();
    mockSend.mockResolvedValueOnce(mockEventBridgeServiceException);

    const result = await handler(mockEvent as any);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe("Failed to ingest event");
  });
});
