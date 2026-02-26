const DIM_CN = {
  R: '实用型（动手执行）',
  I: '研究型（分析探索）',
  A: '艺术型（创意审美）',
  S: '社会型（沟通助人）',
  E: '企业型（目标驱动）',
  C: '常规型（秩序流程）'
};

const ECOM_ROLE_MAP = [
  { role: '视觉设计', dims: ['A', 'I'], desc: '主图/详情页、活动页、品牌视觉、动效与转化美学。' },
  { role: '产品开发', dims: ['I', 'C'], desc: '选品、定价、竞品分析、供应链协同与迭代验证。' },
  { role: '客户服务', dims: ['S', 'R'], desc: '客诉处理、话术体系、情绪安抚、问题闭环与复购。' },
  { role: '门店经营', dims: ['S', 'R'], desc: '现场执行、团队协作、O2O协同与稳定交付。' },
  { role: '电商运营', dims: ['E', 'C'], desc: '活动策划、投放策略、节奏把控、目标拆解与推进。' },
  { role: '数据分析', dims: ['I', 'C'], desc: '归因分析、指标体系、实验设计、ROI与转化链路优化。' }
];

function pickTopRole(top2) {
  const [a, b] = top2;
  const hit = ECOM_ROLE_MAP.find((r) => r.dims.includes(a) && r.dims.includes(b));
  return hit ?? ECOM_ROLE_MAP.find((r) => r.dims.includes(a)) ?? ECOM_ROLE_MAP[0];
}

export function buildRecommendations({ code, top, ageGroup, assessmentSlug }) {
  const role = pickTopRole(top.slice(0, 2));

  const core = top.map((d) => `- ${d}：${DIM_CN[d]}`).join('\n');

  const tasks = buildTasks({ top, ageGroup, assessmentSlug });

  return {
    matchedRole: role.role,
    matchedRoleDesc: role.desc,
    summary: `你的 Holland 主代码为 ${code}。\n核心优势倾向：\n${core}\n\n在电商岗位映射上，系统判定更契合：${role.role}。`,
    tasks
  };
}

export function buildSkillNotes(skillsTop = []) {
  if (!skillsTop?.length) return '';
  const map = {
    data_literacy: '数据素养（会看懂关键指标与口径）',
    analysis: '分析推理（能定位问题与提出假设）',
    experiment: '实验验证（会做 A/B 与复盘）',
    design_literacy: '视觉表达（信息层级与转化表达）',
    copywriting: '文案表达（标题/卖点/话术）',
    communication: '沟通协作（对齐目标推进）',
    empathy: '共情服务（稳定情绪与信任）',
    process: '流程规范（SOP/表格/清单）',
    risk_control: '风险合规（止损与承诺可兑现）',
    planning: '目标规划（拆解与节奏）',
    execution: '现场执行（分流与落地）',
    store_ops: '门店运营（人货场节奏）',
    leadership: '推动带队（协调资源）'
  };
  return skillsTop
    .slice(0, 5)
    .map((k) => `- ${map[k] ?? k}`)
    .join('\n');
}

function buildTasks({ top, ageGroup, assessmentSlug }) {
  const stage = ageGroup ?? 'secondary';

  const tasksByDim = {
    A: [
      stageTask(stage, '用 Canva/Figma 临摹 3 张高点击率主图（不同风格各 1 张）。', '完成后自评：信息层级是否清晰？卖点是否突出？'),
      stageTask(stage, '做一个 30 秒短视频脚本：开头 3 秒钩子 + 3 个卖点 + 1 个行动号召。', '把脚本念出来，听起来顺不顺？')
    ],
    I: [
      stageTask(stage, '选一个商品，拉 3 个竞品做对比表：价格、卖点、评价关键词、图片风格。', '写出你的 2 个“可改进假设”。'),
      stageTask(stage, '做一个小实验：改一个标题/主图元素，预测 CTR 变化方向与原因。', '记录预测与结果差异。')
    ],
    S: [
      stageTask(stage, '写 10 条“客诉情绪”安抚话术：愤怒/焦虑/失望/催促等场景。', '每条控制在 20 秒可读完。'),
      stageTask(stage, '和同学做一次 5 分钟角色扮演：你是客服，对方是情绪客户。', '复盘：你做对了哪 2 点？哪 1 点可改？')
    ],
    E: [
      stageTask(stage, '给一个活动做目标拆解：GMV、转化率、客单价三项如何拆到动作？', '写出你最想先推动的 1 个关键动作。'),
      stageTask(stage, '模拟一次谈判：你要说服“供应商/主播/同学”配合方案。', '用 3 句核心论点 + 1 个让步条件。')
    ],
    C: [
      stageTask(stage, '做一份“标准流程清单”：从接单到发货到售后每步谁负责。', '目标：任何人照着清单都能执行。'),
      stageTask(stage, '用表格整理 1 周的数据（流量/转化/客诉/退货）。', '写出你观察到的 1 个异常点与可能原因。')
    ],
    R: [
      stageTask(stage, '做一次线下/现场执行练习：把一个任务拆成 10 个动作并按时完成。', '记录耗时与卡点。'),
      stageTask(stage, '做一个“实操演示”：教别人如何完成某个具体步骤。', '被教的人能一次做对吗？')
    ]
  };

  const chosen = [];
  for (const dim of top.slice(0, 2)) {
    chosen.push(...(tasksByDim[dim] ?? []).slice(0, 1));
  }

  // Always add one “anti-boredom” mission to keep engagement high
  chosen.push({
    title: 'Boss 任务：把枯燥变成游戏',
    desc: assessmentSlug?.startsWith('ecom')
      ? '为“爆单危机”设计一个 1 分钟剧情分支：1 个冲突 + 2 个选择 + 2 种不同结局。'
      : '把你最不喜欢的一门课，设计成一个 1 分钟小游戏挑战：规则、积分、奖励。'
  });

  return chosen;
}

function stageTask(stage, title, desc) {
  const prefix =
    stage === 'primary'
      ? '（小学）'
      : stage === 'middle'
        ? '（中学）'
        : stage === 'adult'
          ? '（成人）'
          : '（中职/高中）';
  return { title: `${prefix} ${title}`, desc };
}
