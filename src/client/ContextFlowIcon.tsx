/**
 * ContextFlowIcon: a book (notebook) glyph whose left gutter carries a
 * vertical up/down transfer arrow — text flowing into and out of the context
 * window. Inlined in this plugin (the shared icon set has no book), drawn to
 * match the 16px line style of the ui-primitives outline icons.
 */
export function ContextFlowIcon(props: { ariaHidden?: boolean }): JSX.Element {
  const { ariaHidden = true } = props
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16"
      fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={ariaHidden || undefined}
    >
      {/* Book outline */}
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.2" />
      {/* Content lines */}
      <path d="M8.7 5.6h3.6M8.7 8h3.6M8.7 10.4h3.6" />
      {/* Transfer gutter: vertical shaft + up/down arrowheads */}
      <path d="M4.2 3.4 2.7 5.4M4.2 3.4l1.5 2" />
      <path d="M4.2 4.6v6.8" />
      <path d="M4.2 12.6 2.7 10.6M4.2 12.6l1.5-2" />
    </svg>
  )
}
