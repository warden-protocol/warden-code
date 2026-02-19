import { oasfTaxonomy } from "./oasf-taxonomy.js";

/**
 * Auto-tag a skill with OASF categories by matching keywords against
 * the skill's name and description. Returns sorted, deduplicated tags
 * in the format "oasf:<path>".
 */
export function tagSkill(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const matches = oasfTaxonomy
    .filter((cat) => cat.keywords.some((kw) => text.includes(kw)))
    .map((cat) => `oasf:${cat.path}`);
  return [...new Set(matches)].sort();
}
