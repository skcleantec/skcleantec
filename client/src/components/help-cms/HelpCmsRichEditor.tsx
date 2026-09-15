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
import { HelpCmsDesignedArticle } from './HelpCmsDesignedArticleExtension';
import { HelpCmsUiEmbed } from './HelpCmsUiEmbedExtension';
import {
  designedArticleHasLocalImages,
  isPackagedDesignedArticleHtml,
  serializeEditorHtmlWithDesigned,
  tryPackageDesignedArticle,
} from './helpCmsDesignedArticlePaste';
import { structuredHtmlFromPlainPaste } from './helpCmsPasteHtml';

/** HMR·코드 변경 후에도 확장이 빠진 구 에디터 인스턴스가 남지 않게 */
const EDITOR_BUILD = 'help-cms-blog-v2';

const EDITOR_PROSE_CLASS =
  'min-h-[420px] rounded-b-xl border border-slate-200 border-t-0 bg-white px-4 py-4 text-fluid-sm leading-relaxed text-slate-900 focus:outline-none prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-img:rounded-xl prose-img:shadow-sm prose-a:text-sky-700';

type Props = {
  value: string;
  onChange: (next: string) => void;
  editorKey: string;
  onUploadImage: (file: File) => Promise<string>;
  onUploadFile?: (file: File) => Promise<{ url: string; fileName: string }>;
  onUploadError?: (message: string) => void;
  placeholder?: string;
  /** 공지처럼 Enter=한 줄, Shift+Enter=문단 */
  enterAsLineBreak?: boolean;
  enableAttachments?: boolean;
};

/** 네이버 블로그형 WYSIWYG — 편집 화면 = 공개 /help HTML 본문 */
export function HelpCmsRichEditor({
  value,
  onChange,
  editorKey,
  onUploadImage,
  onUploadFile,
  onUploadError,
  placeholder = '본문을 입력하세요. 굵게·표·사진은 툴바로 넣고, 화면에 보이는 그대로 도움말에 게시됩니다.',
  enterAsLineBreak = false,
  enableAttachments = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef(onUploadImage);
  const uploadFileRef = useRef(onUploadFile);
  const uploadErrorRef = useRef(onUploadError);
  const onChangeRef = useRef(onChange);
  const skipExternalSyncRef = useRef(false);
  uploadRef.current = onUploadImage;
  uploadFileRef.current = onUploadFile;
  uploadErrorRef.current = onUploadError;
  onChangeRef.current = onChange;
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [designedImageHint, setDesignedImageHint] = useState(false);
  const initialContentRef = useRef(
    isPackagedDesignedArticleHtml(value)
      ? { type: 'doc', content: [{ type: 'designedArticle', attrs: { html: value } }] }
      : value === ''
        ? '<p></p>'
        : value,
  );
  const insertImageRef = useRef<(file: File) => Promise<void>>(async () => {});
  const insertPastedHtmlRef = useRef<(html: string) => void>(() => {});

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
        HelpCmsDesignedArticle,
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
        handleKeyDown: (_view, event) => {
          if (!enterAsLineBreak) return false;
          if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey) return false;
          const ed = _view;
          const { $from } = ed.state.selection;
          for (let d = $from.depth; d > 0; d -= 1) {
            const name = $from.node(d).type.name;
            if (name === 'listItem' || name === 'codeBlock' || name === 'tableCell' || name === 'tableHeader') {
              return false;
            }
          }
          const hardBreak = ed.state.schema.nodes.hardBreak;
          if (!hardBreak) return false;
          ed.dispatch(ed.state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView());
          return true;
        },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []);
          const image = files.find((f) => f.type.startsWith('image/'));
          if (image) {
            event.preventDefault();
            void insertImageRef.current(image);
            return true;
          }
          const clipHtml = event.clipboardData?.getData('text/html')?.trim() ?? '';
          const plain = event.clipboardData?.getData('text/plain') ?? '';
          const designed = tryPackageDesignedArticle(clipHtml) ?? tryPackageDesignedArticle(plain);
          if (designed) {
            event.preventDefault();
            insertPastedHtmlRef.current(designed);
            return true;
          }
          if (clipHtml) return false;
          const structured = structuredHtmlFromPlainPaste(plain);
          if (!structured) return false;
          event.preventDefault();
          insertPastedHtmlRef.current(structured);
          return true;
        },
        handleDrop: (_view, event) => {
          const files = Array.from(event.dataTransfer?.files ?? []);
          const image = files.find((f) => f.type.startsWith('image/'));
          if (!image) return false;
          event.preventDefault();
          void insertImageRef.current(image);
          return true;
        },
      },
      content: initialContentRef.current,
      onUpdate: ({ editor: ed }) => {
        skipExternalSyncRef.current = true;
        onChangeRef.current(serializeEditorHtmlWithDesigned(ed));
      },
    },
    [editorKey, EDITOR_BUILD, enterAsLineBreak],
  );

  useEffect(() => {
    if (!editor) return;
    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      return;
    }
    const incoming = value ?? '';
    const current = serializeEditorHtmlWithDesigned(editor);
    if (incoming === current) return;
    if (isPackagedDesignedArticleHtml(incoming)) {
      editor.commands.setContent(
        {
          type: 'doc',
          content: [{ type: 'designedArticle', attrs: { html: incoming } }],
        },
        { emitUpdate: false },
      );
      return;
    }
    editor.commands.setContent(incoming === '' ? '<p></p>' : incoming, { emitUpdate: false });
  }, [value, editor]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) {
        const msg = '에디터를 준비 중입니다. 잠시 후 다시 시도해 주세요.';
        setLocalError(msg);
        uploadErrorRef.current?.(msg);
        return;
      }
      if (uploading) return;

      setUploading(true);
      setLocalError('');
      try {
        const url = await uploadRef.current(file);
        const inserted = editor.chain().focus().setImage({ src: url, alt: file.name || '' }).run();
        if (!inserted) {
          throw new Error('에디터에 사진을 넣지 못했습니다. 페이지를 새로고침(F5) 후 다시 시도해 주세요.');
        }
        skipExternalSyncRef.current = true;
        onChangeRef.current(serializeEditorHtmlWithDesigned(editor));
      } catch (e) {
        const msg = e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.';
        setLocalError(msg);
        uploadErrorRef.current?.(msg);
      } finally {
        setUploading(false);
      }
    },
    [editor, uploading],
  );
  insertImageRef.current = insertImage;
  insertPastedHtmlRef.current = (html) => {
    if (!editor) return;
    const packaged = tryPackageDesignedArticle(html) ?? (isPackagedDesignedArticleHtml(html) ? html : null);
    if (packaged) {
      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'designedArticle', attrs: { html: packaged } }],
      });
      skipExternalSyncRef.current = true;
      onChangeRef.current(packaged);
      setDesignedImageHint(designedArticleHasLocalImages(packaged));
      return;
    }
    editor.chain().focus().insertContent(html).run();
    skipExternalSyncRef.current = true;
    onChangeRef.current(serializeEditorHtmlWithDesigned(editor));
    setDesignedImageHint(false);
  };

  const insertAttachment = useCallback(
    async (file: File) => {
      if (!editor || !uploadFileRef.current) return;
      if (uploading) return;
      setUploading(true);
      setLocalError('');
      try {
        const uploaded = await uploadFileRef.current(file);
        const label = (uploaded.fileName || file.name || '첨부파일')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const href = uploaded.url.replace(/"/g, '');
        editor
          .chain()
          .focus()
          .insertContent(`<p><a href="${href}" target="_blank" rel="noopener">${label}</a></p>`)
          .run();
        skipExternalSyncRef.current = true;
        onChangeRef.current(serializeEditorHtmlWithDesigned(editor));
      } catch (e) {
        const msg = e instanceof Error ? e.message : '첨부 업로드에 실패했습니다.';
        setLocalError(msg);
        uploadErrorRef.current?.(msg);
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
        .help-cms-rich-editor .ProseMirror p {
          margin: 0.2em 0;
        }
        .help-cms-rich-editor .cbiseo-designed-article-host {
          outline: 1px dashed #cbd5e1;
          border-radius: 12px;
          padding: 4px;
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-1 rounded-t-xl border-b border-slate-200 bg-white px-2 py-2">
        <TbBtn title="굵게" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </TbBtn>
        <TbBtn
          title="기울임"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </TbBtn>
        <TbBtn
          title="밑줄"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </TbBtn>
        <TbBtn
          title="왼쪽 정렬"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          좌
        </TbBtn>
        <TbBtn
          title="가운데 정렬"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          중
        </TbBtn>
        <TbBtn
          title="오른쪽 정렬"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          우
        </TbBtn>
        <TbBtn
          title="링크"
          active={editor.isActive('link')}
          onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined;
            const next = window.prompt('링크 주소', prev || 'https://');
            if (next == null) return;
            const href = next.trim();
            if (!href) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().setLink({ href }).run();
          }}
        >
          링크
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
        {enableAttachments ? (
          <label
            title="파일 첨부"
            className={`cursor-pointer rounded border px-2 py-1 text-fluid-xs ${
              uploading
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            첨부
            <input
              ref={attachRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp,.zip,.txt,application/pdf"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void insertAttachment(file);
              }}
            />
          </label>
        ) : null}
      </div>
      {enterAsLineBreak ? (
        <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-fluid-2xs text-slate-500">
          Enter는 한 줄 내림, Shift+Enter는 문단. 완성본 HTML(틀·색 포함)은 소스 전체 또는 브라우저에서
          전체 선택 후 붙여넣으면 그대로 들어갑니다. 마크다운(# 제목, 표)도 됩니다.
        </p>
      ) : null}
      {designedImageHint ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-fluid-2xs text-amber-800">
          글 틀과 색은 들어갔습니다. 사진 경로는 이 PC 폴더를 가리켜서 깨질 수 있습니다. 사진은 툴바
          「사진」으로 다시 올려 주세요.
        </p>
      ) : null}
      <EditorContent editor={editor} />
      {localError ? <p className="px-3 py-2 text-fluid-2xs text-red-600">{localError}</p> : null}
    </div>
  );
}
