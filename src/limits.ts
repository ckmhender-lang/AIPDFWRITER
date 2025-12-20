export type Plan = 'free' | 'pro' | 'business' | 'enterprise';

export type PlanLimits = {
  maxPagesPerDocument: number;
};

export function getPlanFromHeaders(headers: Record<string, unknown>): Plan {
  const raw = headers['x-plan'];
  if (typeof raw !== 'string') return 'free';
  const plan = raw.trim().toLowerCase();
  if (plan === 'pro' || plan === 'business' || plan === 'enterprise' || plan === 'free') return plan;
  return 'free';
}

export function getLimitsForPlan(plan: Plan): PlanLimits {
  switch (plan) {
    case 'pro':
      return { maxPagesPerDocument: 200 };
    case 'business':
      return { maxPagesPerDocument: 500 };
    case 'enterprise':
      return { maxPagesPerDocument: 2000 };
    case 'free':
    default:
      return { maxPagesPerDocument: 25 };
  }
}
