import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import type { PageDef, Role } from './pages.js';

const client = new Anthropic();

export interface PageDescription {
  /** 화면 한 줄 요약 */
  summary: string;
  /** 마크다운 형식의 전체 설명 (기능, 사용법, FAQ 포함) */
  markdown: string;
}

function roleLabel(role: Role): string {
  return role === 'admin' ? '관리자(마케터)' : '팀장';
}

function buildPrompt(page: PageDef): string {
  return `당신은 청소비서 SaaS 솔루션의 사용자 매뉴얼을 작성하는 전문가입니다.

아래 스크린샷은 청소비서 솔루션의 **${page.title}** 화면입니다.
- 사용자 역할: **${roleLabel(page.role)}**
- 모듈: ${page.module}
${page.hint ? `- 화면 설명 힌트: ${page.hint}` : ''}

다음 형식으로 정확히 작성해 주세요. 스크린샷에 보이는 내용만 기반으로 작성하고, 보이지 않는 기능은 추측하지 마세요.

---

## 화면 소개
(2~3문장. 이 화면이 어떤 업무를 지원하는지 설명)

## 주요 기능
- (스크린샷에 보이는 버튼·필드·섹션 기준으로 항목 나열)

## 사용 방법
1. (단계별로 설명. 최대 7단계)

## 자주 묻는 질문 (FAQ)
**Q: (예상되는 사용자 질문 1)**
A: (답변)

**Q: (예상되는 사용자 질문 2)**
A: (답변)

---

주의사항:
- 기술 용어 대신 업무 현장 언어를 사용하세요
- "관리자" 또는 "팀장"이라는 호칭을 명시하세요
- 청소 업계 맥락(배정, 현장, 팀장, 접수 등)에 맞게 작성하세요`;
}

async function describeSingle(
  screenshotPath: string,
  page: PageDef,
  extraHint?: string,
): Promise<string> {
  const imageData = fs.readFileSync(screenshotPath);
  const base64 = imageData.toString('base64');

  const prompt = extraHint
    ? buildPrompt(page) + `\n\n추가 컨텍스트: ${extraHint}`
    : buildPrompt(page);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  return text;
}

export async function describeCapture(
  screenshotPath: string,
  page: PageDef,
): Promise<PageDescription> {
  const markdown = await describeSingle(screenshotPath, page);

  // 첫 번째 ## 이전의 한 줄 요약 추출 (없으면 title 사용)
  const summaryMatch = markdown.match(/^##\s*화면 소개\s*\n+([^\n]+)/m);
  const summary = summaryMatch ? summaryMatch[1].trim() : page.title;

  return { summary, markdown };
}

export async function describeAll(
  captures: Array<{
    page: PageDef;
    screenshotPath: string;
    error?: string;
  }>,
  onProgress?: (done: number, total: number, title: string) => void,
): Promise<Map<string, PageDescription>> {
  const results = new Map<string, PageDescription>();
  const successful = captures.filter((c) => !c.error);

  for (let i = 0; i < successful.length; i++) {
    const capture = successful[i];
    const key = `${capture.page.role}::${capture.page.path}`;
    onProgress?.(i, successful.length, capture.page.title);
    console.log(`  📝 설명 생성: ${capture.page.title}`);

    try {
      const desc = await describeCapture(capture.screenshotPath, capture.page);
      results.set(key, desc);
    } catch (e) {
      console.warn(`  ⚠ 설명 생성 실패 (${capture.page.title}):`, e instanceof Error ? e.message : e);
      results.set(key, {
        summary: capture.page.title,
        markdown: `> 이 화면의 설명을 자동으로 생성하지 못했습니다. 수동으로 작성해 주세요.`,
      });
    }
  }

  return results;
}
