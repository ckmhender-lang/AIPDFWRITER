export type AnalyticsEvent = {
  id: string;
  type: string;
  userId: string | null;
  createdAt: string;
  data: Record<string, unknown>;
};

const events: AnalyticsEvent[] = [];

export function trackEvent(input: {
  type: string;
  userId: string | null;
  data?: Record<string, unknown>;
}): AnalyticsEvent {
  const evt: AnalyticsEvent = {
    id: `evt_${crypto.randomUUID()}`,
    type: input.type,
    userId: input.userId,
    createdAt: new Date().toISOString(),
    data: input.data ?? {},
  };
  events.unshift(evt);
  // prevent unbounded memory growth in this in-memory MVP
  if (events.length > 5000) events.length = 5000;
  return evt;
}

export function listEvents(limit = 100): AnalyticsEvent[] {
  return events.slice(0, Math.max(1, Math.min(1000, limit)));
}

export function getLatestEvent(): AnalyticsEvent | null {
  return events[0] ?? null;
}
