import { Skeleton } from "~/components/ui/skeleton";

/**
 * Loading skeleton for the edit process page.
 * Displays while process data is being fetched.
 */
export default function EditProcessLoading() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-3xl">
        {/* Back link skeleton */}
        <Skeleton className="h-5 w-40 mb-4" />

        {/* Header skeleton */}
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96 mb-8" />

        {/* Progress indicator skeleton */}
        <div className="mb-8 space-y-4">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-12 hidden sm:block" />
              </div>
            ))}
          </div>
        </div>

        {/* Form content skeleton */}
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-6">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
