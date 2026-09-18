export type EvaluationKind = 'knowledge' | 'skill' | 'achievement';

export type EvaluationResult = {
  points: number;
  reason: string;
  title?: string;
  summary?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
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
        'X-Title': 'Safety Quest',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a precise engineering productivity evaluator. Return only JSON with keys: points, reason, riskLevel. Use integer points between 0 and 100. riskLevel must be low|medium|high|critical.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              kind,
              title,
              content,
              extraContext,
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

    if (typeof parsed.points === 'number') {
      return {
        points: Math.max(0, Math.min(100, parsed.points)),
        reason: typeof parsed.reason === 'string' ? parsed.reason : 'AI判定: この記録から価値が高いと評価しました。',
        riskLevel: parsed.riskLevel as EvaluationResult['riskLevel'] | undefined,
      };
    }
  } catch {
    // Fallback intentionally kept below.
  }

  return fallbackEvaluation(kind, title, content);
}
