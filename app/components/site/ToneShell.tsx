import type { ReactNode } from "react";

import s from "@/app/components/home/home.module.css";

import tone from "./tone.module.css";

/**
 * The site's navy ground for pages built from the shared components (the
 * customer area, help, status, legal): the homepage colours plus `.tone`,
 * which re-tones those components here only.
 */
export function ToneShell({ children }: { children: ReactNode }) {
  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} ${tone.tone} -mt-[80px] pt-[80px] pb-16`}>{children}</div>
  );
}
