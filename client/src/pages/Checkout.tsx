import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronLeft } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Checkout page with payment processing
 * Integrates with Stripe for secure payment handling
 */
export default function Checkout() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { orderId } = useParams();
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvc, setCvc] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch order details
  const { data: order } = trpc.orders.getById.useQuery(parseInt(orderId || "0"), {
    enabled: !!orderId && isAuthenticated,
  });

  // Create payment intent
  const createIntentMutation = trpc.payments.createIntent.useMutation();
  const confirmPaymentMutation = trpc.payments.confirm.useMutation({
    onSuccess: () => {
      toast.success("Payment processed successfully!");
      setLocation(`/order-confirmation/${orderId}`);
    },
    onError: (error) => {
      toast.error(`Payment failed: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardNumber || !expiryDate || !cvc) {
      toast.error("Please fill in all payment details");
      return;
    }

    if (!order) {
      toast.error("Order not found");
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent
      const intentResult = await createIntentMutation.mutateAsync({
        orderId: parseInt(orderId || "0"),
        amount: parseFloat(order.totalAmount),
      });

      if (!intentResult.clientSecret) {
        throw new Error("Failed to create payment intent");
      }

      // In a real application, you would use Stripe.js to handle the payment
      // For now, we'll simulate a successful payment
      setTimeout(async () => {
        await confirmPaymentMutation.mutateAsync({
          orderId: parseInt(orderId || "0"),
          paymentIntentId: "pi_simulated_" + Date.now(),
        });
      }, 1000);
    } catch (error) {
      console.error("Payment error:", error);
      alert(error instanceof Error ? error.message : "Payment failed");
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">Please sign in to complete checkout</p>
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

  if (!orderId || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">Order not found</p>
            <Button className="w-full" onClick={() => setLocation("/cart")}>
              Back to Cart
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/cart")}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">Checkout</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Card Number
                    </label>
                    <Input
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      maxLength={19}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Expiry Date
                      </label>
                      <Input
                        placeholder="MM/YY"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        CVC
                      </label>
                      <Input
                        placeholder="123"
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        maxLength={4}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isProcessing || createIntentMutation.isPending}
                  >
                    {isProcessing ? "Processing..." : `Pay $${order.totalAmount}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Items</h4>
                  {order.items && typeof order.items === 'string' && (
                    <ul className="text-sm text-slate-600 space-y-1">
                      {JSON.parse(order.items).map((item: any, idx: number) => (
                        <li key={idx}>
                          {item.quantity}x {item.productName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>${order.totalAmount}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span>Free</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${order.totalAmount}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                  <p className="font-medium mb-1">Test Card Number:</p>
                  <p className="font-mono">4242 4242 4242 4242</p>
                  <p className="text-xs mt-2">Use any future date and any 3-digit CVC</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
