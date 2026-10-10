<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Settings uses Radix modal primitives plus a reversible document scroll lock; this keeps nested confirmation, focus, and background position predictable.
- Scan presentation stores the detected count as optional scan metadata without changing device records; this preserves historical data and distinguishes each scan from the accumulated inventory.
- Device detail uses a Radix modal with a reversible body lock; focus, Escape and interior scrolling stay isolated from the background.
- Identity provenance is optional and per field; legacy stored types remain unverified and the shared manualEdit flag never proves which field was edited.
- Derived apparatus brand never falls back to OUI adapter vendor; this prevents a network card manufacturer being presented as the device brand.
- Vitest uses a standalone browser-safe configuration rather than the application Vite plugins; domain tests do not initialize SSR or publishing infrastructure.
