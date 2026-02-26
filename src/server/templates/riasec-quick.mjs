const LIKERT_1_5 = [
  { id: 1, label: '非常不符合' },
  { id: 2, label: '不太符合' },
  { id: 3, label: '一般' },
  { id: 4, label: '比较符合' },
  { id: 5, label: '非常符合' }
];

// 36 题：每个维度 6 题；措辞尽量中性，适配中小学生/中职/成人。
// 注意：这不是学术量表复刻，目标是“可用、好玩、可解释”，同时保留 RIASEC 结构。
export function buildRiasecQuickQuestions() {
  const items = [
    // R
    { dim: 'R', prompt: '我喜欢动手做东西（组装、修理、搭建）。' },
    { dim: 'R', prompt: '我愿意在现场解决具体问题，而不是只讨论理论。' },
    { dim: 'R', prompt: '我对工具、设备、机器的工作原理感兴趣。' },
    { dim: 'R', prompt: '我喜欢户外或需要行动的任务。' },
    { dim: 'R', prompt: '我更喜欢“做出成品”而不是“写一堆想法”。' },
    { dim: 'R', prompt: '我做事偏务实，追求直接可见的效果。' },
    // I
    { dim: 'I', prompt: '我喜欢研究“为什么会这样”，并找证据验证。' },
    { dim: 'I', prompt: '我愿意花时间分析数据、规律或逻辑。' },
    { dim: 'I', prompt: '遇到复杂问题时，我会拆成步骤逐个解决。' },
    { dim: 'I', prompt: '我喜欢实验、推理、探索新的方法。' },
    { dim: 'I', prompt: '我对科学、技术、系统性的知识更有兴趣。' },
    { dim: 'I', prompt: '我更享受“把事情弄明白”的过程。' },
    // A
    { dim: 'A', prompt: '我喜欢设计、绘画、拍摄、剪辑或创意表达。' },
    { dim: 'A', prompt: '我对美感（配色、排版、节奏）比较敏感。' },
    { dim: 'A', prompt: '我更愿意用独特的方式表达观点。' },
    { dim: 'A', prompt: '我喜欢做能打动人的作品（海报、文案、视频等）。' },
    { dim: 'A', prompt: '我愿意尝试新风格，而不是只照搬模板。' },
    { dim: 'A', prompt: '我做事更看重体验与创意。' },
    // S
    { dim: 'S', prompt: '我愿意帮助别人解决困难或情绪问题。' },
    { dim: 'S', prompt: '我擅长倾听并把话说清楚。' },
    { dim: 'S', prompt: '我更喜欢团队协作，而不是一个人闷头做。' },
    { dim: 'S', prompt: '我愿意做服务类、支持类或沟通协调的工作。' },
    { dim: 'S', prompt: '遇到冲突时，我倾向于先把关系和气氛稳住。' },
    { dim: 'S', prompt: '我喜欢与人打交道，能从中获得能量。' },
    // E
    { dim: 'E', prompt: '我喜欢设定目标并推动别人一起达成。' },
    { dim: 'E', prompt: '我愿意承担责任，做决策并影响结果。' },
    { dim: 'E', prompt: '我对销售、运营、谈判、管理类事情更有兴趣。' },
    { dim: 'E', prompt: '我享受竞争与挑战，喜欢赢的感觉。' },
    { dim: 'E', prompt: '我擅长把资源、人和任务组织起来。' },
    { dim: 'E', prompt: '我更在意结果与效率。' },
    // C
    { dim: 'C', prompt: '我喜欢有清晰规则、流程和标准的任务。' },
    { dim: 'C', prompt: '我做事有条理，喜欢把信息整理得很清楚。' },
    { dim: 'C', prompt: '我能长期保持耐心，按步骤把事情做完。' },
    { dim: 'C', prompt: '我习惯提前计划，并按计划执行。' },
    { dim: 'C', prompt: '我更擅长处理表格、文档、归档和细节。' },
    { dim: 'C', prompt: '我更喜欢稳定、可控、可预测的工作方式。' }
  ];

  return items.map((it) => ({
    prompt: it.prompt,
    options: LIKERT_1_5,
    scoring: { dim: it.dim, method: 'likert_1_5' }
  }));
}

