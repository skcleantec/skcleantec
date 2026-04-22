# Help text: `?` tooltip (HelpTooltip)

Use the shared component `client/src/components/ui/HelpTooltip.tsx` instead of long inline paragraphs.

## Behaviour

- **Desktop:** Hover the `?` button to show the explanation panel (`group-hover`).
- **Mobile / touch:** Tap `?` to open; tap outside or **Esc** to close (see `useEffect` listeners).
- Keep tooltip copy **short and actionable**; use `whitespace-pre-wrap` only when the string has intentional line breaks.

## Usage

```tsx
import { HelpTooltip } from '../../components/ui/HelpTooltip';

<HelpTooltip className="shrink-0" text="설명 문자열…" />
```

Place the `?` next to the label or section title it clarifies. Do not duplicate the same wall of text in the main layout.
