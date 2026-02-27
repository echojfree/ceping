export function localRoleIntelReply({ role, question, ageGroup }) {
  const stage =
    ageGroup === 'primary'
      ? '小学'
      : ageGroup === 'middle'
        ? '中学'
        : ageGroup === 'adult'
          ? '成人'
          : '中职/高中';

  const roleName = role?.name || '该岗位';
  const focusDo = Array.isArray(role?.do) ? role.do.slice(0, 5) : [];
  const focusTools = Array.isArray(role?.tools) ? role.tools.slice(0, 6) : [];
  const focusKpi = Array.isArray(role?.kpi) ? role.kpi.slice(0, 6) : [];
  const focusMistakes = Array.isArray(role?.mistakes) ? role.mistakes.slice(0, 4) : [];

  const answer = [
    `## ${roleName} 情报速览（${stage}版本）`,
    '',
    role?.tagline ? `> ${role.tagline}` : '',
    '',
    '### 你关心的问题',
    '',
    question ? `**Q：**${question}` : '**Q：**（未提供问题）',
    '',
    '### 直接回答（抓重点）',
    '',
    focusDo.length
      ? focusDo.map((x) => `- ${x}`).join('\n')
      : '- 这类岗位的核心是：把目标拆成动作，把结果做成可复盘的流程。',
    '',
    focusTools.length ? `**常用工具/方法：** ${focusTools.join('、')}` : '',
    focusKpi.length ? `**常看指标：** ${focusKpi.join('、')}` : '',
    '',
    focusMistakes.length
      ? `### 常见误区（避免踩坑）\n${focusMistakes.map((x) => `- ${x}`).join('\n')}`
      : '',
    '',
    '### 今天就能做的小练习（10-15分钟）',
    '',
    role?.microtask
      ? `- 练习题：${role.microtask}\n- 产出格式：写成 3 条要点 + 1 条可验证假设。`
      : '- 练习题：选一个商品/案例，写出“用户为什么买 + 买前担心什么 + 你用什么证据打消担心”。',
    '',
    '### 你可以继续追问我（任选其一）',
    '',
    '- 给我一个“新手 7 天入门计划”（每天 20 分钟）。',
    '- 这个岗位最核心的 3 个技能分别怎么练？给量化标准。',
    '- 用一个真实场景模拟：我该怎么做、怎么说、怎么记录？'
  ]
    .filter(Boolean)
    .join('\n');

  return { content: answer };
}

