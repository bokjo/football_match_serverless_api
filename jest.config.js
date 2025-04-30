module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test", "<rootDir>/src/lambdas"],
  testMatch: ["**/*.(test|spec).ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};

process.env = Object.assign(process.env, {
  EVENT_BUS_NAME: "mock-event-bus",
  EVENT_SOURCE: "mock-event-source",
  MATCH_EVENTS_TABLE: "mock-events-table",
});
