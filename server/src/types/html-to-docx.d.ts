declare module 'html-to-docx' {
  export type HtmlToDocxMargins = { top: number; right: number; bottom: number; left: number };

  export type HtmlToDocxOptions = {
    title?: string;
    lang?: string;
    font?: string;
    fontSize?: number;
    margins?: HtmlToDocxMargins;
    creator?: string;
    header?: boolean;
    footer?: boolean;
    pageNumber?: boolean;
  };

  /** 반환 타입은 런타임에 Buffer / ArrayBuffer / Blob 등으로 달라질 수 있음 */
  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    options?: HtmlToDocxOptions,
    footerHTMLString?: string | null
  ): Promise<Buffer | ArrayBuffer | Blob>;

  export default HTMLtoDOCX;
}
