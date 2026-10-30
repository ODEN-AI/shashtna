import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "glow" | "glass" | "vip" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-[background-color,color,border-color,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "border border-line-strong bg-surface-2 text-ink hover:border-ink-3 hover:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
  // White on dark grounds (the strongest call on a page).
  glow: "bg-white text-canvas hover:bg-glow",
  // For controls over a coloured field.
  glass: "glass-soft text-white hover:bg-white/15",
  // VIP actions: champagne with dark ink.
  vip: "bg-vip text-vip-ink hover:brightness-105",
  // On the IPTV cobalt field: white with the field's deep blue.
  light: "bg-white text-iptv-deep hover:bg-iptv-ink",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  external?: boolean;
  prefetch?: boolean;
  "aria-label"?: string;
};

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  external,
  prefetch,
  ...rest
}: LinkButtonProps) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass(variant, size, className)}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
