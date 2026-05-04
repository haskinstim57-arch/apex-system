// In-memory dedup guard for workflow executions.
// Prevents the same (workflowId, contactId) pair from executing twice within 2 minutes.
// This is a safety net for multi-trigger scenarios (e.g., Facebook leads fire multiple trigger types).

const _recentExecutions = new Map<string, number>();
const DEDUP_WINDOW_MS = 2 * 60 * 1000;

export function checkAndMarkWorkflowExecution(workflowId: number, contactId: number): boolean {
  const key = `${workflowId}:${contactId}`;
  const now = Date.now();
  const last = _recentExecutions.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return false; // duplicate — skip
  _recentExecutions.set(key, now);
  if (_recentExecutions.size > 1000) {
    for (const [k, t] of _recentExecutions) {
      if (now - t > DEDUP_WINDOW_MS) _recentExecutions.delete(k);
    }
  }
  return true; // OK to execute
}
