import { handler } from "./index";
import { DynamoDBClient, DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

jest.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => ({})),
    DynamoDBServiceException: jest.fn(),
  };
});

jest.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue({}),
      }),
    },
    PutCommand: jest.fn().mockImplementation((params) => params),
  };
});

describe("Processing Lambda", () => {
  const mockEvent = {
    detail: {
      match_id: "000001",
      event_type: "goal",
      team: "Team A",
      player: "Player 1",
      timestamp: "2023-10-15T14:30:00Z",
    },
  };

  beforeEach(() => {
    process.env.MATCH_EVENTS_TABLE = "mock-events-table";
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();

    jest.spyOn(Date, "now").mockReturnValue(1634306401000); // 2021-10-15T14:30:01Z
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Should successfully process and store a match event", async () => {
    await handler(mockEvent as any);

    expect(PutCommand).toHaveBeenCalledWith({
      TableName: "mock-events-table",
      Item: expect.objectContaining({
        match_id: "000001",
        event_type: "goal",
        team: "Team A",
        player: "Player 1",
        timestamp: "2023-10-15T14:30:00Z",
        season: "2023-2024",
      }),
    });

    const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());
    expect(dynamoDB.send).toHaveBeenCalled();
  });

  it("Should determine correct season based on timestamp - August to December", async () => {
    const mockEventAugust = {
      ...mockEvent,
      detail: {
        ...mockEvent.detail,
        timestamp: "2023-08-01T14:30:00Z",
      },
    };

    await handler(mockEventAugust as any);

    expect(PutCommand).toHaveBeenCalledWith({
      TableName: "mock-events-table",
      Item: expect.objectContaining({
        season: "2023-2024",
      }),
    });
  });

  it("Should determine correct season based on timestamp - January to July", async () => {
    const mockEventJanuary = {
      ...mockEvent,
      detail: {
        ...mockEvent.detail,
        timestamp: "2024-01-15T14:30:00Z",
      },
    };

    await handler(mockEventJanuary as any);

    expect(PutCommand).toHaveBeenCalledWith({
      TableName: "mock-events-table",
      Item: expect.objectContaining({
        season: "2023-2024",
      }),
    });
  });

  it("Should handle error when event data is invalid", async () => {
    const invalidEvent = {
      ...mockEvent,
      detail: null,
    };

    await expect(handler(invalidEvent as any)).rejects.toThrow("Invalid event data");
  });

  it("Should handle DynamoDB error", async () => {
    const dynamoDBError = new DynamoDBServiceException({
      message: "DynamoDB error",
      name: "DynamoDBServiceException",
      $metadata: { httpStatusCode: 500 },
      $fault: "server",
    });

    const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());
    const mockSend = dynamoDB.send as jest.Mock;
    mockSend.mockReset();
    mockSend.mockRejectedValue(dynamoDBError);

    await expect(handler(mockEvent as any)).rejects.toThrow("Failed to store match event in datastore");
  });
});
