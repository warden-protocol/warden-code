/**
 * OASF (Open Agentic Schema Framework) skill taxonomy.
 * Source: https://schema.oasf.outshift.com/skill_categories
 *
 * Each entry maps an OASF category to keywords used for static matching
 * against agent skill names and descriptions. Only categories relevant
 * to text-based chat agents are included (vision, audio, tabular, and
 * multimodal categories are omitted).
 */

export interface OasfCategory {
  id: number;
  path: string;
  keywords: string[];
}

export const oasfTaxonomy: OasfCategory[] = [
  // ── Natural Language Understanding (101xx) ──────────────────────────
  {
    id: 10101,
    path: "natural_language/understanding/contextual_comprehension",
    keywords: [
      "comprehension",
      "understand context",
      "contextual understanding",
      "reading comprehension",
      "context track",
      "multi-turn",
      "conversation history",
      "session context",
      "follow-up",
    ],
  },
  {
    id: 10102,
    path: "natural_language/understanding/semantic_understanding",
    keywords: [
      "semantic",
      "meaning extraction",
      "semantic parsing",
      "semantic analysis",
      "intent detect",
      "intent recogni",
      "understand intent",
      "slot filling",
      "natural language understand",
      "nlu",
    ],
  },
  {
    id: 10103,
    path: "natural_language/understanding/entity_recognition",
    keywords: [
      "entity recognition",
      "ner",
      "named entity",
      "entity extract",
      "extract entities",
      "parse entities",
    ],
  },

  // ── Natural Language Generation (102xx) ─────────────────────────────
  {
    id: 10201,
    path: "natural_language/generation/text_completion",
    keywords: [
      "text completion",
      "autocomplete",
      "auto-complete",
      "text predict",
      "draft",
      "compose",
      "write email",
      "email draft",
      "write message",
      "copywriting",
      "copywriter",
      "blog writ",
      "article writ",
      "content writ",
      "ghost writ",
      "write blog",
      "write article",
      "write content",
      "write copy",
      "content creat",
    ],
  },
  {
    id: 10202,
    path: "natural_language/generation/text_summarization",
    keywords: [
      "summariz",
      "summarise",
      "summary",
      "tldr",
      "digest",
      "condense text",
      "abstract text",
      "brief",
      "recap",
      "executive summary",
      "key takeaway",
      "key point",
    ],
  },
  {
    id: 10203,
    path: "natural_language/generation/text_paraphrasing",
    keywords: [
      "paraphras",
      "rephras",
      "rewrite",
      "rewording",
      "simplif text",
      "plain language",
    ],
  },
  {
    id: 10204,
    path: "natural_language/generation/dialogue_generation",
    keywords: [
      "dialogue",
      "conversation",
      "chatbot",
      "chat bot",
      "conversational",
      "dialog system",
      "chat agent",
      "virtual assistant",
      "assistant bot",
      "customer support",
      "customer service",
      "helpdesk",
      "help desk",
      "support agent",
      "support bot",
      "service bot",
      "service agent",
      "onboarding",
      "greeting",
      "welcome message",
      "live chat",
      "interactive agent",
    ],
  },
  {
    id: 10205,
    path: "natural_language/generation/question_generation",
    keywords: [
      "question generation",
      "generate question",
      "quiz generat",
      "survey",
      "feedback collect",
      "poll",
      "questionnaire",
    ],
  },
  {
    id: 10206,
    path: "natural_language/generation/text_style_transfer",
    keywords: ["style transfer", "tone transfer", "text style"],
  },
  {
    id: 10207,
    path: "natural_language/generation/story_generation",
    keywords: ["story generation", "generate story", "narrative generat"],
  },

  // ── Information Retrieval and Synthesis (103xx) ─────────────────────
  {
    id: 10301,
    path: "natural_language/information_retrieval/fact_extraction",
    keywords: [
      "fact extraction",
      "extract fact",
      "information extract",
      "extract insight",
      "data extract",
      "parse document",
      "parse pdf",
      "pdf pars",
      "pdf extract",
      "pdf document",
      "document pars",
      "parse email",
      "email pars",
    ],
  },
  {
    id: 10302,
    path: "natural_language/information_retrieval/question_answering",
    keywords: [
      "question answering",
      "q&a",
      "qa system",
      "answer question",
      "faq",
      "frequently asked",
      "ask question",
      "knowledge lookup",
      "help center",
      "support ticket",
      "ticket answer",
    ],
  },
  {
    id: 10303,
    path: "natural_language/information_retrieval/knowledge_synthesis",
    keywords: [
      "knowledge synthesis",
      "synthesiz",
      "knowledge aggregat",
      "research assist",
      "research agent",
      "gather information",
      "knowledge manage",
      "report generat",
      "generate report",
      "data analysis",
      "analyze data",
      "insight",
      "briefing",
    ],
  },
  {
    id: 10304,
    path: "natural_language/information_retrieval/sentence_similarity",
    keywords: [
      "sentence similarity",
      "text similarity",
      "semantic similarity",
      "cosine similarity",
      "duplicate detect",
    ],
  },
  {
    id: 10305,
    path: "natural_language/information_retrieval/document_retrieval",
    keywords: [
      "document retrieval",
      "passage retrieval",
      "doc retrieval",
      "document search",
      "file search",
    ],
  },
  {
    id: 10306,
    path: "natural_language/information_retrieval/search",
    keywords: [
      "search engine",
      "web search",
      "information retrieval",
      "full-text search",
      "fulltext search",
      "news search",
      "news update",
      "weather",
      "look up",
      "find information",
    ],
  },

  // ── Creative Content Generation (104xx) ─────────────────────────────
  {
    id: 10401,
    path: "natural_language/creative_content/storytelling",
    keywords: ["storytelling", "creative writing", "fiction", "narrative"],
  },
  {
    id: 10402,
    path: "natural_language/creative_content/poetry",
    keywords: ["poetry", "poem", "verse", "haiku", "sonnet", "lyric"],
  },

  // ── Language Translation and Multilingual (105xx) ───────────────────
  {
    id: 10501,
    path: "natural_language/translation/translation",
    keywords: [
      "translat",
      "interpreter",
      "localization",
      "localisation",
      "i18n",
    ],
  },
  {
    id: 10502,
    path: "natural_language/translation/multilingual",
    keywords: [
      "multilingual",
      "multi-language",
      "polyglot",
      "cross-lingual",
      "bilingual",
    ],
  },

  // ── Personalisation and Adaptation (106xx) ──────────────────────────
  {
    id: 10601,
    path: "natural_language/personalisation/user_adaptation",
    keywords: [
      "personali",
      "user preference",
      "adaptive",
      "user profil",
      "recommend",
      "suggestion",
      "tailor",
      "custom experience",
    ],
  },
  {
    id: 10602,
    path: "natural_language/personalisation/tone_adjustment",
    keywords: ["tone adjust", "style adjust", "formality", "tone of voice"],
  },

  // ── Analytical and Logical Reasoning (107xx) ────────────────────────
  {
    id: 10701,
    path: "natural_language/reasoning/inference",
    keywords: [
      "inference",
      "deduction",
      "logical reasoning",
      "inductive",
      "deductive",
    ],
  },
  {
    id: 10702,
    path: "natural_language/reasoning/problem_solving",
    keywords: [
      "problem solving",
      "solver",
      "reasoning",
      "analytical reasoning",
      "troubleshoot",
      "diagnos",
      "root cause",
      "triage",
      "technical support",
      "tech support",
      "it support",
      "tutor",
      "coach",
      "teach",
      "mentor",
      "advisor",
      "consult",
      "guidance",
      "instruct",
      "legal review",
      "legal analy",
      "contract review",
      "document review",
    ],
  },
  {
    id: 10703,
    path: "natural_language/reasoning/fact_verification",
    keywords: [
      "fact check",
      "claim verification",
      "verify fact",
      "fact-check",
      "misinformation",
    ],
  },

  // ── Ethical and Safe Interaction (108xx) ─────────────────────────────
  {
    id: 10801,
    path: "natural_language/ethical/bias_mitigation",
    keywords: ["bias", "fairness", "debiasing", "unbias", "equit"],
  },
  {
    id: 10802,
    path: "natural_language/ethical/content_moderation",
    keywords: [
      "content moderation",
      "moderat",
      "safety filter",
      "toxic",
      "harmful content",
      "nsfw",
    ],
  },

  // ── Text Classification (109xx) ─────────────────────────────────────
  {
    id: 10901,
    path: "natural_language/classification/topic_labelling",
    keywords: [
      "topic label",
      "topic tag",
      "categoriz",
      "classif",
      "tagging",
      "label text",
      "route ticket",
      "ticket rout",
      "ticket classif",
      "triage ticket",
      "escalat",
    ],
  },
  {
    id: 10902,
    path: "natural_language/classification/sentiment_analysis",
    keywords: [
      "sentiment",
      "opinion mining",
      "emotion detect",
      "mood analysis",
      "satisfaction",
      "nps",
      "csat",
    ],
  },
  {
    id: 10903,
    path: "natural_language/classification/natural_language_inference",
    keywords: [
      "natural language inference",
      "nli",
      "textual entailment",
      "contradiction detect",
    ],
  },

  // ── Mathematical Reasoning (501xx) ──────────────────────────────────
  {
    id: 50101,
    path: "math_and_coding/mathematical_reasoning/operations",
    keywords: [
      "math",
      "arithmetic",
      "calcul",
      "computation",
      "numerical",
      "financial calcul",
      "currency conver",
      "unit conver",
      "price calcul",
      "billing",
      "invoice",
    ],
  },
  {
    id: 50102,
    path: "math_and_coding/mathematical_reasoning/word_problems",
    keywords: ["word problem", "math problem", "story problem"],
  },

  // ── Coding Skills (502xx) ───────────────────────────────────────────
  {
    id: 50201,
    path: "math_and_coding/coding_skills/text_to_code",
    keywords: [
      "code generat",
      "text to code",
      "coding",
      "programming",
      "write code",
      "code synthesis",
    ],
  },
  {
    id: 50202,
    path: "math_and_coding/coding_skills/code_to_docstrings",
    keywords: [
      "docstring",
      "documentation generat",
      "code document",
      "jsdoc",
      "javadoc",
      "autodoc",
    ],
  },
  {
    id: 50203,
    path: "math_and_coding/coding_skills/code_template",
    keywords: [
      "code template",
      "boilerplate",
      "scaffold",
      "code snippet",
      "starter code",
    ],
  },
  {
    id: 50204,
    path: "math_and_coding/coding_skills/code_refactoring",
    keywords: [
      "refactor",
      "code optimiz",
      "code review",
      "debug",
      "linting",
      "code cleanup",
      "code smell",
    ],
  },

  // ── Retrieval (6xx) ─────────────────────────────────────────────────
  {
    id: 60101,
    path: "retrieval/indexing",
    keywords: [
      "indexing",
      "index build",
      "vector index",
      "embedding index",
      "inverted index",
    ],
  },
  {
    id: 60102,
    path: "retrieval/search",
    keywords: ["search", "retrieval", "lookup", "find information", "query"],
  },
  {
    id: 60103,
    path: "retrieval/document_retrieval",
    keywords: ["document retrieval", "rag", "retrieval augmented", "doc fetch"],
  },
  {
    id: 602,
    path: "retrieval/document_qa",
    keywords: [
      "document qa",
      "database question",
      "knowledge base",
      "ask document",
      "query document",
    ],
  },
  {
    id: 603,
    path: "retrieval/generation",
    keywords: [
      "retrieval generation",
      "retrieval augmented generation",
      "grounded generation",
    ],
  },

  // ── Security (8xx) ──────────────────────────────────────────────────
  {
    id: 801,
    path: "security/threat_detection",
    keywords: [
      "threat detect",
      "intrusion detect",
      "malware",
      "security monitor",
      "threat intel",
      "threat hunt",
    ],
  },
  {
    id: 802,
    path: "security/vulnerability_analysis",
    keywords: [
      "vulnerabilit",
      "security audit",
      "penetration test",
      "pentest",
      "security scan",
      "cve",
      "exploit",
    ],
  },
  {
    id: 803,
    path: "security/secret_leak_detection",
    keywords: [
      "secret leak",
      "credential scan",
      "secret detect",
      "key leak",
      "token leak",
      "exposed secret",
    ],
  },
  {
    id: 804,
    path: "security/privacy_risk",
    keywords: [
      "privacy",
      "pii detect",
      "data protection",
      "gdpr",
      "personal data",
      "anonymiz",
    ],
  },

  // ── Data Operations (9xx) ───────────────────────────────────────────
  {
    id: 901,
    path: "data_operations/data_cleaning",
    keywords: [
      "data clean",
      "data wrangl",
      "data preprocess",
      "data scrub",
      "dedup",
    ],
  },
  {
    id: 902,
    path: "data_operations/schema_inference",
    keywords: [
      "schema infer",
      "schema detect",
      "data schema",
      "schema discover",
      "schema extract",
    ],
  },
  {
    id: 903,
    path: "data_operations/feature_engineering",
    keywords: [
      "feature engineer",
      "feature extract",
      "feature select",
      "feature transform",
    ],
  },
  {
    id: 904,
    path: "data_operations/data_transformation",
    keywords: [
      "data transform",
      "etl",
      "data pipeline",
      "data convert",
      "data migrat",
    ],
  },
  {
    id: 905,
    path: "data_operations/data_quality",
    keywords: ["data quality", "data validat", "data integrit", "data profil"],
  },

  // ── Agent Orchestration (10xx) ──────────────────────────────────────
  {
    id: 1001,
    path: "agent_orchestration/task_decomposition",
    keywords: [
      "task decompos",
      "break down task",
      "subtask",
      "task breakdown",
      "task split",
      "task manag",
      "todo",
      "to-do",
    ],
  },
  {
    id: 1002,
    path: "agent_orchestration/role_assignment",
    keywords: ["role assign", "agent role", "delegate task", "role dispatch"],
  },
  {
    id: 1003,
    path: "agent_orchestration/multi_agent_planning",
    keywords: [
      "multi-agent",
      "multi agent",
      "agent planning",
      "swarm",
      "agent team",
    ],
  },
  {
    id: 1004,
    path: "agent_orchestration/agent_coordination",
    keywords: [
      "agent coordinat",
      "orchestrat",
      "agent collaborat",
      "agent dispatch",
      "escalat",
      "handoff",
      "hand off",
      "transfer to human",
      "human handover",
    ],
  },
  {
    id: 1005,
    path: "agent_orchestration/negotiation",
    keywords: [
      "negotiat",
      "conflict resolut",
      "consensus",
      "mediat",
      "arbitrat",
    ],
  },

  // ── Evaluation and Testing (11xx) ───────────────────────────────────
  {
    id: 1101,
    path: "evaluation/benchmark",
    keywords: ["benchmark", "evaluation", "eval", "leaderboard"],
  },
  {
    id: 1102,
    path: "evaluation/test_case_generation",
    keywords: ["test generat", "test case", "test creat", "test suite"],
  },
  {
    id: 1103,
    path: "evaluation/quality_evaluation",
    keywords: ["quality evaluat", "quality assess", "quality metric"],
  },
  {
    id: 1104,
    path: "evaluation/anomaly_detection",
    keywords: [
      "anomaly detect",
      "outlier detect",
      "anomaly identif",
      "fraud detect",
    ],
  },
  {
    id: 1105,
    path: "evaluation/performance_monitoring",
    keywords: [
      "performance monitor",
      "performance track",
      "latency track",
      "throughput monitor",
    ],
  },

  // ── Infrastructure (12xx) ───────────────────────────────────────────
  {
    id: 1201,
    path: "infrastructure/provisioning",
    keywords: [
      "provision",
      "infrastructure",
      "terraform",
      "cloudformation",
      "pulumi",
      "iac",
    ],
  },
  {
    id: 1202,
    path: "infrastructure/deployment",
    keywords: [
      "deploy",
      "deployment",
      "release manag",
      "rollout",
      "ship to prod",
    ],
  },
  {
    id: 1203,
    path: "infrastructure/ci_cd",
    keywords: [
      "ci/cd",
      "ci cd",
      "continuous integration",
      "continuous delivery",
      "github actions",
      "jenkins",
      "gitlab ci",
    ],
  },
  {
    id: 1204,
    path: "infrastructure/model_versioning",
    keywords: [
      "model version",
      "model registry",
      "model track",
      "mlops",
      "experiment track",
    ],
  },
  {
    id: 1205,
    path: "infrastructure/monitoring",
    keywords: [
      "monitor",
      "alert",
      "observability",
      "logging",
      "tracing",
      "metrics",
      "grafana",
      "prometheus",
    ],
  },

  // ── Governance (13xx) ───────────────────────────────────────────────
  {
    id: 1301,
    path: "governance/policy_mapping",
    keywords: ["policy", "governance", "regulatory", "rule enforcement"],
  },
  {
    id: 1302,
    path: "governance/compliance",
    keywords: ["compliance", "regulation", "sox", "hipaa", "pci"],
  },
  {
    id: 1303,
    path: "governance/audit_trail",
    keywords: ["audit trail", "audit log", "change log", "activity log"],
  },
  {
    id: 1304,
    path: "governance/risk_classification",
    keywords: ["risk classif", "risk assess", "risk score", "risk evaluat"],
  },

  // ── Integration (14xx) ──────────────────────────────────────────────
  {
    id: 1401,
    path: "integration/api_schema",
    keywords: [
      "api schema",
      "openapi",
      "swagger",
      "api spec",
      "graphql schema",
      "rest api",
      "webhook",
      "api integrat",
      "api connect",
    ],
  },
  {
    id: 1402,
    path: "integration/workflow_automation",
    keywords: [
      "workflow automat",
      "automation",
      "automate workflow",
      "zapier",
      "n8n",
      "process automat",
      "schedul",
      "booking",
      "appointment",
      "calendar",
      "reminder",
      "notification",
      "cron",
      "recurring",
    ],
  },
  {
    id: 1403,
    path: "integration/tool_use",
    keywords: [
      "tool use",
      "tool calling",
      "function calling",
      "tool integrat",
      "mcp server",
      "plugin",
      "api call",
      "external service",
      "third-party",
      "third party",
    ],
  },
  {
    id: 1404,
    path: "integration/script_integration",
    keywords: [
      "script integrat",
      "scripting",
      "shell script",
      "bash script",
      "script execut",
    ],
  },

  // ── Strategic Reasoning (15xx) ──────────────────────────────────────
  {
    id: 1501,
    path: "strategic_reasoning/planning",
    keywords: [
      "strategic plan",
      "long-term plan",
      "roadmap",
      "action plan",
      "travel plan",
      "trip plan",
      "itinerary",
      "project plan",
    ],
  },
  {
    id: 1502,
    path: "strategic_reasoning/long_horizon",
    keywords: [
      "long-horizon",
      "long horizon",
      "multi-step reason",
      "long-range plan",
    ],
  },
  {
    id: 1503,
    path: "strategic_reasoning/chain_of_thought",
    keywords: [
      "chain of thought",
      "chain-of-thought",
      "step by step",
      "cot reason",
    ],
  },
  {
    id: 1504,
    path: "strategic_reasoning/hypothesis_generation",
    keywords: [
      "hypothesis",
      "conjecture",
      "theory generat",
      "hypothesis form",
      "brainstorm",
      "ideation",
      "idea generat",
      "generate idea",
    ],
  },
];
