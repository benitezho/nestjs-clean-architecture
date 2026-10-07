/** RFC 9457 problem details, plus `code`, `details` and `errors` extension members. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  details?: Record<string, unknown>;
  errors?: { field: string; messages: string[] }[];
}

export interface ProblemResponse {
  problem: ProblemDetails;
  headers: Record<string, string>;
}
