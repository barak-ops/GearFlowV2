import React, { createContext, useContext, useState, ReactNode } from 'react';

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

interface CartContextType {
  cart: EquipmentItem[];
  addToCart: (item: EquipmentItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  isInCart: (itemId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<EquipmentItem[]>([]);

  const addToCart = (item: EquipmentItem) => {
    // Only add if the item is rentable and not already in the cart
    const isRentable = item.equipment_statuses?.is_rentable ?? false;

    setCart((prevCart) => {
      if (prevCart.find(cartItem => cartItem.id === item.id)) {
        return prevCart; // Item already in cart
      }
      if (!isRentable) {
        return prevCart; // Item not rentable
      }
      return [...prevCart, item];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const isInCart = (itemId: string) => {
    return cart.some(item => item.id === itemId);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
};