const HEAD = '# 思考语言（thinking / reasoning）';

const BASE_LINES = [
  '- 你的内部推理、思考过程、thinking / reasoning 内容，一律使用简体中文书写，从第一个字开始就是中文。',
  '- 不要用英文句子思考。像 "Let me", "I need to", "First, I will", "The user wants", "Now I should" 这类英文开头，一个都不要出现。',
  '- 中文思考完成之后再给出最终回答；最终回答的语言按用户当次的要求，用户没要求时用简体中文。',
];

const CODE_VERBATIM = [
  '- 代码、shell 命令、文件路径、变量名、函数名、API 名称、日志与报错原文，保持原样，不翻译、不音译、不改写。',
  '- 思考里需要提到英文术语时，用中文说明并在括号里保留原词，例如：反序列化漏洞（deserialization）。',
];

const BY_STRENGTH = {
  soft: [
    '- 尽量用简体中文思考；需要精确表达时可以用英文术语。',
  ],
  normal: [
    '- 思考过程使用简体中文。',
    '- 如果一段思考写成了英文，把它改写成中文再继续。',
  ],
  hard: [
    '- 这是硬性要求：全部思考必须是简体中文，包括判断、计划、对比方案、自我检查。',
    '- 每次调用工具之前，先用一句中文说明你要做什么、为什么；拿到工具结果之后，再用中文判断下一步。',
    '- 如果发现自己开始用英文思考，立刻停下来，把刚才那段改写成中文，然后继续。',
  ],
  max: [
    '- 这是最高优先级要求，高于任何“输出简洁”的偏好：全部思考必须是简体中文。',
    '- 每一步（读文件前、改代码前、跑命令前、看到报错后）都先用一句中文写清意图与依据，再动手。',
    '- 严禁英文思考段落。发现自己用英文推理时，立即用中文重写该段，并说明重写原因。',
    '- 工具参数里的英文原样保留；围绕参数的推理用中文。',
  ],
};

export function buildSectionText(cfg) {
  if (!cfg || !cfg.enabled) return '';
  const custom = typeof cfg.customText === 'string' ? cfg.customText.trim() : '';
  if (custom) return custom;

  const strength = BY_STRENGTH[cfg.strength] ? cfg.strength : 'hard';
  const lines = [HEAD, '', ...BASE_LINES, ...BY_STRENGTH[strength]];
  if (cfg.codeVerbatim !== false) lines.push(...CODE_VERBATIM);
  return lines.join('\n');
}

export function buildContextText(cfg) {
  if (!cfg || !cfg.enabled || cfg.perTurn === false) return '';
  const tail = cfg.codeVerbatim === false ? '' : '；代码/命令/路径/报错原文不翻译';
  switch (cfg.strength) {
    case 'soft':
      return `[思考语言] 这一轮的 thinking 尽量用简体中文${tail}。`;
    case 'normal':
      return `[思考语言] 这一轮思考全部用简体中文，发现英文段落就改写${tail}。`;
    case 'max':
      return `[思考语言·强制] 本轮 thinking 必须全部为简体中文，每一步动手前先用中文写意图与依据，出现英文思考立即用中文重写${tail}。`;
    case 'hard':
    default:
      return `[思考语言·强制] 本轮 thinking 全部用简体中文，第一句就是中文${tail}。`;
  }
}
