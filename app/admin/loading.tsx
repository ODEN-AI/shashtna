import { SkeletonBlock } from "@/app/ui/States";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy>
      <SkeletonBlock className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <SkeletonBlock key={item} className="h-28 rounded-card" />
        ))}
      </div>
      <SkeletonBlock className="h-96 w-full rounded-card" />
    </div>
  );
}
