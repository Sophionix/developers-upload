export async function emitMetric(
  metricName: string,
  value: number,
  _unit: "Count" | "Milliseconds" | "Percent" = "Count",
  _dimensions: Record<string, string> = {},
): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  console.debug(`[metric] ${metricName}=${value}`);
}
