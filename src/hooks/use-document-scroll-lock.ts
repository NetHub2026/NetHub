import { useEffect } from "react";

/** Reversible body lock; the modal owns focus and its interior scrolling. */
export function useDocumentScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const x = window.scrollX;
    const y = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const overscroll = documentElement.style.overscrollBehavior;
    const behavior = documentElement.style.scrollBehavior;
    Object.assign(body.style, {
      position: "fixed",
      top: `-${y}px`,
      left: `-${x}px`,
      width: "100%",
      overflow: "hidden",
    });
    documentElement.style.overscrollBehavior = "none";
    return () => {
      Object.assign(body.style, previous);
      documentElement.style.overscrollBehavior = overscroll;
      documentElement.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      documentElement.style.scrollBehavior = behavior;
    };
  }, [open]);
}
