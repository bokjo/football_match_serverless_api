import { z } from "zod";
import { MatchEventType } from "../types/match-event-type";

export const MatchEventSchema = z.object({
  match_id: z.string().min(1, "Match ID is required"),
  event_type: z.nativeEnum(MatchEventType, {
    errorMap: () => ({ message: `Invalid event type. Must be one of: ${Object.values(MatchEventType).join(", ")}` }),
  }),
  team: z.string().min(1, "Team is required"),
  player: z.string().min(1, "Player is required"),
  timestamp: z.string().datetime({ message: "Timestamp must be in ISO format" }),
});
