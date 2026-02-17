import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface CategoryFilterProps {
  categories: Category[] | undefined;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryFilter({ categories, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">סינון לפי קטגוריה</h3>
      <div className="grid gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'secondary' : 'ghost'}
          onClick={() => onSelectCategory('all')}
          className={cn("w-full justify-start", selectedCategory === 'all' && "font-bold")}
        >
          כל הקטגוריות
        </Button>
        {categories?.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'secondary' : 'ghost'}
            onClick={() => onSelectCategory(category.id)}
            className={cn("w-full justify-start", selectedCategory === category.id && "font-bold")}
          >
            {category.name}
          </Button>
        ))}
      </div>
    </div>
  );
}