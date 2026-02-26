import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { buildRiasecQuickQuestions } from '../templates/riasec-quick.mjs';

function now() {
  return new Date().toISOString();
}

function insertAssessment(db, assessment) {
  db.run(
    `insert into assessments(id, slug, title, description, kind, config_json, is_active, created_at)
     values(?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assessment.id,
      assessment.slug,
      assessment.title,
      assessment.description ?? '',
      assessment.kind,
      JSON.stringify(assessment.config ?? {}),
      assessment.is_active ? 1 : 0,
      assessment.created_at
    ]
  );
}

function insertQuestion(db, question) {
  db.run(
    `insert into questions(id, assessment_id, order_index, prompt, type, options_json, scoring_json, is_active, created_at)
     values(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      question.id,
      question.assessment_id,
      question.order_index,
      question.prompt,
      question.type,
      question.options_json ?? null,
      question.scoring_json,
      question.is_active ? 1 : 0,
      question.created_at
    ]
  );
}

export function seedDefaults(db, env) {
  const adminId = `u_${nanoid(10)}`;
  const passwordHash = bcrypt.hashSync(env.ADMIN_PASSWORD, 10);
  db.run(
    `insert into users(id, email, password_hash, role, display_name, created_at)
     values(?, ?, ?, ?, ?, ?)`,
    [adminId, env.ADMIN_EMAIL, passwordHash, 'admin', '管理员', now()]
  );

  // Assessment: Quick RIASEC (age-group adaptable via profile)
  const riasecId = `a_${nanoid(10)}`;
  insertAssessment(db, {
    id: riasecId,
    slug: 'riasec-quick',
    title: '快速兴趣测评（RIASEC）',
    description: '用更不枯燥的方式，快速获得你的霍兰德职业兴趣画像（支持中小学生/中职/成人）。',
    kind: 'riasec_quiz',
    config: { scale: 'likert_1_5', questionCount: 36 },
    is_active: true,
    created_at: now()
  });

  const quickQs = buildRiasecQuickQuestions();
  quickQs.forEach((q, idx) => {
    insertQuestion(db, {
      id: `q_${nanoid(10)}`,
      assessment_id: riasecId,
      order_index: idx,
      prompt: q.prompt,
      type: 'likert',
      options_json: JSON.stringify(q.options),
      scoring_json: JSON.stringify(q.scoring),
      is_active: true,
      created_at: now()
    });
  });

  // Assessment: E-commerce story micro-scenario (prototype generic flow)
  const ecomGenericId = `a_${nanoid(10)}`;
  insertAssessment(db, {
    id: ecomGenericId,
    slug: 'ecom-story',
    title: '大促危机·剧本杀（电商）',
    description: '双十一/618 真实危机：超卖、客诉、公关。你的选择将暴露你的岗位思维倾向。',
    kind: 'scenario',
    config: { scenario: 'double11_crisis_v1' },
    is_active: true,
    created_at: now()
  });

  const ecomStoryChoices = [
    {
      prompt: '主播直播间爆款超卖 5000 单，你第一反应是？',
      options: [
        { id: 'I', label: '拉取库存明细 + 计算赔付率，先把账算清楚。' },
        { id: 'S', label: '先安抚主播与买家情绪，拟定话术，避免差评扩散。' },
        { id: 'A', label: '先做一张高信任感公关海报与首页视觉改版，稳住点击与信心。' }
      ],
      scoringByOption: {
        I: { I: 3, C: 1 },
        S: { S: 4 },
        A: { A: 4 }
      }
    }
  ];

  ecomStoryChoices.forEach((node, idx) => {
    insertQuestion(db, {
      id: `q_${nanoid(10)}`,
      assessment_id: ecomGenericId,
      order_index: idx,
      prompt: node.prompt,
      type: 'single',
      options_json: JSON.stringify(node.options),
      scoring_json: JSON.stringify({ scoringByOption: node.scoringByOption }),
      is_active: true,
      created_at: now()
    });
  });

  // Assessment: Data Ops (prototype terminal flow)
  const ecomDataId = `a_${nanoid(10)}`;
  insertAssessment(db, {
    id: ecomDataId,
    slug: 'ecom-data-ops',
    title: '流量中枢塔·数据操盘（技能版）',
    description: '包含终端命令题/诊断排序：测“数据素养+归因+止损”。',
    kind: 'scenario',
    config: { scenario: 'data_ops_skill_v2' },
    is_active: true,
    created_at: now()
  });

  const dataOpsQuestions = [
    {
      type: 'single',
      prompt: '场景①：系统告警：CVR 腰斩，ROI 跌破 0.8。你第一反应？',
      options: [
        { id: 'C', label: '先止损：冻结异常计划/限额，避免继续亏。' },
        { id: 'E', label: '先抢量：预算拉满，把排名顶回去。' },
        { id: 'I', label: '先定位：找“是哪一段链路坏了”。' }
      ],
      scoring: {
        scoringByOption: { C: { C: 3 }, E: { E: 3 }, I: { I: 3, C: 1 } },
        skillsByOption: {
          C: { risk_control: 3, process: 1 },
          E: { planning: 2, risk_control: -1 },
          I: { analysis: 3, data_literacy: 2 }
        },
        feedbackByOption: {
          C: '先止损是对的：冻结/限额异常计划，避免损失继续扩大；随后再定位原因。',
          E: '先抢量可能把低效放大；建议先定位链路与异常，再决定放量。',
          I: '先定位链路是专业做法：用漏斗/路径分析找掉点，再决定止损或加预算。'
        }
      }
    },
    {
      type: 'cmd',
      prompt: '场景②：输入指令查看“转化漏斗”，定位是哪一段掉了（输入任意命令即可继续）。',
      options: { placeholder: '例如：analyze.funnel --by=channel' },
      scoring: {
        acceptedCommands: ['analyze.funnel', 'analyze.traffic', 'analyze.path'],
        acceptedPrefixes: ['analyze.'],
        scoringByLevel: {
          excellent: { I: 2, C: 1 },
          good: { I: 1, C: 1 },
          poor: { C: 1 }
        },
        skillsByLevel: {
          excellent: { data_literacy: 3, analysis: 2 },
          good: { data_literacy: 2, analysis: 1 },
          poor: { process: 1 }
        },
        feedbackByLevel: {
          excellent: '命令方向正确：先看漏斗/路径，快速锁定掉点位置；再做分渠道/分人群更深入。',
          good: '命令可用：能看到关键数据；建议加维度（如 `--by=channel`）定位更快。',
          poor: '指令与分析目标不匹配；提示用 `analyze.funnel` / `analyze.path` 先找掉点。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景③：发现“恶意点击”迹象。你怎么验证？',
      options: [
        { id: 'I', label: '做对比：异常时段 vs 正常时段，点击-加购-支付漏斗差异。' },
        { id: 'C', label: '查日志与规则：IP/地域/关键词，命中策略就屏蔽。' },
        { id: 'E', label: '先屏蔽再说：宁可错杀也不亏钱。' }
      ],
      scoring: {
        scoringByOption: { I: { I: 3, C: 1 }, C: { C: 3, I: 1 }, E: { E: 2, C: 1 } },
        skillsByOption: {
          I: { analysis: 3, experiment: 2 },
          C: { risk_control: 3, process: 2 },
          E: { risk_control: 1, planning: 2 }
        },
        feedbackByOption: {
          I: '做对比 + 看漏斗差异，能证伪/证实异常，适合数据分析路径。',
          C: '查日志/规则能快速封堵风险；同时保留证据，便于复盘与申诉。',
          E: '先屏蔽再说有“误杀”风险；建议先验证再制定阈值与策略。'
        }
      }
    },
    {
      type: 'drag',
      prompt: '场景④：把“诊断转化异常”的步骤排序（先做什么后做什么）。',
      options: {
        items: [
          { id: 'stoploss', label: '先止损：避免继续亏损扩大' },
          { id: 'locate', label: '定位：是哪一段链路出问题' },
          { id: 'hypothesis', label: '提出假设：可能原因列表' },
          { id: 'verify', label: '验证：用数据/实验验证假设' },
          { id: 'fix', label: '修复：落地改动' }
        ]
      },
      scoring: {
        correctOrder: ['stoploss', 'locate', 'hypothesis', 'verify', 'fix'],
        scoringByLevel: {
          excellent: { C: 2, I: 1 },
          good: { C: 2 },
          poor: { C: 1 }
        },
        skillsByLevel: {
          excellent: { process: 2, analysis: 2, risk_control: 1 },
          good: { process: 2, analysis: 1 },
          poor: { process: 1 }
        },
        feedbackByLevel: {
          excellent: '排障闭环顺序专业：先止损→定位→假设→验证→修复，避免盲改。',
          good: '整体思路正确；建议强调“先定位再验证”，再落地修复更稳。',
          poor: '顺序不清会导致盲改；建议先止损/定位，再提假设并验证。'
        }
      }
    },
    {
      type: 'cmd',
      prompt: '场景⑤：输入“止损/告警”类命令（输入任意命令即可继续）。',
      options: { placeholder: '例如：guardrail.stoploss --apply' },
      scoring: {
        acceptedCommands: ['guardrail.stoploss', 'guardrail.alert', 'guardrail.block'],
        acceptedPrefixes: ['guardrail.'],
        scoringByLevel: {
          excellent: { C: 2 },
          good: { C: 1 },
          poor: { C: 1 }
        },
        skillsByLevel: {
          excellent: { risk_control: 3, process: 2 },
          good: { risk_control: 2, process: 1 },
          poor: { process: 1 }
        },
        feedbackByLevel: {
          excellent: '先止损是正确动作：把异常消耗拉住，再做原因定位与修复。',
          good: '方向正确：已尝试风控指令；建议同时记录策略与回滚条件。',
          poor: '缺少止损动作；提示用 `guardrail.stoploss` / `guardrail.block` 先把风险关住。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景⑥：复盘输出。你最像“高级数据操盘”的一句话是？',
      options: [
        { id: 'I', label: '“我用数据定位到链路问题，并用实验验证改动有效。”' },
        { id: 'C', label: '“我把问题固化成规则与SOP，减少下一次损失。”' },
        { id: 'E', label: '“我推动资源到位并把目标拆到动作，确保结果达成。”' }
      ],
      scoring: {
        scoringByOption: { I: { I: 3, C: 1 }, C: { C: 3 }, E: { E: 3, C: 1 } },
        skillsByOption: {
          I: { analysis: 3, experiment: 2 },
          C: { process: 3, risk_control: 2 },
          E: { planning: 3, leadership: 2 }
        },
        feedbackByOption: {
          I: '“定位 → 假设 → 验证 → 复盘”是高阶数据运营的典型表达。',
          C: '固化 SOP 能降低重复事故；也别忘了先用证据把根因说清楚。',
          E: '推动资源到位能加速落地；建议同时明确止损边界与验证指标。'
        }
      }
    }
  ];
  dataOpsQuestions.forEach((q, idx) => {
    insertQuestion(db, {
      id: `q_${nanoid(10)}`,
      assessment_id: ecomDataId,
      order_index: idx,
      prompt: q.prompt,
      type: q.type ?? 'single',
      options_json: q.options === undefined ? null : JSON.stringify(q.options),
      scoring_json: JSON.stringify(q.scoring ?? {}),
      is_active: true,
      created_at: now()
    });
  });

  // Assessment: Creative Lab (deep)
  const creativeId = `a_${nanoid(10)}`;
  insertAssessment(db, {
    id: creativeId,
    slug: 'ecom-creative-lab',
    title: '创意工坊区·主图与页面实战（技能版）',
    description: '包含拖拽排序/填空任务：测“视觉表达+文案+实验验证”。',
    kind: 'scenario',
    config: { scenario: 'creative_skill_v2' },
    is_active: true,
    created_at: now()
  });
  const creativeQs = [
    {
      type: 'single',
      prompt: '场景①：主图 CTR 低，但流量不少。你第一步做什么？',
      options: [
        { id: 'A', label: '先做信息层级重排：把“核心卖点+利益点”放到3秒可读位置。' },
        { id: 'I', label: '先对比3个竞品主图结构，找共同规律与差异点。' },
        { id: 'E', label: '先加预算拉排名，先把流量冲上去再说。' }
      ],
      scoring: {
        scoringByOption: { A: { A: 3, C: 1 }, I: { I: 3, C: 1 }, E: { E: 3 } },
        skillsByOption: {
          A: { design_literacy: 3, copywriting: 1, experiment: 1 },
          I: { analysis: 3, design_literacy: 1, experiment: 1 },
          E: { planning: 2, risk_control: -1 }
        },
        feedbackByOption: {
          A: '先把信息层级做清晰：卖点/利益点前置，提升 3 秒可读性，再用 A/B 验证。',
          I: '先竞品拆解建立结构假设，再用 A/B 验证差异点，适合数据驱动改图。',
          E: '先加预算会放大低效素材；建议先定位问题再放量。'
        }
      }
    },
    {
      type: 'drag',
      prompt: '场景②：把主图信息按“最应该先看到”的顺序排序（拖拽或上下移动）。',
      options: {
        items: [
          { id: 'sellpoint', label: '核心卖点（为什么值得买）' },
          { id: 'benefit', label: '利益点（省/快/爽）' },
          { id: 'evidence', label: '证据（口碑/对比/资质）' },
          { id: 'guarantee', label: '保障（售后/承诺）' },
          { id: 'spec', label: '规格参数（型号/尺寸/口味）' }
        ]
      },
      scoring: {
        correctOrder: ['sellpoint', 'benefit', 'evidence', 'guarantee', 'spec'],
        scoringByLevel: {
          excellent: { A: 2, C: 2 },
          good: { A: 2, C: 1 },
          poor: { C: 1 }
        },
        skillsByLevel: {
          excellent: { design_literacy: 3, copywriting: 1, process: 1 },
          good: { design_literacy: 2, copywriting: 1 },
          poor: { process: 1 }
        },
        feedbackByLevel: {
          excellent: '顺序专业：先卖点→利益点→证据/保障→规格，符合用户扫图路径。',
          good: '信息层级基本合理；再补强“证据/保障”的呈现会更稳。',
          poor: '顺序容易让用户先看规格忽略卖点；建议把卖点/利益点前置。'
        }
      }
    },
    {
      type: 'fill',
      prompt: '场景③：写一个“3秒看懂”的标题结构（填空）。',
      options: {
        fields: [
          { key: 'core', label: '核心词（你卖什么）', placeholder: '例如：紫皮大蒜5斤装' },
          { key: 'benefit', label: '利益点（为什么买）', placeholder: '例如：当天采挖/新鲜脆甜/坏果包赔' },
          { key: 'scene', label: '场景（给谁/何时用）', placeholder: '例如：家庭囤货/火锅蘸料' }
        ]
      },
      scoring: {
        requiredFields: ['core', 'benefit', 'scene'],
        minFilled: 2,
        scoringByLevel: {
          excellent: { A: 1, I: 1, C: 1 },
          good: { A: 1, C: 1 },
          poor: { C: 1 }
        },
        skillsByLevel: {
          excellent: { copywriting: 3, analysis: 1 },
          good: { copywriting: 2 },
          poor: { copywriting: 1 }
        },
        feedbackByLevel: {
          excellent: '结构完整：核心词 + 利益点 + 场景，做到 5 秒看懂，标题转化更稳。',
          good: '已有核心与部分卖点；补齐场景或利益点，会更有“立刻想买”的感觉。',
          poor: '信息偏泛或不完整；用“卖什么 + 为什么买 + 什么时候用”重写更有效。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景④：你要证明“改图改标题”真的有效，最像专业做法的是？',
      options: [
        { id: 'I', label: '做 A/B：只改一个变量，设定观察窗口，记录 CTR/CVR 变化。' },
        { id: 'E', label: '直接全量替换，追求速度，出了结果再复盘。' },
        { id: 'C', label: '先写测试计划与回滚方案，控制风险。' }
      ],
      scoring: {
        scoringByOption: { I: { I: 3, C: 1 }, E: { E: 3 }, C: { C: 3, I: 1 } },
        skillsByOption: {
          I: { experiment: 3, analysis: 2 },
          E: { planning: 2, risk_control: -1 },
          C: { risk_control: 3, process: 2 }
        },
        feedbackByOption: {
          I: '只改一个变量做 A/B，才知道“到底哪一改动”带来提升（可复用、可复盘）。',
          E: '全量替换难以归因；一旦下滑也难回滚，属于高风险提速。',
          C: '先写计划与回滚能控风险；再配合“只改一个变量”的原则，会更专业。'
        }
      }
    },
    {
      type: 'drag',
      prompt: '场景⑤：把详情页模块按“更容易促成下单”的顺序排序。',
      options: {
        items: [
          { id: 'pain', label: '痛点/场景（你为什么需要它）' },
          { id: 'benefit', label: '卖点与利益点（你得到什么）' },
          { id: 'compare', label: '对比与证据（为什么信）' },
          { id: 'guarantee', label: '保障与售后（怎么买更放心）' },
          { id: 'faq', label: 'FAQ（减少顾虑）' }
        ]
      },
      scoring: {
        correctOrder: ['pain', 'benefit', 'compare', 'guarantee', 'faq'],
        scoringByLevel: {
          excellent: { C: 2, I: 1 },
          good: { C: 2 },
          poor: { C: 1 }
        },
        skillsByLevel: {
          excellent: { process: 3, design_literacy: 1 },
          good: { process: 2 },
          poor: { process: 1 }
        },
        feedbackByLevel: {
          excellent: '顺序像讲故事：痛点场景→利益点→证据对比→保障→FAQ，能降低犹豫。',
          good: '框架对了；建议强化“证据/对比”模块（口碑/资质/对比表）更有说服力。',
          poor: '顺序容易让用户先陷入细节；建议先场景与利益点，再给证据与保障。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景⑥：主播怒了要发微博挂你。你要做一张“公关海报”，第一原则是？',
      options: [
        { id: 'S', label: '先稳情绪与态度：真诚致歉 + 明确补偿 + 时间点。' },
        { id: 'A', label: '先做高级感：视觉冲击强，先把气势做出来。' },
        { id: 'C', label: '先过合规：避免承诺过度、避免敏感词，内容可执行可兑现。' }
      ],
      scoring: {
        scoringByOption: { S: { S: 3, C: 1 }, A: { A: 3 }, C: { C: 3, I: 1 } },
        skillsByOption: {
          S: { empathy: 3, communication: 2 },
          A: { design_literacy: 3 },
          C: { risk_control: 3, process: 2 }
        },
        feedbackByOption: {
          S: '先稳情绪与态度：真诚表达 + 明确补偿 + 时间点，能快速止损舆情。',
          A: '只做“气势”容易被反噬；公关更看重事实与可执行承诺。',
          C: '先合规能避免二次风险；同时别忽略对外态度与时间点，避免“冷处理”观感。'
        }
      }
    }
  ];
  creativeQs.forEach((q, idx) => {
    insertQuestion(db, {
      id: `q_${nanoid(10)}`,
      assessment_id: creativeId,
      order_index: idx,
      prompt: q.prompt,
      type: q.type ?? 'single',
      options_json: q.options === undefined ? null : JSON.stringify(q.options),
      scoring_json: JSON.stringify(q.scoring ?? {}),
      is_active: true,
      created_at: now()
    });
  });

  // Assessment: Frontline (deep)
  const frontlineId = `a_${nanoid(10)}`;
  insertAssessment(db, {
    id: frontlineId,
    slug: 'ecom-frontline',
    title: '前线交易所·客诉与门店联动（技能版）',
    description: '包含话术填空/现场排序：测“共情沟通+执行+流程”。',
    kind: 'scenario',
    config: { scenario: 'frontline_skill_v2' },
    is_active: true,
    created_at: now()
  });
  const frontlineQs = [
    {
      type: 'fill',
      prompt: '场景①：客户怒骂“超卖不发货”。请用 3 句话完成“共情-方案-时间点”。',
      options: {
        fields: [
          { key: 'empathy', label: '共情/道歉句', placeholder: '例如：真的非常抱歉让你久等了…' },
          { key: 'plan', label: '解决方案句', placeholder: '例如：我们将为你…（补发/退款/补偿）' },
          { key: 'time', label: '时间点句', placeholder: '例如：今晚 8 点前给你确认结果…' }
        ]
      },
      scoring: {
        requiredFields: ['empathy', 'plan', 'time'],
        minFilled: 2,
        scoringByLevel: {
          excellent: { S: 3, C: 1 },
          good: { S: 3 },
          poor: { C: 1 }
        },
        skillsByLevel: {
          excellent: { empathy: 3, communication: 2, process: 1 },
          good: { empathy: 2, communication: 2 },
          poor: { communication: 1 }
        },
        feedbackByLevel: {
          excellent: '三段式话术完整：先共情稳情绪，再给方案，最后给明确时间点，投诉会明显下降。',
          good: '已有共情/方案雏形；补上明确时间点（几点前反馈）会更专业。',
          poor: '缺少共情或时间点会激化情绪；建议按“共情-方案-时间点”重写。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景②：补偿怎么定更合理？',
      options: [
        { id: 'C', label: '按规则阶梯：延迟天数→补偿券/部分退款，统一口径。' },
        { id: 'S', label: '看客户情绪与价值：高价值客户优先挽回，个性化处理。' },
        { id: 'I', label: '先算账：补偿成本 vs 差评损失，找到最优点。' }
      ],
      scoring: {
        scoringByOption: { C: { C: 3 }, S: { S: 3 }, I: { I: 3, C: 1 } },
        skillsByOption: {
          C: { risk_control: 2, process: 2 },
          S: { empathy: 2, communication: 2 },
          I: { analysis: 3, planning: 1 }
        },
        feedbackByOption: {
          C: '规则阶梯化：口径统一、可执行，适合规模化门店/客服协同。',
          S: '看客户价值做差异化能提升留存；记得有底线与记录，避免失控。',
          I: '先算账能找到最优点；再结合统一口径与情绪处理，效果更好。'
        }
      }
    },
    {
      type: 'drag',
      prompt: '场景③：门店排队爆炸。把“现场止血动作”按先后顺序排序。',
      options: {
        items: [
          { id: 'split', label: '分流：临时取货通道/指引牌' },
          { id: 'addstaff', label: '增援：加人手/分工' },
          { id: 'explain', label: '解释：告知等待时间与方案' },
          { id: 'check', label: '核对：防错发漏发' },
          { id: 'record', label: '记录：问题登记，便于后续补偿/回访' }
        ]
      },
      scoring: {
        correctOrder: ['split', 'addstaff', 'explain', 'check', 'record'],
        scoringByLevel: {
          excellent: { R: 2, S: 1, C: 1 },
          good: { R: 2, S: 1 },
          poor: { R: 1 }
        },
        skillsByLevel: {
          excellent: { execution: 3, store_ops: 2, process: 1 },
          good: { execution: 2, store_ops: 1 },
          poor: { execution: 1 }
        },
        feedbackByLevel: {
          excellent: '先分流/增援，再解释，最后核对与记录：既快又不出错，现场最稳。',
          good: '顺序基本合理；别忘了最后“记录”，否则无法形成补救与复盘闭环。',
          poor: '如果先核对/记录会拖慢现场；建议先分流和增援，再处理细节。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景④：O2O联动：线上爆单，线下缺货。你怎么协同？',
      options: [
        { id: 'E', label: '拉群定目标：谁补货、谁调拨、谁通知客户，立刻推进。' },
        { id: 'C', label: '建表对账：库存/订单/门店，先把数据对齐再行动。' },
        { id: 'S', label: '先对客户分层沟通：不同人不同承诺，降低投诉。' }
      ],
      scoring: {
        scoringByOption: { E: { E: 3, C: 1 }, C: { C: 3, I: 1 }, S: { S: 3 } },
        skillsByOption: {
          E: { planning: 3, communication: 1 },
          C: { process: 3, analysis: 1 },
          S: { empathy: 2, communication: 2 }
        },
        feedbackByOption: {
          E: '拉群定目标 + 拆动作，适合应急推进；注意同步风险与统一口径。',
          C: '先对账能减少错配；建议限定时间窗，别拖成“等数据”。',
          S: '分层沟通能降投诉；同时要把动作拆清楚，避免只安抚不解决。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景⑤：差评如潮。你要做“差评闭环”，第一步是？',
      options: [
        { id: 'I', label: '先归因分类：物流/质量/服务/预期落差，统计Top原因。' },
        { id: 'S', label: '先逐条回复：稳定舆情，争取撤评。' },
        { id: 'C', label: '先把流程写成SOP：以后不再重复发生。' }
      ],
      scoring: {
        scoringByOption: { I: { I: 3, C: 1 }, S: { S: 3 }, C: { C: 3 } },
        skillsByOption: {
          I: { analysis: 3, risk_control: 1 },
          S: { communication: 3, empathy: 1 },
          C: { process: 3, execution: 1 }
        },
        feedbackByOption: {
          I: '先分类归因能找到高频根因，后续才好做补救与写 SOP，闭环更有效。',
          S: '逐条回复能稳情绪；再配合原因归类与补救动作，才是真闭环。',
          C: '写 SOP 是后段动作；前面先归因与验证，否则 SOP 可能写错。'
        }
      }
    },
    {
      type: 'single',
      prompt: '场景⑥：复盘会。你最像专业的输出是？',
      options: [
        { id: 'C', label: '输出“问题-原因-动作-负责人-截止时间”的闭环清单。' },
        { id: 'S', label: '输出“客户情绪地图+话术升级点”，提升满意度。' },
        { id: 'E', label: '输出“下次目标+资源需求”，推动升级迭代。' }
      ],
      scoring: {
        scoringByOption: { C: { C: 3, E: 1 }, S: { S: 3 }, E: { E: 3, C: 1 } },
        skillsByOption: {
          C: { process: 3, execution: 2 },
          S: { empathy: 2, communication: 2 },
          E: { planning: 3, leadership: 1 }
        },
        feedbackByOption: {
          C: '“问题-原因-动作-负责人-截止时间”最能推动落地，是一线运营复盘的黄金格式。',
          S: '情绪地图能提升体验；也要落到动作与责任，避免只“感受”不改进。',
          E: '目标与资源能推进迭代；建议基于复盘证据与优先级，避免拍脑袋。'
        }
      }
    }
  ];
  frontlineQs.forEach((q, idx) => {
    insertQuestion(db, {
      id: `q_${nanoid(10)}`,
      assessment_id: frontlineId,
      order_index: idx,
      prompt: q.prompt,
      type: q.type ?? 'single',
      options_json: q.options === undefined ? null : JSON.stringify(q.options),
      scoring_json: JSON.stringify(q.scoring ?? {}),
      is_active: true,
      created_at: now()
    });
  });
}
