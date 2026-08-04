import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Image from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { HelpCmsUiEmbed } from './HelpCmsUiEmbedExtension';

/** HMR·코드 변경 후에도 확장이 빠진 구 에디터 인스턴스가 남지 않게 */
const EDITOR_BUILD = 'help-cms-blog-v1';

const EDITOR_PROSE_CLASS =
  'min-h-[420px] rounded-b-xl border border-slate-200 border-t-0 bg-white px-4 py-4 text-fluid-sm leading-relaxed text-slate-900 focus:outline-none prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-img:rounded-xl prose-img:shadow-sm prose-a:text-sky-700';

type Props = {
  value: string;
  onChange: (next: string) => void;
  editorKey: string;
  onUploadImage: (file: File) => Promise<string>;
  onUploadError?: (message: string) => void;
  placeholder?: string;
};

/** 네이버 블로그형 WYSIWYG — 편집 화면 = 공개 /help HTML 본문 */
export function HelpCmsRichEditor({
  value,
  onChange,
  editorKey,
  onUploadImage,
  onUploadError,
  placeholder = '본문을 입력하세요. 굵게·표·사진은 툴바로 넣고, 화면에 보이는 그대로 도움말에 게시됩니다.',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef(onUploadImage);
  const uploadErrorRef = useRef(onUploadError);
  const onChangeRef = useRef(onChange);
  const skipExternalSyncRef = useRef(false);
  uploadRef.current = onUploadImage;
  uploadErrorRef.current = onUploadError;
  onChangeRef.current = onChange;
  const [uploading, setUploading] = useState(false);
  const initialContentRef = useRef(value === '' ? '<p></p>' : value);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          link: false,
          underline: false,
        }),
        Underline,
        HelpCmsUiEmbed,
        Image.configure({
          HTMLAttributes: {
            class: 'help-cms-editor-image max-w-full rounded-lg my-3',
          },
        }),
        Link.configure({ openOnClick: false, autolink: true }),
        TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
        Table.configure({
          resizable: true,
          HTMLAttributes: { class: 'help-cms-md-table' },
        }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({ placeholder }),
      ],
      editorProps: {
        attributes: {
          class: EDITOR_PROSE_CLASS,
        },
      },
      content: initialContentRef.current,
      onUpdate: ({ editor: ed }) => {
        skipExternalSyncRef.current = true;
        onChangeRef.current(ed.getHTML());
      },
    },
    [editorKey, EDITOR_BUILD],
  );

  useEffect(() => {
    if (!editor) return;
    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      return;
    }
    const incoming = value ?? '';
    const current = editor.getHTML();
    if (incoming === current) return;
    editor.commands.setContent(incoming === '' ? '<p></p>' : incoming, { emitUpdate: false });
  }, [value, editor]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) {
        uploadErrorRef.current?.('에디터를 준비 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      if (uploading) return;

      setUploading(true);
      try {
        const url = await uploadRef.current(file);
        const inserted = editor.chain().focus().setImage({ src: url, alt: '' }).run();
        if (!inserted) {
          throw new Error('에디터에 사진을 넣지 못했습니다. 페이지를 새로고침(F5) 후 다시 시도해 주세요.');
        }
        skipExternalSyncRef.current = true;
        onChangeRef.current(editor.getHTML());
      } catch (e) {
        uploadErrorRef.current?.(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.');
      } finally {
        setUploading(false);
      }
    },
    [editor, uploading],
  );

  const TbBtn = ({
    onClick,
    active,
    children,
    title,
    disabled,
  }: {
    onClick: () => void;
    active?: boolean;
    children: ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded border px-2 py-1 text-fluid-xs disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );

  if (!editor) return null;

  return (
    <div className="help-cms-rich-editor rounded-xl border border-slate-200 bg-slate-50/80">
      <style>{`
        .help-cms-rich-editor .ProseMirror img.help-cms-editor-image,
        .help-cms-rich-editor .ProseMirror img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 0.75rem 0;
          border-radius: 0.5rem;
        }
        .help-cms-rich-editor .ProseMirror table.help-cms-md-table,
        .help-cms-rich-editor .ProseMirror table {
          width: 100%;
          min-width: 280px;
          border-collapse: collapse;
          font-size: inherit;
        }
        .help-cms-rich-editor .ProseMirror table th,
        .help-cms-rich-editor .ProseMirror table td {
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          text-align: center;
          vertical-align: middle;
        }
        .help-cms-rich-editor .ProseMirror table th {
          background: #f8fafc;
          font-weight: 600;
        }
        .help-cms-rich-editor .ProseMirror blockquote {
          border-left: 4px solid #cbd5e1;
          padding-left: 1rem;
          color: #334155;
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-1 rounded-t-xl border-b border-slate-200 bg-white px-2 py-2">
        <TbBtn title="굵게" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </TbBtn>
        <TbBtn
          title="밑줄"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </TbBtn>
        <TbBtn
          title="제목"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </TbBtn>
        <TbBtn
          title="소제목"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </TbBtn>
        <TbBtn
          title="글머리"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • 목록
        </TbBtn>
        <TbBtn
          title="번호 목록"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. 목록
        </TbBtn>
        <TbBtn
          title="인용"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          인용
        </TbBtn>
        <TbBtn title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          ──
        </TbBtn>
        <TbBtn
          title="표 삽입"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          표
        </TbBtn>
        <TbBtn
          title="표 — 열 추가"
          disabled={!editor.can().addColumnAfter()}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          +열
        </TbBtn>
        <TbBtn
          title="표 — 행 추가"
          disabled={!editor.can().addRowAfter()}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          +행
        </TbBtn>
        <label
          title="사진 삽입"
          className={`cursor-pointer rounded border px-2 py-1 text-fluid-xs ${
            uploading
              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {uploading ? '업로드 중…' : '📷 사진'}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void insertImage(file);
            }}
          />
        </label>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
