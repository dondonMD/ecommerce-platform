import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

/**
 * Shopping cart page
 * Display cart items, update quantities, and proceed to checkout
 */
export default function Cart() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [shippingAddress, setShippingAddress] = useState("");

  // Fetch cart
  const { data: cartItems = [], refetch } = trpc.cart.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Mutations
  const updateItemMutation = trpc.cart.updateItem.useMutation({
    onSuccess: () => refetch(),
  });

  const removeItemMutation = trpc.cart.removeItem.useMutation({
    onSuccess: () => refetch(),
  });

  const clearCartMutation = trpc.cart.clear.useMutation({
    onSuccess: () => refetch(),
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (order) => {
      setLocation(`/checkout/${order.id}`);
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">Please sign in to view your cart</p>
            <Button
              className="w-full"
              onClick={() => window.location.href = "/api/oauth/login"}
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = cartItems.reduce((sum, item) => {
    const price = typeof item.product?.price === 'string'
      ? parseFloat(item.product.price)
      : item.product?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  const handleCheckout = () => {
    if (!shippingAddress.trim()) {
      alert("Please enter a shipping address");
      return;
    }
    createOrderMutation.mutate({ shippingAddress });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">Shopping Cart</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            {cartItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-600 mb-4">Your cart is empty</p>
                  <Button onClick={() => setLocation("/products")}>
                    Continue Shopping
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="py-6">
                      <div className="flex gap-4">
                        <div className="w-24 h-24 bg-slate-200 rounded flex items-center justify-center flex-shrink-0">
                          {item.product?.imageUrl ? (
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="text-slate-400">No image</div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-2">
                            {item.product?.name}
                          </h3>
                          <p className="text-slate-600 mb-4">
                            ${typeof item.product?.price === 'string'
                              ? item.product.price
                              : String(item.product?.price || 0)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateItemMutation.mutate({
                                  productId: item.productId,
                                  quantity: Math.max(0, item.quantity - 1),
                                })
                              }
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemMutation.mutate({
                                  productId: item.productId,
                                  quantity: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-16 text-center"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateItemMutation.mutate({
                                  productId: item.productId,
                                  quantity: item.quantity + 1,
                                })
                              }
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg mb-4">
                            ${(
                              (typeof item.product?.price === 'string'
                                ? parseFloat(item.product.price)
                                : item.product?.price || 0) * item.quantity
                            ).toFixed(2)}
                          </p>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              removeItemMutation.mutate(item.productId)
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => clearCartMutation.mutate()}
                >
                  Clear Cart
                </Button>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="border-t border-slate-200 pt-4 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                {cartItems.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Shipping Address
                      </label>
                      <textarea
                        placeholder="Enter your shipping address"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        rows={3}
                      />
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleCheckout}
                      disabled={createOrderMutation.isPending}
                    >
                      {createOrderMutation.isPending ? "Processing..." : "Proceed to Checkout"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
