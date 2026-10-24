/**
 * "Days left" wording for display. Arabic counts agree with the number:
 * 1 «يوم واحد», 2 «يومان», 3–10 «أيام», 11–99 «يومًا»; above 100 the last
 * two digits decide (101 «يوم», 102 «يومان», 105 «أيام», 111 «يومًا»).
 */
export function daysLeftAr(days: number) {
  const n = Math.max(0, Math.floor(days));

  if (n === 0) return "ينتهي اليوم";
  if (n === 1) return "باقي يوم واحد";
  if (n === 2) return "باقي يومان";

  const rest = n % 100;
  const noun = rest >= 3 && rest <= 10 ? "أيام" : rest >= 11 ? "يومًا" : rest === 2 ? "يومان" : "يوم";

  return `باقي ${n} ${noun}`;
}

export function daysLeftEn(days: number) {
  const n = Math.max(0, Math.floor(days));

  if (n === 0) return "ends today";
  return `${n} day${n === 1 ? "" : "s"} left`;
}
