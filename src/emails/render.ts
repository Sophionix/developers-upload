export class TemplateRenderError extends Error {
  readonly code = "TEMPLATE_RENDER_ERROR" as const;
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`template_missing_vars:${missing.join(",")}`);
    this.name = "TemplateRenderError";
    this.missing = missing;
  }
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractVars(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(VAR_RE)) {
    const name = m[1];
    if (name) out.add(name);
  }
  return [...out];
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | number>,
  declared: string[],
): string {
  const referenced = extractVars(template);
  const missing = referenced.filter(
    (v) => !declared.includes(v) || vars[v] === undefined,
  );
  if (missing.length > 0) throw new TemplateRenderError(missing);
  return template.replace(VAR_RE, (_m, name: string) => String(vars[name] ?? ""));
}
