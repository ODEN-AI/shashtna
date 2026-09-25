import type { ReactNode } from "react";

import { Container, Eyebrow } from "@/app/ui/Page";

export function HelpHero({ eyebrow, title, description }: { eyebrow: ReactNode; title: ReactNode; description?: ReactNode }) {
  return (
    <section className="bg-cinema border-b border-line">
      <Container className="py-12 sm:py-16">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-4 max-w-2xl text-[15px] leading-8 text-ink-2">{description}</p> : null}
      </Container>
    </section>
  );
}
