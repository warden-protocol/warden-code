import { describe, it, expect } from "vitest";
import { tagSkill } from "./oasf-tagger.js";

describe("tagSkill", () => {
  it("should return empty array when no keywords match", () => {
    const tags = tagSkill("Greeter", "Says hello to users");
    expect(tags).toEqual([]);
  });

  it("should match a single category from skill name", () => {
    const tags = tagSkill("Code Generator", "Produces output");
    expect(tags).toContain("oasf:math_and_coding/coding_skills/text_to_code");
  });

  it("should match a single category from skill description", () => {
    const tags = tagSkill("Helper", "Translates text between languages");
    expect(tags).toContain("oasf:natural_language/translation/translation");
  });

  it("should match multiple categories", () => {
    const tags = tagSkill(
      "DevOps Assistant",
      "Handles deployment and monitoring of infrastructure",
    );
    expect(tags).toContain("oasf:infrastructure/deployment");
    expect(tags).toContain("oasf:infrastructure/monitoring");
    expect(tags).toContain("oasf:infrastructure/provisioning");
  });

  it("should be case-insensitive", () => {
    const tags = tagSkill("SUMMARIZER", "CREATES SUMMARIES OF TEXT");
    expect(tags).toContain(
      "oasf:natural_language/generation/text_summarization",
    );
  });

  it("should return sorted tags", () => {
    const tags = tagSkill(
      "Security Scanner",
      "Detects vulnerabilities and malware threats",
    );
    const sorted = [...tags].sort();
    expect(tags).toEqual(sorted);
  });

  it("should not produce duplicates", () => {
    const tags = tagSkill("Summarizer", "Summarizes and creates summaries");
    const unique = [...new Set(tags)];
    expect(tags).toEqual(unique);
  });

  it("should match coding keywords", () => {
    const tags = tagSkill("Refactoring Bot", "Refactors and debugs code");
    expect(tags).toContain(
      "oasf:math_and_coding/coding_skills/code_refactoring",
    );
  });

  it("should match security keywords", () => {
    const tags = tagSkill(
      "Privacy Guard",
      "Detects PII and protects data privacy",
    );
    expect(tags).toContain("oasf:security/privacy_risk");
  });

  it("should match data operations keywords", () => {
    const tags = tagSkill("ETL Runner", "Runs ETL data pipelines");
    expect(tags).toContain("oasf:data_operations/data_transformation");
  });

  it("should match agent orchestration keywords", () => {
    const tags = tagSkill("Orchestrator", "Coordinates multi-agent workflows");
    expect(tags).toContain("oasf:agent_orchestration/agent_coordination");
    expect(tags).toContain("oasf:agent_orchestration/multi_agent_planning");
  });

  it("should match integration keywords", () => {
    const tags = tagSkill(
      "API Connector",
      "Understands OpenAPI schemas with tool calling support",
    );
    expect(tags).toContain("oasf:integration/api_schema");
    expect(tags).toContain("oasf:integration/tool_use");
  });
});
