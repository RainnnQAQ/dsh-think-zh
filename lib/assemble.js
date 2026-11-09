import { resolveConfig } from './config.js';
import { buildContextText, buildSectionText } from './prompt.js';

export const SECTION_NAME = 'think-zh:thinking-language';
export const CONTEXT_NAME = 'think-zh:reminder';

export function enforceAssembly(assembly, patchConfig, home) {
  if (!assembly || typeof assembly !== 'object') return assembly;
  const cfg = resolveConfig(patchConfig, home);
  try {
    const sections = Array.isArray(assembly.sections) ? [...assembly.sections] : [];
    const contexts = Array.isArray(assembly.contexts) ? [...assembly.contexts] : [];

    if (!cfg.enabled) {
      return {
        ...assembly,
        sections: sections.filter((s) => s && s.name !== SECTION_NAME),
        contexts: contexts.filter((c) => c && c.name !== CONTEXT_NAME),
      };
    }

    const sectionText = buildSectionText(cfg);
    const contextText = buildContextText(cfg);

    const sIndex = sections.findIndex((s) => s && s.name === SECTION_NAME);
    if (sIndex >= 0) sections[sIndex] = { ...sections[sIndex], text: sectionText, interpolate: false };
    else sections.push({ name: SECTION_NAME, text: sectionText, interpolate: false });

    const cIndex = contexts.findIndex((c) => c && c.name === CONTEXT_NAME);
    if (contextText) {
      if (cIndex >= 0) contexts[cIndex] = { ...contexts[cIndex], text: contextText };
      else contexts.push({ name: CONTEXT_NAME, text: contextText });
    } else if (cIndex >= 0) {
      contexts.splice(cIndex, 1);
    }

    return { ...assembly, sections, contexts };
  } catch {
    return assembly;
  }
}
