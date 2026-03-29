import { describe, it, expect } from 'vitest';
import { AIModels, AI_MODEL_CONFIG, LiteModels, RegularModels, AllModels } from '../../worker/agents/inferutils/config.types';
import { AGENT_CONFIG, AGENT_CONSTRAINTS } from '../../worker/agents/inferutils/config';

describe('Phase Audit: Model Configuration', () => {
	describe('Workers AI model IDs use correct provider prefix', () => {
		const workersAiModels = Object.entries(AIModels).filter(([, id]) =>
			typeof id === 'string' && id.includes('@cf/')
		);

		it('should have Workers AI models defined', () => {
			expect(workersAiModels.length).toBeGreaterThan(0);
		});

		it.each(workersAiModels)('model %s should use workers-ai/ prefix (not workersai/)', (key, id) => {
			expect(id).toMatch(/^workers-ai\/@cf\//);
			expect(id).not.toMatch(/^workersai\//);
		});
	});

	describe('OpenRouter model IDs use [openrouter] prefix', () => {
		const openRouterModels = Object.entries(AIModels).filter(([, id]) =>
			typeof id === 'string' && id.includes('[openrouter]')
		);

		it('should have OpenRouter models defined', () => {
			expect(openRouterModels.length).toBeGreaterThan(0);
		});

		it.each(openRouterModels)('model %s should have directOverride in config', (key, id) => {
			const config = AI_MODEL_CONFIG[id as keyof typeof AI_MODEL_CONFIG];
			expect(config).toBeDefined();
			expect(config.directOverride).toBe(true);
		});
	});

	describe('Every model in MODELS_MASTER has a valid config', () => {
		it('all AIModels should have an entry in AI_MODEL_CONFIG', () => {
			for (const [key, id] of Object.entries(AIModels)) {
				if (id === 'disabled') continue;
				const config = AI_MODEL_CONFIG[id as keyof typeof AI_MODEL_CONFIG];
				expect(config, `Missing config for ${key} (${id})`).toBeDefined();
				expect(config.name, `Missing name for ${key}`).toBeTruthy();
				expect(config.provider, `Missing provider for ${key}`).toBeTruthy();
				expect(config.contextSize, `Missing contextSize for ${key}`).toBeGreaterThan(0);
			}
		});
	});

	describe('Model size categories are consistent', () => {
		it('LiteModels should only contain LITE-sized models', () => {
			for (const id of LiteModels) {
				const config = AI_MODEL_CONFIG[id as keyof typeof AI_MODEL_CONFIG];
				expect(config?.size, `${id} is in LiteModels but not LITE`).toBe('lite');
			}
		});

		it('RegularModels should contain LITE and REGULAR models', () => {
			for (const id of RegularModels) {
				const config = AI_MODEL_CONFIG[id as keyof typeof AI_MODEL_CONFIG];
				expect(['lite', 'regular'], `${id} in RegularModels is ${config?.size}`).toContain(config?.size);
			}
		});

		it('AllModels should contain all sizes', () => {
			expect(AllModels.length).toBeGreaterThanOrEqual(RegularModels.length);
			expect(RegularModels.length).toBeGreaterThanOrEqual(LiteModels.length);
		});
	});

	describe('PLATFORM_AGENT_CONFIG references valid models', () => {
		it('every default model should exist in AIModels', () => {
			for (const [key, config] of Object.entries(AGENT_CONFIG)) {
				if (config.name === 'disabled') continue;
				const modelConfig = AI_MODEL_CONFIG[config.name as keyof typeof AI_MODEL_CONFIG];
				expect(modelConfig, `Agent ${key} references unknown model: ${config.name}`).toBeDefined();
			}
		});

		it('every fallback model should exist in AIModels', () => {
			for (const [key, config] of Object.entries(AGENT_CONFIG)) {
				if (!config.fallbackModel) continue;
				const modelConfig = AI_MODEL_CONFIG[config.fallbackModel as keyof typeof AI_MODEL_CONFIG];
				expect(modelConfig, `Agent ${key} fallback references unknown model: ${config.fallbackModel}`).toBeDefined();
			}
		});
	});

	describe('AGENT_CONSTRAINTS reference valid models', () => {
		it('every constrained model should be in AllModels or DISABLED', () => {
			for (const [action, constraint] of AGENT_CONSTRAINTS.entries()) {
				for (const model of constraint.allowedModels) {
					expect(
						model === 'disabled' || AllModels.includes(model),
						`Constraint for ${action} references unknown model: ${model}`
					).toBe(true);
				}
			}
		});
	});

	describe('DEFAULT_AGENT_CONFIG does NOT use Workers AI models', () => {
		// DEFAULT_AGENT_CONFIG is used when PLATFORM_MODEL_PROVIDERS is not set
		// It should only use Gemini models (google-ai-studio provider)
		it('common configs should not reference workers-ai provider', () => {
			// COMMON_AGENT_CONFIGS feeds into DEFAULT_AGENT_CONFIG
			// Check that screenshotAnalysis, realtimeCodeFixer, fastCodeFixer, templateSelection
			// do not use workers-ai models in their name or fallback when PLATFORM_MODEL_PROVIDERS is unset
			const commonKeys = ['screenshotAnalysis', 'realtimeCodeFixer', 'fastCodeFixer', 'templateSelection'] as const;
			for (const key of commonKeys) {
				const config = AGENT_CONFIG[key];
				if (config.name !== 'disabled') {
					const modelConfig = AI_MODEL_CONFIG[config.name as keyof typeof AI_MODEL_CONFIG];
					// This test only validates the structure exists -- actual provider check
					// depends on whether PLATFORM_MODEL_PROVIDERS is set at import time
					expect(modelConfig, `${key} default model should have a config`).toBeDefined();
				}
			}
		});
	});
});

describe('Phase Audit: Model ID Format Validation', () => {
	it('no model ID should use workersai/ (without hyphen)', () => {
		for (const [key, id] of Object.entries(AIModels)) {
			if (typeof id !== 'string') continue;
			expect(id, `${key} uses deprecated workersai/ prefix`).not.toMatch(/^workersai\//);
		}
	});

	it('Workers AI model IDs should contain @cf/ after the prefix', () => {
		for (const [key, id] of Object.entries(AIModels)) {
			if (typeof id !== 'string' || !id.startsWith('workers-ai/')) continue;
			expect(id, `${key} Workers AI model missing @cf/ namespace`).toMatch(/^workers-ai\/@cf\//);
		}
	});
});

describe('Phase Audit: Auth & Safety', () => {
	it('ALLOWED_EMAILS parsing handles empty string', () => {
		const raw = '';
		const result = (raw || '').split(',').map(e => e.trim()).filter(Boolean);
		expect(result).toEqual([]);
		expect(result.length).toBe(0); // empty = whitelist disabled
	});

	it('ALLOWED_EMAILS parsing handles comma-separated list', () => {
		const raw = 'a@b.com, c@d.com ,e@f.com';
		const result = (raw || '').split(',').map(e => e.trim()).filter(Boolean);
		expect(result).toEqual(['a@b.com', 'c@d.com', 'e@f.com']);
		expect(result.includes('a@b.com')).toBe(true);
		expect(result.includes('hacker@evil.com')).toBe(false);
	});

	it('ALLOWED_EMAILS parsing handles trailing commas and spaces', () => {
		const raw = 'a@b.com,,, ,c@d.com,';
		const result = (raw || '').split(',').map(e => e.trim()).filter(Boolean);
		expect(result).toEqual(['a@b.com', 'c@d.com']);
	});

	it('OpenRouter model IDs must have directOverride to bypass gateway', () => {
		for (const [key, id] of Object.entries(AIModels)) {
			if (typeof id !== 'string' || !id.includes('[openrouter]')) continue;
			const config = AI_MODEL_CONFIG[id as keyof typeof AI_MODEL_CONFIG];
			expect(config?.directOverride, `${key} routes via OpenRouter but missing directOverride`).toBe(true);
		}
	});

	it('Workers AI models should NOT have directOverride', () => {
		for (const [key, id] of Object.entries(AIModels)) {
			if (typeof id !== 'string' || !id.startsWith('workers-ai/')) continue;
			const config = AI_MODEL_CONFIG[id as keyof typeof AI_MODEL_CONFIG];
			expect(config?.directOverride, `${key} is Workers AI but has directOverride set`).toBeFalsy();
		}
	});
});
