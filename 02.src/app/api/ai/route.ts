import { NextResponse } from 'next/server';

import { evaluateRecord, type EvaluationKind } from '../../../lib/ai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    kind?: EvaluationKind;
    title?: string;
    content?: string;
    extraContext?: Record<string, unknown>;
  };

  const kind = payload.kind ?? 'knowledge';
  const title = String(payload.title ?? '').trim();
  const content = String(payload.content ?? '').trim();

  if (!title && !content) {
    return NextResponse.json({ error: 'title or content is required' }, { status: 400 });
  }

  const result = await evaluateRecord(kind, title, content, payload.extraContext ?? {});

  return NextResponse.json(result, { status: 200 });
}
