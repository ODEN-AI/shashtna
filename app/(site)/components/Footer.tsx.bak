"use client";

import Link from "next/link";
import {
  Send,
  Tv2,
  MessageCircle,
} from "lucide-react";

import { useLanguage } from "./LanguageProvider";

export default function Footer() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  return (
    <footer
      dir={isArabic ? "rtl" : "ltr"}
      className="border-t border-slate-200 bg-slate-950 text-white"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* Brand */}
        <div className="lg:col-span-2">
          <Link
            href="/"
            className="mb-5 flex w-fit items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white">
              <Tv2 size={22} />
            </div>

            <div>
              <div className="text-xl font-black">
                Ø´Ø§Ø´ØªÙ†Ø§
              </div>

              <div className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-cyan-400">
                ENTERTAINMENT
              </div>
            </div>
          </Link>

          <p className="max-w-md text-sm leading-7 text-slate-400">
            {isArabic
              ? "Ù…Ù†ØµØ© Ø´Ø§Ø´ØªÙ†Ø§ ØªÙˆÙØ± Ù„Ùƒ Ø§Ø´ØªØ±Ø§ÙƒØ§Øª ØªØ±ÙÙŠÙ‡ÙŠØ© Ø¨Ø·Ø±ÙŠÙ‚Ø© Ø¨Ø³ÙŠØ·Ø© ÙˆÙˆØ§Ø¶Ø­Ø©ØŒ Ù…Ø¹ Ø¨Ø§Ù‚Ø§Øª ØªÙ†Ø§Ø³Ø¨ Ø§Ø­ØªÙŠØ§Ø¬Ø§ØªÙƒ ÙˆØ¯Ø¹Ù… ÙŠØ³Ø§Ø¹Ø¯Ùƒ Ø¨ÙƒÙ„ Ø®Ø·ÙˆØ©."
              : "Shashtna provides entertainment subscriptions in a simple and clear way, with plans that fit your needs and support whenever you need it."}
          </p>

          {/* Social */}
          <div className="mt-6 flex items-center gap-3">
            <a
              href="#"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
            >
              <MessageCircle size={18} />
            </a>

            <a
              href="https://t.me/shashtna" target="_blank" rel="noopener noreferrer" aria-label="Telegram"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:bg-cyan-500 hover:text-white"
            >
              <Send size={18} />
            </a>
          </div>
        </div>

        {/* Links */}
        <div>
          <h3 className="mb-5 text-sm font-bold text-white">
            {isArabic ? "Ø±ÙˆØ§Ø¨Ø· Ø³Ø±ÙŠØ¹Ø©" : "Quick links"}
          </h3>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©" : "Home"}
            </Link>

            <Link
              href="/plans"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ø§Ù„Ø¨Ø§Ù‚Ø§Øª" : "Plans"}
            </Link>

            <Link
              href="/apps"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª" : "Apps"}
            </Link>

            <Link
              href="/about"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ù…Ù† Ù†Ø­Ù†" : "About"}
            </Link>

            <Link
              href="/tickets"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ø§Ù„Ø¯Ø¹Ù… Ø§Ù„ÙÙ†ÙŠ" : "Support"}
            </Link>
          </div>
        </div>

        {/* Account */}
        <div>
          <h3 className="mb-5 text-sm font-bold text-white">
            {isArabic ? "Ø­Ø³Ø§Ø¨Ùƒ" : "Your account"}
          </h3>

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„" : "Sign in"}
            </Link>

            <Link
              href="/register"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨" : "Create account"}
            </Link>

            <Link
              href="/dashboard"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…" : "Dashboard"}
            </Link>

            <Link
              href="/subscriptions"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic
                ? "Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙŠ"
                : "My subscriptions"}
            </Link>

            <Link
              href="/orders"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "Ø·Ù„Ø¨Ø§ØªÙŠ" : "My orders"}
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>
            Â© {new Date().getFullYear()} Ø´Ø§Ø´ØªÙ†Ø§.{" "}
            {isArabic
              ? "Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø­Ù‚ÙˆÙ‚ Ù…Ø­ÙÙˆØ¸Ø©."
              : "All rights reserved."}
          </p>

          <div className="flex gap-5">
            <Link
              href="#"
              className="transition hover:text-slate-300"
            >
              {isArabic
                ? "Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø®ØµÙˆØµÙŠØ©"
                : "Privacy Policy"}
            </Link>

            <Link
              href="#"
              className="transition hover:text-slate-300"
            >
              {isArabic
                ? "Ø§Ù„Ø´Ø±ÙˆØ· ÙˆØ§Ù„Ø£Ø­ÙƒØ§Ù…"
                : "Terms & Conditions"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
