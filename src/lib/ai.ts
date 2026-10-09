export type EvaluationKind = 'knowledge' | 'skill' | 'achievement';

export type EvaluationResult = {
  points: number;
  reason: string;
  title?: string;
  summary?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
};

const scoringRubrics: Record<EvaluationKind, string> = {
  knowledge: [
    '採点順に評価し、各項目の根拠が入力にない場合は加点しない。',
    '1. 基礎点10KP。ナレッジとして気づきが記録されている。',
    '2. +10KP。状況や気づきが具体的である。',
    '3. +10KP。発見契機が明確である。',
    '4. +10KP。原因の認識がある。',
    '5. +10KP。次に活かす工夫や対策がある。',
    '6. +10KP。リスク目安がhighまたはcriticalである。',
    '合計は10KP刻み、最大60KP。',
  ].join('\n'),
  skill: [
    '次の順に確認し、最初に該当した最も高い段階だけを採用する。加算はしない。',
    '1. 50SP: 自動化、テスト、監視、CI/CD、スクリプト、lint、検証。',
    '2. 30SP: 設計、レビュー、分析、改善、再発防止、原因分析、要件、仕様。',
    '3. 20SP: 確認、手順、チェック、共有、記録、整理。',
    '4. いずれにも該当しない場合は10SP。',
  ].join('\n'),
  achievement: [
    '次の順に確認し、最初に該当した最も高い段階だけを採用する。加算はしない。',
    '1. 50AP: 障害、本番、リリース、改善、自動化、削減、解決、復旧、設計に関わる成果。',
    '2. 30AP: レビュー、共有、資料、標準化、手順、教育、支援、提案など、チームや将来に再利用できる成果。',
    '3. 20AP: 対応、確認、調査、整理、記録など、日々の業務改善につながる成果。',
    '4. いずれにも該当しない場合は10AP。',
  ].join('\n'),
};

const allowedPointValues: Record<EvaluationKind, number[]> = {
  knowledge: [10, 20, 30, 40, 50, 60],
  skill: [10, 20, 30, 50],
  achievement: [10, 20, 30, 50],
};

export function fallbackEvaluation(kind: EvaluationKind, title: string, content: string): EvaluationResult {
  const normalizedTitle = title.trim();
  const normalizedContent = content.trim();
  const text = `${normalizedTitle} ${normalizedContent}`.toLowerCase();

  if (kind === 'knowledge') {
    let points = 10;
    const reasons: string[] = ['気づきを記録できています'];

    if (normalizedContent.length >= 30) {
      points += 10;
      reasons.push('具体的な内容が書かれています');
    }
    if (/検知|発見|確認|照合|監視|レビュー|手順/.test(text)) {
      points += 10;
      reasons.push('再利用しやすい発見契機が含まれています');
    }
    if (/原因|対策|防止|改善|再発/.test(text)) {
      points += 10;
      reasons.push('原因と対策につながる記述になっています');
    }
    if (/本番|重大|影響|停止|障害|事故/.test(text)) {
      points += 10;
      reasons.push('高リスクに関わる知見として価値があります');
    }

    return {
      points: Math.min(points, 60),
      reason: `AI判定: ${reasons.join('。 ')}。`,
      riskLevel: points >= 40 ? 'high' : points >= 25 ? 'medium' : 'low',
    };
  }

  if (kind === 'skill') {
    if (/自動|テスト|監視|ci|cd|script|スクリプト|lint|検証/.test(text)) {
      return { points: 50, reason: 'AI判定: 自動化や検証の仕組みに関わるスキルのため50SPです。' };
    }
    if (/設計|レビュー|分析|改善|再発|原因|要件|仕様/.test(text)) {
      return { points: 30, reason: 'AI判定: 設計、分析、レビューに関わる再利用しやすいスキルのため30SPです。' };
    }
    if (/確認|手順|チェック|共有|記録|整理/.test(text)) {
      return { points: 20, reason: 'AI判定: 作業品質を安定させる基本スキルのため20SPです。' };
    }

    return { points: 10, reason: 'AI判定: 新しく言語化されたスキルとして10SPです。' };
  }

  if (/障害|本番|リリース|改善|自動|削減|解決|復旧|設計/.test(text)) {
    return { points: 50, reason: 'AI判定: 影響の大きい成果または改善実績として50APです。' };
  }
  if (/レビュー|共有|資料|標準化|手順|教育|支援|提案/.test(text)) {
    return { points: 30, reason: 'AI判定: チームや将来の作業に再利用できる実績として30APです。' };
  }
  if (/対応|確認|調査|整理|記録/.test(text)) {
    return { points: 20, reason: 'AI判定: 日々の業務改善につながる実績として20APです。' };
  }

  return { points: 10, reason: 'AI判定: 実績として記録された行動に10APです。' };
}

export async function evaluateRecord(
  kind: EvaluationKind,
  title: string,
  content: string,
  extraContext: Record<string, unknown> = {},
): Promise<EvaluationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';

  if (!apiKey) {
    return fallbackEvaluation(kind, title, content);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'skill hant',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise engineering productivity evaluator. Follow the provided scoring rubric in order, award points only when supported by the input, and use only the rubric\'s listed point values. Return only JSON with keys: points, reason, riskLevel. riskLevel must be low|medium|high|critical. Always write reason in natural Japanese, regardless of the input language.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              kind,
              title,
              content,
              extraContext,
              scoringRubric: scoringRubrics[kind],
            }),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return fallbackEvaluation(kind, title, content);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<EvaluationResult>;

    if (typeof parsed.points === 'number' && allowedPointValues[kind].includes(Math.round(parsed.points))) {
      return {
        points: Math.round(parsed.points),
        reason: typeof parsed.reason === 'string' ? parsed.reason : 'AI判定: この記録から価値が高いと評価しました。',
        riskLevel: parsed.riskLevel as EvaluationResult['riskLevel'] | undefined,
      };
    }
  } catch {
    // Fallback intentionally kept below.
  }

  return fallbackEvaluation(kind, title, content);
}
