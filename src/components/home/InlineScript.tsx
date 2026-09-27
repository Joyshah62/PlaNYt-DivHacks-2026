/**
 * A script that runs while the HTML is parsed (before first paint) on a full page load, and is
 * inert on client renders, where React would otherwise warn about <script> tags. Pattern from
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
