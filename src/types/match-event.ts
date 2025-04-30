import { MatchEventType } from "./match-event-type";

export interface MatchEvent {
  match_id: string;
  event_type: MatchEventType;
  team: string;
  player: string;
  timestamp: string;
}

export interface EnrichedMatchEvent extends MatchEvent {
  event_id: string;
  processed_at: string;
  season: string;
}
