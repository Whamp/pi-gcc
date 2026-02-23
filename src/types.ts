export interface OtaEntryInput {
  turnNumber: number;
  timestamp: string;
  model: string;
  thought: string;
  thinking: string;
  actions: string[];
  observations: string[];
}
