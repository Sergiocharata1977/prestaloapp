export type ToolName = string;

export type ActionResult =
  | "success"
  | "error"
  | "blocked"
  | "pending_approval"
  | "approved"
  | "rejected";

export type BlockReason = "TOOL_NOT_ALLOWED" | "REJECTED_BY_ADMIN";

export type EffectivePolicy = {
  allowed_tools: ToolName[];
  require_approval_for: ToolName[];
};

export type TerminalContext = {
  terminal_id: string;
  personnel_id: string | null;
  puesto_id: string | null;
  departamento_id: string | null;
};

export type TerminalActionLog = TerminalContext & {
  organization_id: string;
  tool: ToolName;
  params: Record<string, unknown>;
  result: ActionResult;
  duration_ms?: number;
  proceso_id?: string;
  required_approval?: boolean;
  justification?: string;
  block_reason?: BlockReason;
  approved_by?: string | null;
  timestamp: FirebaseFirestore.Timestamp;
};
