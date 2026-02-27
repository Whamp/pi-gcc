export interface OtaEntryInput {
  turnNumber: number;
  timestamp: string;
  model: string;
  thought: string;
  thinking: string;
  actions: string[];
  observations: string[];
}

export interface MemoryStatusParams {
  level?: string;
  branch?: string;
  commit?: string;
  segment?: string;
}

export interface SubagentResult {
  text: string;
  exitCode: number;
  error?: string;
}
