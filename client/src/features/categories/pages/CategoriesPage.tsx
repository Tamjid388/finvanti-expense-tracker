import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceholderNotice } from "@/components/shared/PlaceholderNotice";

/** Wireframe categories screen: one list per type, add/edit/delete per row. */
export function CategoriesPage() {
  const groups = [
    { title: "Income categories", rows: 2 },
    { title: "Expense categories", rows: 3 },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Each category has a type, and duplicates per type are blocked.
          </p>
        </div>
        <Button size="sm" disabled>
          <Plus className="size-4" aria-hidden />
          Add category
        </Button>
      </header>

      <PlaceholderNotice />

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {Array.from({ length: group.rows }).map((_, row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-32" aria-hidden />
                  <Skeleton className="h-8 w-16" aria-hidden />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
