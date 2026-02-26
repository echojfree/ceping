export function localCoachReply({ userText, result, ageGroup }) {
  const top = result?.topDims ?? [];
  const code = result?.code ?? 'RIA';
  const matchedRole = result?.recommendations?.matchedRole ?? '综合方向';

  const stage =
    ageGroup === 'primary'
      ? '小学生'
      : ageGroup === 'middle'
        ? '中小学生'
        : ageGroup === 'adult'
          ? '社会人士'
          : '中职/高中学生';

  const tips = [];
  tips.push(`你这次测评的主代码是 ${code}，岗位映射更偏向「${matchedRole}」。`);
  if (top.includes('A')) tips.push('你的优势里有明显的“创意/审美驱动”，做作品会比背概念更来劲。');
  if (top.includes('I')) tips.push('你偏“研究/分析”，适合做对比、复盘和数据推理，别怕慢，只要逻辑对就会越来越快。');
  if (top.includes('S')) tips.push('你偏“沟通/助人”，你的价值在于把复杂问题翻译成别人听得懂、做得起来。');
  if (top.includes('E')) tips.push('你偏“目标/推动”，适合做负责人，但要注意别因为追结果忽略质量与复盘。');
  if (top.includes('C')) tips.push('你偏“秩序/流程”，你是团队的稳定器，擅长把混乱变成可执行的清单。');
  if (top.includes('R')) tips.push('你偏“动手/落地”，适合多做实操，把技能练成肌肉记忆。');

  const response = [
    `收到。我会按 ${stage} 的节奏来给你建议。`,
    '',
    ...tips.map((t) => `- ${t}`),
    '',
    '如果你愿意，我们可以继续做 3 个“追问”来把结果落到“下一周怎么做”：',
    '1) 你最不想做、但又经常被要求做的事情是什么？',
    '2) 你做什么事情会进入“停不下来”的状态？',
    '3) 你目前最想提升的 1 项硬技能是什么（例如：剪辑、表格、表达、编程、设计、带货）？',
    '',
    `你刚刚说：${userText?.slice(0, 80) ?? ''}`
  ].join('\n');

  return { content: response };
}

