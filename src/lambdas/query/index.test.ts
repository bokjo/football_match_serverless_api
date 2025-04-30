import { handler } from "./index";
import { DynamoDBClient, DynamoDBServiceException, Select } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

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
    QueryCommand: jest.fn().mockImplementation((params) => params),
  };
});

describe("Query Lambda", () => {
  beforeEach(() => {
    process.env.MATCH_EVENTS_TABLE = "mock-events-table";
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Should successfully query goals for a match", async () => {
    const mockEvent = {
      pathParameters: {
        match_id: "000001",
      },
      path: "/matches/000001/goals",
    };

    const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());
    const mockSend = dynamoDB.send as jest.Mock;

    mockSend.mockReset();
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          event_id: "000001#goal#1634306401000",
          match_id: "000001",
          event_type: "goal",
          team: "Team A",
          player: "Player 1",
          timestamp: "2023-10-15T14:30:00Z",
        },
      ],
      Count: 1,
    });

    const result = await handler(mockEvent as any);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.data.match_id).toBe("000001");
    expect(responseBody.data.total).toBe(1);

    expect(QueryCommand).toHaveBeenCalledWith({
      TableName: "mock-events-table",
      IndexName: "idx_secondary_match_id_event_type",
      KeyConditionExpression: "match_id = :matchId AND event_type = :eventType",
      ExpressionAttributeValues: {
        ":matchId": "000001",
        ":eventType": "goal",
      },
      Select: "COUNT",
    });

    expect(dynamoDB.send).toHaveBeenCalled();
  });

  it("Should successfully query passes for a match", async () => {
    const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());
    (dynamoDB.send as jest.Mock).mockResolvedValueOnce({
      Items: [
        {
          event_id: "000001#pass#1634306401000",
          match_id: "000001",
          event_type: "pass",
          team: "Team A",
          player: "Player 2",
          timestamp: "2023-10-15T14:32:00Z",
        },
      ],
      Count: 1,
    });

    const mockEvent = {
      pathParameters: {
        match_id: "000001",
      },
      path: "/matches/000001/passes",
    };

    const result = await handler(mockEvent as any);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);

    expect(responseBody.data.match_id).toBe("000001");
    expect(responseBody.data.total).toBe(1);

    expect(QueryCommand).toHaveBeenCalledWith({
      TableName: "mock-events-table",
      IndexName: "idx_secondary_match_id_event_type",
      KeyConditionExpression: "match_id = :matchId AND event_type = :eventType",
      ExpressionAttributeValues: {
        ":matchId": "000001",
        ":eventType": "pass",
      },
      Select: "COUNT",
    });
  });

  it("Should return 400 for missing match_id", async () => {
    const mockEvent = {
      pathParameters: {},
      path: "/matches//goals",
    };

    const result = await handler(mockEvent as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe("Missing match_id parameter");
  });

  it("Should return 400 for invalid endpoint path", async () => {
    const mockEvent = {
      pathParameters: {
        match_id: "000001",
      },
      path: "/matches/000001/invalid_stat",
    };

    const result = await handler(mockEvent as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain("Invalid endpoint");
  });

  it("Should handle DynamoDB query error", async () => {
    const dynamoError = new DynamoDBServiceException({
      message: "DynamoDB error",
      name: "DynamoDBServiceException",
      $metadata: { httpStatusCode: 500 },
      $fault: "server",
    });

    const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());
    const mockSend = dynamoDB.send as jest.Mock;

    mockSend.mockReset();
    mockSend.mockRejectedValueOnce(dynamoError);

    const mockEvent = {
      pathParameters: {
        match_id: "000001",
      },
      path: "/matches/000001/goals",
    };

    const result = await handler(mockEvent as any);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe("Failed to query match statistics from datastore");
  });
});
