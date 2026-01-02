import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Zap, Shield, Truck, Award } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * Home page - Landing page and product showcase
 * Features featured products, search, and call-to-action
 */
export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch featured products
  const { data: productsData } = trpc.products.list.useQuery({
    limit: 6,
    sortBy: 'newest',
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">EliteShop</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" onClick={() => setLocation("/cart")}>
                  Cart
                </Button>
                <Button variant="ghost" onClick={() => setLocation("/orders")}>
                  Orders
                </Button>
                {user?.role === 'admin' && (
                  <Button variant="ghost" onClick={() => setLocation("/admin")}>
                    Admin
                  </Button>
                )}
                <Button variant="outline" onClick={() => setLocation("/profile")}>
                  {user?.name || "Profile"}
                </Button>
              </>
            ) : (
              <Button onClick={() => window.location.href = `/api/oauth/login`}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Premium Products, Exceptional Value
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Discover our curated collection of high-quality products. Fast shipping, secure checkout, and 100% satisfaction guaranteed.
            </p>
            <div className="flex gap-4">
              <Button size="lg" onClick={() => setLocation("/products")}>
                Shop Now
              </Button>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>
          <div className="bg-linear-to-br from-blue-100 to-purple-100 rounded-2xl h-96 flex items-center justify-center">
            <div className="text-center">
              <ShoppingCart className="w-24 h-24 text-blue-600 mx-auto mb-4" />
              <p className="text-slate-600">Featured Products</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-slate-100 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">
              Find What You're Looking For
            </h3>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="lg">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-slate-900 mb-12">Featured Products</h3>
        <div className="grid md:grid-cols-3 gap-8">
          {productsData?.products.slice(0, 6).map((product) => (
            <Card
              key={product.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setLocation(`/products/${product.id}`)}
            >
              <div className="bg-linear-to-br from-slate-200 to-slate-300 h-48 flex items-center justify-center">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingCart className="w-12 h-12 text-slate-400" />
                )}
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-2">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {product.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-blue-600">
                    ${typeof product.price === 'string' ? product.price : String(product.price)}
                  </span>
                  <span className="text-sm text-slate-600">
                    {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold mb-12 text-center">Why Choose Us</h3>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h4 className="font-bold mb-2">Fast Shipping</h4>
              <p className="text-slate-300">Quick delivery to your doorstep</p>
            </div>
            <div className="text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <h4 className="font-bold mb-2">Secure Payment</h4>
              <p className="text-slate-300">Encrypted transactions with Stripe</p>
            </div>
            <div className="text-center">
              <Truck className="w-12 h-12 mx-auto mb-4 text-blue-400" />
              <h4 className="font-bold mb-2">Free Returns</h4>
              <p className="text-slate-300">30-day money-back guarantee</p>
            </div>
            <div className="text-center">
              <Award className="w-12 h-12 mx-auto mb-4 text-purple-400" />
              <h4 className="font-bold mb-2">Premium Quality</h4>
              <p className="text-slate-300">Handpicked products only</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Shop?</h3>
          <p className="text-lg mb-8 opacity-90">
            Explore our full collection of premium products
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setLocation("/products")}
          >
            Browse All Products
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-white mb-4">About</h4>
              <p className="text-sm">Premium e-commerce platform with secure payments</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Support</h4>
              <ul className="text-sm space-y-2">
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
                <li><a href="#" className="hover:text-white">Shipping Info</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="text-sm space-y-2">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Follow</h4>
              <ul className="text-sm space-y-2">
                <li><a href="#" className="hover:text-white">Twitter</a></li>
                <li><a href="#" className="hover:text-white">Facebook</a></li>
                <li><a href="#" className="hover:text-white">Instagram</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>&copy; 2025 EliteShop. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
