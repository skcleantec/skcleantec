import { useCallback, useEffect, type ReactNode } from 'react';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { EC_ISSUER_PLACEHOLDER_OPTIONS } from '../../utils/eContractIssuerPlaceholders';
import { EC_SIGNER_PLACEHOLDER_OPTIONS } from '../../utils/eContractSignerExpand';

const FONT_SIZES = ['14px', '16px', '18px', '20px', '24px', '28px'];
const FONT_FACES = ['', 'ui-sans-serif, system-ui, sans-serif', 'Georgia, serif', 'monospace'];

type Props = {
  value: string;
  onChange: (next: string) => void;
  editorKey: string;
};

/** React 19 호환 — react-quill(findDOMNode) 미사용 */
export function EContractRichEditor({ value, onChange, editorKey }: Props) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
        }),
        TextStyle,
        FontFamily.configure({ types: ['textStyle'] }),
        Color.configure({ types: ['textStyle'] }),
        Highlight.configure({
          multicolor: true,
        }),
        FontSize.configure({
          types: ['textStyle'],
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Placeholder.configure({
          placeholder: '계약서 본문을 입력하고 툴바로 서식을 적용하세요.',
        }),
      ],
      editorProps: {
        attributes: {
          class:
            'min-h-[260px] rounded-b-md border border-gray-300 border-t-0 px-3 py-2 text-fluid-sm leading-relaxed text-gray-900 focus:outline-none',
        },
      },
      content: value === '' ? '<p></p>' : value,
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getHTML());
      },
    },
    [editorKey]
  );

  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? '';
    const current = editor.getHTML();
    if (incoming === current) return;
    editor.commands.setContent(incoming === '' ? '<p></p>' : incoming, { emitUpdate: false });
  }, [value, editor]);

  const TbBtn = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        /* 포커스 유지 */
        e.preventDefault();
      }}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded border px-2 py-1 text-fluid-xs ${
        active ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );

  const setLinkFromPrompt = useCallback(() => {
    if (!editor) return;
    const { empty } = editor.state.selection;
    const prevHref = editor.getAttributes('link').href as string | undefined;
    if (empty && !prevHref) {
      window.alert('링크를 넣을 텍스트를 먼저 선택하거나, 커서를 기존 링크 안에 두세요.');
      return;
    }
    const url = window.prompt('링크 주소(https://…)', prevHref || 'https://');
    if (url === null) return;
    const t = url.trim();
    if (t === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: t }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[312px] rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-fluid-xs text-gray-500">
        편집기 초기화 중…
      </div>
    );
  }

  return (
    <div className="e-contract-rich-editor min-w-0 [&_.ProseMirror]:min-h-[260px]" data-e-contract-editor-root={editorKey}>
      <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-gray-300 bg-gray-50 p-2">
        <TbBtn active={editor.isActive('paragraph')} title="본문" onClick={() => editor.chain().focus().setParagraph().run()}>
          본문
        </TbBtn>
        {[1, 2, 3].map((level) => (
          <TbBtn
            key={level}
            title={`제목${level}`}
            active={editor.isActive('heading', { level: level as 1 | 2 | 3 })}
            onClick={() =>
              editor
                .chain()
                .focus()
                .setHeading({ level: level as 1 | 2 | 3 })
                .run()
            }
          >
            H{level}
          </TbBtn>
        ))}

        <select
          className="rounded border border-gray-300 px-2 py-1 text-fluid-xs"
          aria-label="글꼴"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="">글꼴</option>
          {FONT_FACES.filter(Boolean).map((f) => (
            <option key={f} value={f}>
              {f.startsWith('ui-sans-serif') ? '고딕' : f.startsWith('Georgia') ? '명조' : '고정폭'}
            </option>
          ))}
        </select>

        <select
          className="rounded border border-gray-300 px-2 py-1 text-fluid-xs tabular-nums"
          aria-label="글자 크기"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="">크기</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="max-w-[9.5rem] truncate rounded border border-dashed border-blue-300 bg-white px-2 py-1 text-fluid-xs text-blue-900"
          aria-label="발행측 플레이스홀더 삽입"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().insertContent(v).run();
            e.target.value = '';
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="발행측(갑) 치환용 토큰 — 배포 시 프로필 정보로 채워집니다."
        >
          <option value="">+발행측</option>
          {EC_ISSUER_PLACEHOLDER_OPTIONS.map((o) => (
            <option key={o.token} value={o.token}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="max-w-[9.5rem] truncate rounded border border-dashed border-emerald-300 bg-white px-2 py-1 text-fluid-xs text-emerald-900"
          aria-label="체결측(을) 플레이스홀더 삽입"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().insertContent(v).run();
            e.target.value = '';
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="체결측이 본 페이지에서 입력·제출하면 치환되는 토큰입니다."
        >
          <option value="">+체결측</option>
          {EC_SIGNER_PLACEHOLDER_OPTIONS.map((o) => (
            <option key={o.token} value={o.token}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="mx-1 w-px self-stretch bg-gray-300" aria-hidden />

        <TbBtn active={editor.isActive('bold')} title="굵게" onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </TbBtn>
        <TbBtn active={editor.isActive('italic')} title="기울임" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </TbBtn>
        <TbBtn active={editor.isActive('underline')} title="밑줄" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </TbBtn>
        <TbBtn active={editor.isActive('strike')} title="취소선" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <s>S</s>
        </TbBtn>

        <span className="mx-1 w-px self-stretch bg-gray-300" aria-hidden />

        <label className="flex items-center gap-1 text-fluid-xs text-gray-700" title="글자 색">
          색
          <input
            type="color"
            className="h-8 w-9 cursor-pointer rounded border border-gray-300 p-0.5"
            defaultValue="#111827"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>

        <label className="flex items-center gap-1 text-fluid-xs text-gray-700" title="배경색(형광)">
          배경
          <input
            type="color"
            className="h-8 w-9 cursor-pointer rounded border border-gray-300 p-0.5"
            defaultValue="#fef08a"
            onChange={(e) =>
              editor
                .chain()
                .focus()
                .toggleHighlight({ color: e.target.value })
                .run()
            }
          />
        </label>

        <TbBtn
          title="형광 끄기"
          active={false}
          onClick={() => editor.chain().focus().unsetHighlight().run()}
        >
          형광X
        </TbBtn>

        <span className="mx-1 w-px self-stretch bg-gray-300" aria-hidden />

        {(['left', 'center', 'right', 'justify'] as const).map((a) => (
          <TbBtn
            key={a}
            title={a === 'justify' ? '양쪽 정렬' : `${a}`}
            active={editor.isActive({ textAlign: a })}
            onClick={() =>
              editor
                .chain()
                .focus()
                .setTextAlign(a)
                .run()
            }
          >
            {a === 'left'
              ? '왼쪽'
              : a === 'center'
                ? '가운데'
                : a === 'right'
                  ? '오른쪽'
                  : '양쪽'}
          </TbBtn>
        ))}

        <span className="mx-1 w-px self-stretch bg-gray-300" aria-hidden />

        <TbBtn
          title="글머리"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •목록
        </TbBtn>
        <TbBtn
          title="번호"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1목록
        </TbBtn>
        <TbBtn title="인용" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          인용
        </TbBtn>

        <span className="mx-1 w-px self-stretch bg-gray-300" aria-hidden />

        <TbBtn title="링크" active={editor.isActive('link')} onClick={setLinkFromPrompt}>
          링크
        </TbBtn>

        <TbBtn title="실행 취소" active={false} onClick={() => editor.chain().focus().undo().run()}>
          ↩
        </TbBtn>
        <TbBtn title="다시" active={false} onClick={() => editor.chain().focus().redo().run()}>
          ↪
        </TbBtn>
        <TbBtn
          title="서식 지우기(선택 구간)"
          active={false}
          onClick={() =>
            editor
              .chain()
              .focus()
              .unsetAllMarks()
              .clearNodes()
              .setParagraph()
              .unsetTextAlign()
              .run()
          }
        >
          지우기
        </TbBtn>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
