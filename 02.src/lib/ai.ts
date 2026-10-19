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
    '知識の深さ、専門性、習得難易度を1件単独で評価し、複数の点数を加算しない。',
    '0〜20点: 基本用語や概要の理解。',
    '21〜40点: 基礎的な仕組みの理解。',
    '41〜60点: 専門的な知識や原理の理解。',
    '61〜80点: 高度な専門知識、複雑な設計知識。',
    '81〜100点: 非常に高度な専門知識、難関資格。',
    '資格取得の場合は試験範囲、知識の深さ、問題の難易度を考慮する。資格難易度の目安: Sランク85〜100点、Aランク70〜84点、Bランク50〜69点、Cランク30〜49点、Dランク10〜29点。',
  ].join('\n'),
  skill: [
    '実際に技術を使用する能力、作業の難易度、自律性を1件単独で評価する。',
    '0〜20点: 手順書に従った基本操作。',
    '21〜40点: 基本作業を一部自力で実施。',
    '41〜60点: 一般的な作業を自力で完遂。',
    '61〜80点: 高度な設計・構築・障害対応。',
    '81〜100点: 非常に高度な技術力、複雑な問題解決、技術指導。',
  ].join('\n'),
  achievement: [
    '達成した成果の規模、難易度、影響度、本人の貢献度を1件単独で評価する。',
    '0〜20点: 学習成果、簡単な制作物。',
    '21〜40点: 小規模な開発や改善実績。',
    '41〜60点: 業務システム開発、明確な成果。',
    '61〜80点: 高度なプロジェクト、大きな改善成果。',
    '81〜100点: 非常に高度な実績、組織やサービスへの大きな貢献。',
  ].join('\n'),
};

export function fallbackEvaluation(kind: EvaluationKind, title: string, content: string): EvaluationResult {
  const normalizedTitle = title.trim();
  const normalizedContent = content.trim();
  const text = `${normalizedTitle} ${normalizedContent}`.toLowerCase();

  if (kind === 'knowledge') {
    const rankMatch = /([sabcd])ランク/i.exec(text);
    const qualification = /資格|試験|認定|certificate|certification|exam/i.test(text);
    if (qualification && rankMatch) {
      const rankScores: Record<string, number> = { s: 92, a: 77, b: 60, c: 40, d: 20 };
      const rank = rankMatch[1].toLowerCase();
      return { points: rankScores[rank], reason: `AI判定: 記載された${rank.toUpperCase()}ランク資格として評価しました。` };
    }
    if (/難関資格|非常に高度|最先端の専門知識/.test(text)) {
      return { points: 90, reason: 'AI判定: 非常に高度な専門知識または難関資格の記載があります。' };
    }
    if (/高度な専門知識|高度な設計|複雑な設計知識/.test(text)) {
      return { points: 70, reason: 'AI判定: 高度な専門知識または複雑な設計知識の記載があります。' };
    }
    if (/専門的な知識|専門知識|原理|内部動作/.test(text)) {
      return { points: 50, reason: 'AI判定: 専門的な知識や原理の記載があります。' };
    }
    if (/基礎的な仕組み|基本的な仕組み|仕組みの理解|構造の理解/.test(text)) {
      return { points: 30, reason: 'AI判定: 基礎的な仕組みの理解が記載されています。' };
    }
    if (/基本用語|概要|用語の理解|入門/.test(text)) {
      return { points: 15, reason: 'AI判定: 基本用語や概要の理解として評価しました。' };
    }
    return { points: 10, reason: 'AI判定: 具体的な知識の深さを確認できないため控えめに評価しました。' };
  }

  if (kind === 'skill') {
    if (/技術指導|指導した|複雑な問題を解決|難解な問題を解決|mentor|mentoring|complex problem solving/i.test(text)) {
      return { points: 90, reason: 'AI判定: 複雑な問題解決または技術指導の記載があります。' };
    }
    if (/高度な設計|高度な構築|障害対応を主導|大規模障害|advanced design|incident response/i.test(text)) {
      return { points: 70, reason: 'AI判定: 高度な設計・構築または障害対応の記載があります。' };
    }
    if (/一部自力|基本作業を実施|設定変更|基本的な実装|partially independently/i.test(text)) {
      return { points: 30, reason: 'AI判定: 基本作業の一部を自力で実施した記載があります。' };
    }
    if (/自力で完遂|自力で実施|独力で|一人で完遂|independently completed/i.test(text)) {
      return { points: 50, reason: 'AI判定: 一般的な作業を自力で完遂した記載があります。' };
    }
    if (/手順書に従|手順通り|基本操作|手順に沿って|followed the instructions/i.test(text)) {
      return { points: 15, reason: 'AI判定: 手順書に従った基本操作の記載があります。' };
    }
    return { points: 10, reason: 'AI判定: 実際の使用能力や自律性を確認できないため控えめに評価しました。' };
  }

  if (/組織全体|全社|サービス全体|業界全体|大きな貢献|organization-wide|service-wide/i.test(text)) {
    return { points: 90, reason: 'AI判定: 組織やサービス全体への大きな貢献が記載されています。' };
  }
  if (/高度なプロジェクト|大規模プロジェクト|大幅な改善|大きな改善|significant improvement|large-scale project/i.test(text)) {
    return { points: 70, reason: 'AI判定: 高度なプロジェクトまたは大きな改善成果が記載されています。' };
  }
  if (/業務システム|明確な成果|定量的な成果|削減率|工数を.*削減|business system|measurable result/i.test(text)) {
    return { points: 50, reason: 'AI判定: 業務システム開発または明確な成果が記載されています。' };
  }
  if (/小規模な開発|小規模開発|個人開発|簡単な改善|small project|personal project/i.test(text)) {
    return { points: 30, reason: 'AI判定: 小規模な開発や改善実績が記載されています。' };
  }
  if (/学習成果|学習した|簡単な制作物|簡単なツール|learning outcome|simple prototype/i.test(text)) {
    return { points: 15, reason: 'AI判定: 学習成果または簡単な制作物として評価しました。' };
  }
  return { points: 10, reason: 'AI判定: 成果の規模や影響を確認できないため控えめに評価しました。' };
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
              'You are an engineering evaluator. Evaluate exactly one registered record of the requested kind. Give exactly one integer score from 0 to 100 and a concise Japanese reason. Use this record as evidence of what the person knows, can do, or achieved. You may use public facts about a qualification explicitly named in this record to judge its exam scope and difficulty, but do not assume it was passed or held unless stated. Never add points for other registrations, qualifications, experience, or abilities not stated in this record. Consider technical difficulty, do not reward years of experience alone, and score conservatively when details are insufficient. Return only JSON with keys points, reason, riskLevel. points must be an integer from 0 through 100. riskLevel, if included, must be low|medium|high|critical. Always write reason in natural Japanese.',
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

    if (typeof parsed.points === 'number' && Number.isInteger(parsed.points) && parsed.points >= 0 && parsed.points <= 100) {
      return {
        points: parsed.points,
        reason: typeof parsed.reason === 'string' ? parsed.reason : 'AI判定: この記録から価値が高いと評価しました。',
        riskLevel: parsed.riskLevel as EvaluationResult['riskLevel'] | undefined,
      };
    }
  } catch {
    // Fallback intentionally kept below.
  }

  return fallbackEvaluation(kind, title, content);
}
