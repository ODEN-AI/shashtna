/** Only http(s) download links are rendered, never javascript: or data: URLs. */
export function safeHref(value: string | null | undefined) {
  const text = String(value ?? "").trim();

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (text.startsWith("/") && !text.startsWith("//")) {
    return text;
  }

  return null;
}
