export async function applyMigrations(db, { fromSeedVersion }) {
  let v = Number(fromSeedVersion) || 1;
  if (v < 2) {
    migrateV1ToV2(db);
    v = 2;
    db.run('update meta set value = ? where key = ?', [String(v), 'seed_version']);
  }
  if (v < 3) {
    migrateV2ToV3(db);
    v = 3;
    db.run('update meta set value = ? where key = ?', [String(v), 'seed_version']);
  }
  if (v < 4) {
    migrateV3ToV4(db);
    v = 4;
    db.run('update meta set value = ? where key = ?', [String(v), 'seed_version']);
  }
  if (v < 5) {
    migrateV4ToV5(db);
    v = 5;
    db.run('update meta set value = ? where key = ?', [String(v), 'seed_version']);
  }
}

function migrateV1ToV2(db) {
  // v2: normalize option IDs of ecom-story to match UI buttons (I/S/A) and adjust scoring.
  const assessment = db.get('select id from assessments where slug = ?', ['ecom-story']);
  if (!assessment) return;

  const q = db.get(
    `select id, options_json, scoring_json
     from questions
     where assessment_id = ?
     order by order_index asc
     limit 1`,
    [assessment.id]
  );
  if (!q) return;

  const options = safeJson(q.options_json);
  const scoring = safeJson(q.scoring_json);
  if (!options || !scoring) return;

  const newOptions = [
    { id: 'I', label: '拉取库存明细 + 计算赔付率，先把账算清楚。' },
    { id: 'S', label: '先安抚主播与买家情绪，拟定话术，避免差评扩散。' },
    { id: 'A', label: '先做一张高信任感公关海报与首页视觉改版，稳住点击与信心。' }
  ];
  const newScoring = { scoringByOption: { I: { I: 3, C: 1 }, S: { S: 4 }, A: { A: 4 } } };

  db.run('update questions set options_json = ?, scoring_json = ? where id = ?', [
    JSON.stringify(newOptions),
    JSON.stringify(newScoring),
    q.id
  ]);
}

function migrateV2ToV3(db) {
  // 1) Add skills_json column if missing
  const cols = db.exec(`pragma table_info('results')`);
  const hasSkills = cols.some((c) => c.name === 'skills_json');
  if (!hasSkills) {
    db.run(`alter table results add column skills_json text`);
  }

  // 2) Deepen three sub-modules: creative/frontline/dataops (multi-scene questions)
  upsertAssessmentsV3(db);
}

function migrateV3ToV4(db) {
  // v4: add hands-on skill tasks (drag/fill/cmd) into 3 modules
  upsertAssessmentsV4(db);
}

function migrateV4ToV5(db) {
  // v5: enrich scenario questions with per-scene feedback (for instant evaluation UX)
  upsertAssessmentsV4(db);
}

function upsertAssessmentsV3(db) {
  const now = () => new Date().toISOString();

  const ensureAssessment = (slug, title, description, kind, config) => {
    const row = db.get('select id from assessments where slug = ?', [slug]);
    if (row?.id) {
      db.run(
        `update assessments set title = ?, description = ?, kind = ?, config_json = ?, is_active = 1 where id = ?`,
        [title, description, kind, JSON.stringify(config ?? {}), row.id]
      );
      return row.id;
    }
    const id = `a_${Math.random().toString(16).slice(2, 12)}`;
    db.run(
      `insert into assessments(id, slug, title, description, kind, config_json, is_active, created_at)
       values(?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, slug, title, description, kind, JSON.stringify(config ?? {}), now()]
    );
    return id;
  };

  const replaceQuestions = (assessmentId, questions) => {
    db.run('delete from questions where assessment_id = ?', [assessmentId]);
    questions.forEach((q, idx) => {
      db.run(
        `insert into questions(id, assessment_id, order_index, prompt, type, options_json, scoring_json, is_active, created_at)
         values(?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          `q_${Math.random().toString(16).slice(2, 12)}`,
          assessmentId,
          idx,
          q.prompt,
          q.type ?? 'single',
          JSON.stringify(q.options),
          JSON.stringify(q.scoring),
          now()
        ]
      );
    });
  };

  // Creative Lab
  const creativeId = ensureAssessment(
    'ecom-creative-lab',
    '创意工坊区·主图与页面实战（深度版）',
    '从主图点击到详情转化：用设计/文案/实验把卖点做成“想点想买”。',
    'scenario',
    { zone: 'creative' }
  );
  replaceQuestions(creativeId, [
    {
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
      prompt: '场景②：详情页跳失高。你更倾向怎么改？',
      options: [
        { id: 'C', label: '先做“模块化结构”：痛点-卖点-对比-保障-FAQ，按模板重排。' },
        { id: 'A', label: '先做“风格升级”：更强氛围图与动效，提升高级感。' },
        { id: 'I', label: '先看热区与停留数据，找用户在哪一屏离开。' }
      ],
      scoring: {
        scoringByOption: { C: { C: 3, I: 1 }, A: { A: 3 }, I: { I: 3, C: 1 } },
        skillsByOption: {
          C: { process: 3, design_literacy: 1 },
          A: { design_literacy: 3 },
          I: { analysis: 3, experiment: 1 }
        }
      }
    },
    {
      prompt: '场景③：标题关键词怎么写更稳？',
      options: [
        { id: 'I', label: '先做关键词拆解：核心词+属性词+场景词，兼顾搜索与可读性。' },
        { id: 'A', label: '先做情绪文案：一句话击中痛点，哪怕不含很多关键词。' },
        { id: 'C', label: '先按类目规范写：不冒险，避免违规词。' }
      ],
      scoring: {
        scoringByOption: { I: { I: 2, C: 2 }, A: { A: 3 }, C: { C: 3 } },
        skillsByOption: {
          I: { analysis: 2, copywriting: 2, risk_control: 1 },
          A: { copywriting: 3, design_literacy: 1 },
          C: { risk_control: 3, process: 1 }
        }
      }
    },
    {
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
        }
      }
    },
    {
      prompt: '场景⑤：大促临近，主图需要“更想买”。你会强调？',
      options: [
        { id: 'A', label: '利益点可视化：把“省/快/爽”做成一眼可读的视觉锚点。' },
        { id: 'S', label: '信任与保障：把售后、承诺、口碑证据放大，降低顾虑。' },
        { id: 'C', label: '规格与参数：把信息补全，避免争议与误解。' }
      ],
      scoring: {
        scoringByOption: { A: { A: 3 }, S: { S: 3, C: 1 }, C: { C: 3 } },
        skillsByOption: {
          A: { design_literacy: 3, copywriting: 1 },
          S: { empathy: 2, risk_control: 2, copywriting: 1 },
          C: { process: 2, risk_control: 2 }
        }
      }
    },
    {
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
        }
      }
    }
  ]);

  // Frontline
  const frontlineId = ensureAssessment(
    'ecom-frontline',
    '前线交易所·客诉与门店联动（深度版）',
    '情绪+现场+闭环：把差评危机变成复购机会。',
    'scenario',
    { zone: 'frontline' }
  );
  replaceQuestions(frontlineId, [
    {
      prompt: '场景①：客户怒骂“超卖不发货”，准备差评。你怎么开口？',
      options: [
        { id: 'S', label: '先共情+道歉+给时间点：把情绪降下来，再谈方案。' },
        { id: 'C', label: '先按流程：让客户提供订单号，逐条核对，再回复。' },
        { id: 'E', label: '先强硬解释规则：客户理解了就不会差评。' }
      ],
      scoring: {
        scoringByOption: { S: { S: 4 }, C: { C: 3, S: 1 }, E: { E: 3 } },
        skillsByOption: {
          S: { empathy: 3, communication: 2 },
          C: { process: 3, communication: 1 },
          E: { communication: 1, risk_control: -1 }
        }
      }
    },
    {
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
        }
      }
    },
    {
      prompt: '场景③：门店现场排队爆炸，有顾客催促。你优先做？',
      options: [
        { id: 'R', label: '立刻分流：开临时取货通道/加人手，先让队伍动起来。' },
        { id: 'S', label: '先安抚解释：稳定情绪，避免冲突升级。' },
        { id: 'C', label: '先核对库存系统：防止错发漏发。' }
      ],
      scoring: {
        scoringByOption: { R: { R: 3, S: 1 }, S: { S: 3 }, C: { C: 3 } },
        skillsByOption: {
          R: { execution: 3, store_ops: 2 },
          S: { communication: 2, empathy: 2 },
          C: { process: 3, risk_control: 1 }
        }
      }
    },
    {
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
        }
      }
    },
    {
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
        }
      }
    },
    {
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
        }
      }
    }
  ]);

  // Data Ops (upgrade existing slug)
  const dataOpsId = ensureAssessment(
    'ecom-data-ops',
    '流量中枢塔·数据操盘（深度版）',
    '从异常检测到归因止损：用指标与实验救回转化。',
    'scenario',
    { zone: 'data_ops' }
  );
  replaceQuestions(dataOpsId, [
    {
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
        }
      }
    },
    {
      prompt: '场景②：你要确认问题是不是“流量变了”。你会看？',
      options: [
        { id: 'I', label: '看人群与渠道：新客/老客、计划/关键词、来源占比变化。' },
        { id: 'C', label: '看报表总览：先对齐口径，再逐层下钻。' },
        { id: 'E', label: '看竞品：别人是不是在抢你流量。' }
      ],
      scoring: {
        scoringByOption: { I: { I: 3, C: 1 }, C: { C: 3 }, E: { E: 2, I: 1 } },
        skillsByOption: {
          I: { analysis: 3, data_literacy: 2 },
          C: { process: 3, data_literacy: 1 },
          E: { planning: 2, leadership: 1 }
        }
      }
    },
    {
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
        }
      }
    },
    {
      prompt: '场景④：要快速恢复转化，你更倾向先优化哪一段？',
      options: [
        { id: 'A', label: '主图/标题：提升CTR，先把点击质量拉上来。' },
        { id: 'C', label: '计划结构：分层出价/否词，控制人群与成本。' },
        { id: 'S', label: '客服承接：优化咨询转化与催付话术。' }
      ],
      scoring: {
        scoringByOption: { A: { A: 2, I: 1 }, C: { C: 3 }, S: { S: 3 } },
        skillsByOption: {
          A: { design_literacy: 2, copywriting: 1 },
          C: { process: 3, data_literacy: 2 },
          S: { communication: 2, empathy: 1 }
        }
      }
    },
    {
      prompt: '场景⑤：你要把“经验”沉淀成系统。你会做？',
      options: [
        { id: 'C', label: '做告警阈值 + 操作SOP：出现什么指标→做什么动作。' },
        { id: 'I', label: '做实验库：每次优化记录假设、改动、结果，形成方法论。' },
        { id: 'E', label: '做目标看板：每日盯 GMV/ROI/转化，推动团队执行。' }
      ],
      scoring: {
        scoringByOption: { C: { C: 3 }, I: { I: 3, C: 1 }, E: { E: 3, C: 1 } },
        skillsByOption: {
          C: { process: 3, risk_control: 2 },
          I: { experiment: 3, analysis: 2 },
          E: { planning: 3, leadership: 2 }
        }
      }
    },
    {
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
        }
      }
    }
  ]);
}

function upsertAssessmentsV4(db) {
  const now = () => new Date().toISOString();

  const ensureAssessment = (slug, title, description, kind, config) => {
    const row = db.get('select id from assessments where slug = ?', [slug]);
    if (row?.id) {
      db.run(
        `update assessments set title = ?, description = ?, kind = ?, config_json = ?, is_active = 1 where id = ?`,
        [title, description, kind, JSON.stringify(config ?? {}), row.id]
      );
      return row.id;
    }
    const id = `a_${Math.random().toString(16).slice(2, 12)}`;
    db.run(
      `insert into assessments(id, slug, title, description, kind, config_json, is_active, created_at)
       values(?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, slug, title, description, kind, JSON.stringify(config ?? {}), now()]
    );
    return id;
  };

  const replaceQuestions = (assessmentId, questions) => {
    db.run('delete from questions where assessment_id = ?', [assessmentId]);
    questions.forEach((q, idx) => {
      db.run(
        `insert into questions(id, assessment_id, order_index, prompt, type, options_json, scoring_json, is_active, created_at)
         values(?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          `q_${Math.random().toString(16).slice(2, 12)}`,
          assessmentId,
          idx,
          q.prompt,
          q.type ?? 'single',
          q.options === undefined ? null : JSON.stringify(q.options),
          JSON.stringify(q.scoring ?? {}),
          now()
        ]
      );
    });
  };

  // Creative Lab (6 scenes: mix of single/drag/fill)
  const creativeId = ensureAssessment(
    'ecom-creative-lab',
    '创意工坊区·主图与页面实战（技能版）',
    '包含拖拽排序/填空任务：测“视觉表达+文案+实验验证”。',
    'scenario',
    { zone: 'creative', version: 2 }
  );
  replaceQuestions(creativeId, [
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
      prompt: '场景④：你要证明“改图改标题”有效，最像专业做法的是？',
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
      prompt: '场景⑥：主播要发微博挂你。公关海报第一原则是？',
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
  ]);

  // Frontline (6 scenes: mix of fill/drag/single)
  const frontlineId = ensureAssessment(
    'ecom-frontline',
    '前线交易所·客诉与门店联动（技能版）',
    '包含话术填空/现场排序：测“共情沟通+执行+流程”。',
    'scenario',
    { zone: 'frontline', version: 2 }
  );
  replaceQuestions(frontlineId, [
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
  ]);

  // Data Ops (6 scenes: mix of single/cmd/drag)
  const dataOpsId = ensureAssessment(
    'ecom-data-ops',
    '流量中枢塔·数据操盘（技能版）',
    '包含终端命令题/诊断排序：测“数据素养+归因+止损”。',
    'scenario',
    { zone: 'data_ops', version: 2 }
  );
  replaceQuestions(dataOpsId, [
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
  ]);
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
