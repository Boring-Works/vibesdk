import { 
    AgentActionKey, 
    AgentConfig, 
    AgentConstraintConfig, 
    AIModels,
    AllModels,
    LiteModels,
    RegularModels,
} from "./config.types";
import { env } from 'cloudflare:workers';

// Common configs shared by both platform and default configs
// Uses Gemini models so DEFAULT_AGENT_CONFIG works without Workers AI
const COMMON_AGENT_CONFIGS = {
    screenshotAnalysis: {
        name: AIModels.DISABLED,
        reasoning_effort: 'medium' as const,
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    realtimeCodeFixer: {
        name: AIModels.DISABLED,
        reasoning_effort: 'low' as const,
        max_tokens: 32000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    fastCodeFixer: {
        name: AIModels.DISABLED,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.0,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 2000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
        temperature: 1,
    },
} as const;

// No longer used -- each agent has its own config with doc-recommended temps
// Kept for DEFAULT_AGENT_CONFIG only
const SHARED_IMPLEMENTATION_CONFIG = {
    reasoning_effort: 'low' as const,
    max_tokens: 48000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_2_5_PRO,
};

//======================================================================================
// Platform config for build.getboring.io
// Workers AI models (free) + OpenRouter (Claude 4.6) for high-impact agents
// Requires PLATFORM_MODEL_PROVIDERS env var to activate
//======================================================================================
const PLATFORM_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    // --- Temperatures from each model creator's official docs ---
    // --- Best model per task, second-best as fallback ---

    // TEMPLATE SELECTION: needs speed + tool calling, not intelligence
    // Granite Micro: cheapest ($0.017/M), 131K, industry-leading tool calling at 3B
    // IBM docs: temp 0.0 for deterministic task-focused work
    templateSelection: {
        name: AIModels.GRANITE_4_MICRO,
        max_tokens: 2000,
        fallbackModel: AIModels.GLM_4_7_FLASH,
        temperature: 0.0,
    },

    // BLUEPRINT: needs best reasoning for architecture decisions
    // GPT-OSS 120B: near o4-mini reasoning, 128K context, $0.35/M input -- FREE on Workers AI
    blueprint: {
        name: AIModels.GPT_OSS_120B,
        reasoning_effort: 'high',
        max_tokens: 20000,
        fallbackModel: AIModels.KIMI_K2_5, // 256K fallback
        temperature: 1.0, // OpenAI reasoning models need full distribution
    },

    // PROJECT SETUP: needs tool calling + multi-step orchestration
    // Nemotron 3: hybrid MoE, multi-agent orchestration, 50% faster throughput
    // NVIDIA docs: temp 0.6 for tool calling
    projectSetup: {
        name: AIModels.NEMOTRON_3_120B,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        fallbackModel: AIModels.KIMI_K2_5,
        temperature: 0.6,
    },

    // PHASE GENERATION: needs 256K context for full codebase + reasoning for planning
    // Kimi K2.5: 256K context, reasoning, tool calling
    // Moonshot docs: temp 0.6 for Instant mode (code planning)
    phaseGeneration: {
        name: AIModels.KIMI_K2_5,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        fallbackModel: AIModels.GPT_OSS_120B,
        temperature: 0.6,
    },

    // PHASE IMPLEMENTATION: needs large context + strong code generation
    // Kimi K2.5: 256K for full codebase context during implementation
    // Moonshot docs: temp 0.6 for code generation
    firstPhaseImplementation: {
        name: AIModels.KIMI_K2_5,
        reasoning_effort: 'low',
        max_tokens: 48000,
        fallbackModel: AIModels.NEMOTRON_3_120B,
        temperature: 0.6,
    },
    phaseImplementation: {
        name: AIModels.KIMI_K2_5,
        reasoning_effort: 'low',
        max_tokens: 48000,
        fallbackModel: AIModels.NEMOTRON_3_120B,
        temperature: 0.6,
    },

    // CONVERSATIONAL: needs speed + quality for user-facing chat
    // GLM Flash: fast, cheap ($0.06/M), 131K, reasoning, multilingual
    // Zhipu docs: temp 0.7 for agentic/coding conversations
    conversationalResponse: {
        name: AIModels.GLM_4_7_FLASH,
        reasoning_effort: 'low',
        max_tokens: 4000,
        fallbackModel: AIModels.MISTRAL_SMALL_31, // 128K, vision, 150 tok/s
        temperature: 0.7,
    },

    // DEEP DEBUGGER: needs strongest reasoning for root cause analysis
    // DeepSeek R1 Distill: outperforms o1-mini, 80K context -- FREE on Workers AI
    deepDebugger: {
        name: AIModels.DEEPSEEK_R1_DISTILL,
        reasoning_effort: 'high',
        max_tokens: 8000,
        fallbackModel: AIModels.GPT_OSS_120B,
        temperature: 0.6, // DeepSeek docs: 0.5-0.7 for reasoning
    },

    // FILE REGENERATION: needs purpose-built code generation
    // Qwen2.5 Coder 32B: built specifically for code gen/repair
    // Qwen docs: temp 0.7 for creative code solutions
    fileRegeneration: {
        name: AIModels.QWEN2_5_CODER_32B,
        reasoning_effort: 'low',
        max_tokens: 16000,
        fallbackModel: AIModels.GPT_OSS_120B,
        temperature: 0.7,
    },

    // REALTIME CODE FIXER: needs speed + SWE-bench quality
    // GLM Flash: SWE-bench leader in 30B class, fast
    // Zhipu docs: temp 0.7 for SWE-bench config
    realtimeCodeFixer: {
        name: AIModels.GLM_4_7_FLASH,
        reasoning_effort: 'low' as const,
        max_tokens: 32000,
        fallbackModel: AIModels.QWEN3_30B,
        temperature: 0.7,
    },

    // FAST CODE FIXER: needs cheapest + fastest tool calling
    // Granite Micro: cheapest in catalog ($0.017/M), 131K, top tool calling at 3B
    // IBM docs: temp 0.0 for code/FIM
    fastCodeFixer: {
        name: AIModels.GRANITE_4_MICRO,
        reasoning_effort: undefined,
        max_tokens: 64000,
        fallbackModel: AIModels.GLM_4_7_FLASH,
        temperature: 0.0,
    },

    // SCREENSHOT ANALYSIS: needs vision + reasoning
    // Kimi K2.5: best vision (MoonViT 400M), 256K, reasoning
    // Moonshot docs: temp 0.6 for analysis
    screenshotAnalysis: {
        name: AIModels.KIMI_K2_5,
        reasoning_effort: 'medium' as const,
        max_tokens: 8000,
        fallbackModel: AIModels.MISTRAL_SMALL_31, // vision + 128K + fast
        temperature: 0.6,
    },

    // AGENTIC PROJECT BUILDER: needs tool calling + 256K + reasoning
    // Kimi K2.5: frontier tool calling, 256K, reasoning, vision
    // Moonshot docs: temp 0.6 for agent mode
    agenticProjectBuilder: {
        name: AIModels.KIMI_K2_5,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        fallbackModel: AIModels.NEMOTRON_3_120B,
        temperature: 0.6,
    },
};

//======================================================================================
// Default Gemini-only config (most likely used in your deployment)
//======================================================================================
/* These are the default out-of-the box gemini-only models used when PLATFORM_MODEL_PROVIDERS is not set */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 2000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
        temperature: 0.6,
    },
    blueprint: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 64000,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
        temperature: 1,
    },
    projectSetup: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    phaseGeneration: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    firstPhaseImplementation: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    phaseImplementation: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    conversationalResponse: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'low',
        max_tokens: 4000,
        temperature: 0,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    deepDebugger: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    fileRegeneration: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    agenticProjectBuilder: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
};

export const AGENT_CONFIG: AgentConfig = env.PLATFORM_MODEL_PROVIDERS 
    ? PLATFORM_AGENT_CONFIG 
    : DEFAULT_AGENT_CONFIG;


export const AGENT_CONSTRAINTS: Map<AgentActionKey, AgentConstraintConfig> = new Map([
	['fastCodeFixer', {
		allowedModels: new Set(LiteModels),
		enabled: true,
	}],
	['realtimeCodeFixer', {
		allowedModels: new Set(LiteModels),
		enabled: true,
	}],
	['fileRegeneration', {
		allowedModels: new Set(AllModels),
		enabled: true,
	}],
	['phaseGeneration', {
		allowedModels: new Set(AllModels),
		enabled: true,
	}],
	['projectSetup', {
		allowedModels: new Set([...RegularModels, AIModels.GEMINI_2_5_PRO]),
		enabled: true,
	}],
	['conversationalResponse', {
		allowedModels: new Set(RegularModels),
		enabled: true,
	}],
	['templateSelection', {
		allowedModels: new Set(LiteModels),
		enabled: true,
	}],
]);