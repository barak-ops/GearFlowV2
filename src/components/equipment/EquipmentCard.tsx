import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { Plus, Check } from "lucide-react";

interface EquipmentStatus {
    id: string;
    name: string;
    is_rentable: boolean;
}

interface EquipmentItem {
  id: string;
  name: string;
  status_id: string;
  equipment_statuses: EquipmentStatus | null;
  categories: { name: string } | null;
  image_url: string | null;
  category_id: string;
}

interface EquipmentCardProps {
  item: EquipmentItem;
}

// We no longer rely on fixed status strings, but we can define colors based on common names or rentability
const getStatusColor = (statusName: string, isRentable: boolean) => {
    if (statusName === 'זמין') return 'bg-green-500 hover:bg-green-600';
    if (statusName === 'מושכר') return 'bg-yellow-500';
    if (statusName === 'בתיקון') return 'bg-orange-500';
    if (!isRentable) return 'bg-red-500';
    return 'bg-gray-500'; // Default for custom statuses
};

export function EquipmentCard({ item }: EquipmentCardProps) {
  const { addToCart, isInCart } = useCart();
  const isItemInCart = isInCart(item.id);
  const status = item.equipment_statuses;
  const isAvailableForRent = status?.is_rentable ?? false;

  const statusName = status?.name || 'לא ידוע';
  const statusColor = getStatusColor(statusName, isAvailableForRent);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{item.name}</CardTitle>
        <Badge variant="secondary" className="w-fit">{item.categories?.name || 'ללא קטגוריה'}</Badge>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover rounded-md mb-4" />
        ) : (
          <div className="w-full h-32 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 mb-4">
            אין תמונה
          </div>
        )}
        <Badge className={`border-transparent text-white ${statusColor}`}>
          {statusName}
        </Badge>
      </CardContent>
      <CardFooter className="pt-4">
        <Button 
          onClick={() => addToCart(item)} 
          disabled={!isAvailableForRent || isItemInCart}
          className="w-full"
        >
          {isItemInCart ? <><Check className="ml-2 h-4 w-4" /> הוסף לבקשה</> : <><Plus className="ml-2 h-4 w-4" /> הוספה לבקשה</>}
        </Button>
      </CardFooter>
    </Card>
  );
}