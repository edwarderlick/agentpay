import { cn } from "@/lib/utils";

export function EditorialCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
}) {
  return (
    <Tag className={cn("bg-white text-on-surface border border-[#e6e2d9]", className)}>
      {children}
    </Tag>
  );
}
