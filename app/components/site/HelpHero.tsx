import type { ReactNode } from "react";

import s from "@/app/components/home/home.module.css";
import { Container } from "@/app/ui/Page";

import h from "./help.module.css";

/** The head panel of the help, status and legal pages (inside ToneShell). */
export function HelpHero({ eyebrow, title, description }: { eyebrow: ReactNode; title: ReactNode; description?: ReactNode }) {
  return (
    <Container>
      <section className={h.hero}>
        <p className={s.kicker}>{eyebrow}</p>
        <h1 className={`${h.title} text-balance`}>{title}</h1>
        {description ? <p className={h.lead}>{description}</p> : null}
      </section>
    </Container>
  );
}
