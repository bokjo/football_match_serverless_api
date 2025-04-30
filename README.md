# Football Match Events Serverless Api

This is a serverless application for ingesting, processing, and querying football match event data using AWS services.

## Architecture

The application uses the following AWS services:

- AWS Lambda for serverless compute (x3)
- Amazon API Gateway for REST API endpoints
- Amazon DynamoDB for data storage
- Amazon EventBridge for event routing
- Amazon S3 for optional raw event data storage
- AWS Step Functions for workflow orchestration

## Workflow

1. Match events are sent to the API Gateway `/events` endpoint
2. The ingestion Lambda function publishes the event to EventBridge
3. The processing Lambda function is triggered, enriches the data, and stores it in DynamoDB
4. Users can query match statistics data via REST API `/matches/{match_id}/goals` and `/matches/{match_id}/passes` endpoints
5. Optionally, users can trigger a Step Functions workflow to process input events directly from the API Gateway `/workflow` endpoint

## Prerequisites

- Node.js 20 or higher
- AWS CLI configured with appropriate credentials (`aws configure`, assumes you have `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set up)
- AWS CDK installed and configured (`npm install -g aws-cdk`)

## Environment Setup

Create a `.env` file with the following content in the project root [example](.env.example):

```env
# AWS Account Configuration
AWS_ACCOUNT_ID=your-account-id
AWS_DEFAULT_REGION=eu-central-1

# Application Configuration
ENVIRONMENT=dev
EVENT_BUS_NAME=your-event-bus-name
MATCH_EVENTS_TABLE=your-match-events-table
EVENT_SOURCE=your-event-pattern-source
EVENT_DETAIL_PREFIX="your-match."
```

## Deployment

1. Install dependencies:

   ```sh
   npm install
   ```

2. Build the project:

   ```sh
   npm run build
   ```

3. Bootstrap CDK (if you haven't already):

   ```sh
   cdk bootstrap
   ```

4. Deploy the stack:

   ```sh
   cdk deploy
   ```

The deployment should return the stack output with all the appropriate info.
example:

```sh
Outputs:
example_stack_name_dev.footballeventsmonitoringdashboardurl = ...
example_stack_name_dev.footballmatchapigatewayEndpointXXXXXXXX = ...
example_stack_name_dev.footballmatchapiurl = ...
example_stack_name_dev.footballmatchdynamodbtablename = ...
example_stack_name_dev.footballmatcheventbusname = ...
example_stack_name_dev.footballmatchstatemachinearn = ...
Stack ARN:
arn:aws:cloudformation:...
```

## Testing the API

### Ingesting Match Events

Ingest match events endpoint:

```sh
curl --location 'https://your-api-url/events' \
--header 'Content-Type: application/json' \
--data '{
    "match_id": "000001",
    "event_type": "goal",
    "team": "Team B",
    "player": "Player 8",
    "timestamp": "2023-10-15T14:45:00Z"
}'
```

Example event payload:

```json
{
  "match_id": "000001",
  "event_type": "goal",
  "team": "Team A",
  "player": "Player 1",
  "timestamp": "2023-10-15T14:30:00Z"
}
```

### Querying Match Statistics

Query match statistics endpoints:

```sh
curl https://your-api-url/matches/{match_id}/goals
curl https://your-api-url/matches/{match_id}/passes
```

### Triggering Step Functions Workflow

Trigger Step Functions workflow endpoint:

```sh
curl --location 'https://your-api-url/workflow' \
--header 'Content-Type: application/json' \
--data '{
    "match_id": "000001",
    "event_type": "goal",
    "team": "Team B",
    "player": "Player 42",
    "timestamp": "2023-10-15T14:30:00Z"
}'
```

Example payload (same as ingestion):

```json
{
  "match_id": "000001",
  "event_type": "goal",
  "team": "Team A",
  "player": "Player 1",
  "timestamp": "2023-10-15T14:30:00Z"
}
```

## Postman Collection

A Postman collection is included in the [`postman`](./postman/) directory for testing the API endpoints.

1. Import the collection and environment files into Postman
2. Update the `apiUrl` variable with your deployed API URL (returned in the `cdk deploy` output)
3. Use the collection to test the API endpoints

Example Postman imported collection and documentation can be found on this link [Postman Collection](https://documenter.getpostman.com/view/11688030/2sB2j4fqpj)

## Running Tests

All tests:

```sh
npm test
```

Unit test only:

```sh
npm run test:unit
```

Integration test only:

```sh
npm run test:integration
```

NOTE: The integration tests didn't run properly on MacOS for me due to MacOS Docker Desktop issues

## Cleaning Up

To remove all resources created by the stack:

```sh
cdk destroy
```

## Future Enhancements

- Add authentication and authorization
- Implement rate limiting
- Improve the AWS IAM roles
- Add caching for frequently accessed data
- Change to Amazon MSK (Kafka) for event streaming instead of EventBridge
- Add more complex Step Functions workflows for advanced data processing, raw backup and dead letter queue
