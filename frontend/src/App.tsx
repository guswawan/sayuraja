import { useState, useEffect } from 'react'
import { ChatWidget } from './components/ChatWidget'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Settings, CheckCircle2, AlertCircle, ShoppingCart, Check } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: string;
}

const BACKEND_URL = 'https://sayuraja-backend.agsndoes6.workers.dev';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/products`);
        const data = await response.json();
        if (data.success) {
          setProducts(data.products);
        } else {
          setError(data.error || 'Failed to fetch products');
        }
      } catch (err) {
        setError('Gagal mengambil data dari Google Sheets. Pastikan koneksi internet stabil.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const toggleItem = (productId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const getWhatsAppOrderLink = () => {
    const selectedProducts = products.filter(p => selectedItems.has(p.id));
    const itemText = selectedProducts.map(p => `- ${p.name} (Rp ${p.price.toLocaleString('id-ID')}/${p.unit})`).join('\n');
    const totalPrice = selectedProducts.reduce((sum, p) => sum + p.price, 0);
    
    const message = `Halo Sayuraja! Saya mau pesan belanjaan ini:\n\n${itemText}\n\nTotal Estimasi: Rp ${totalPrice.toLocaleString('id-ID')}\n\nMohon diproses ya Kak, terima kasih!`;
    return `https://wa.me/6281234567890?text=${encodeURIComponent(message)}`;
  };

  const handleAdminSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    
    try {
      const response = await fetch(`${BACKEND_URL}/sync`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-green-600 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold">Sayuraja</h1>
          <p className="text-green-100">Segar Tiap Pagi, Langsung ke Rumah Kakak.</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-green-600">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p>Memuat data sayur segar...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map((p) => {
              const isSelected = selectedItems.has(p.id);
              const isReady = p.stock.toLowerCase() === 'in stock' || p.stock.toLowerCase() === 'ready';
              
              return (
                <Card 
                  key={p.id} 
                  className={`overflow-hidden cursor-pointer transition-all border-2 ${
                    isSelected ? 'border-green-500 bg-green-50 ring-2 ring-green-200 shadow-md' : 'border-transparent hover:shadow-md'
                  }`}
                  onClick={() => isReady && toggleItem(p.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                          {p.category}
                        </Badge>
                        {isSelected && (
                          <Badge className="bg-green-600 text-white animate-in zoom-in-50 duration-200">
                            <Check className="h-3 w-3 mr-1" /> Terpilih
                          </Badge>
                        )}
                      </div>
                      <Badge 
                        variant={isReady ? 'default' : 'destructive'} 
                        className={isReady ? 'bg-green-500' : ''}
                      >
                        {p.stock}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 flex items-center justify-between">
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-end">
                      <p className="text-2xl font-bold text-green-700">
                        Rp {p.price.toLocaleString('id-ID')} <span className="text-sm font-normal text-gray-500">/ {p.unit}</span>
                      </p>
                      <div className={`p-2 rounded-full transition-colors ${isSelected ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <ShoppingCart className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Order Bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-green-100 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-500">{selectedItems.size} item dipilih</p>
              <p className="text-xl font-bold text-green-700">
                Total: Rp {products
                  .filter(p => selectedItems.has(p.id))
                  .reduce((sum, p) => sum + p.price, 0)
                  .toLocaleString('id-ID')}
              </p>
            </div>
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-lg px-0 overflow-hidden rounded-2xl shadow-lg">
              <a href={getWhatsAppOrderLink()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full h-full px-8">
                Pesan via WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}

      <ChatWidget />

      <footer className="max-w-4xl mx-auto p-4 mt-12 border-t text-center text-gray-500 text-sm relative">
        <p>&copy; 2026 Sayuraja Fresh. Delivery setiap jam 06:00 pagi.</p>
        
        {/* Discreet Admin Sync Button */}
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          {syncStatus === 'success' && <span className="text-green-500 flex items-center gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" /> AI Updated</span>}
          {syncStatus === 'error' && <span className="text-red-500 flex items-center gap-1 text-[10px]"><AlertCircle className="h-3 w-3" /> Sync Failed</span>}
          <button 
            onClick={handleAdminSync}
            className={`text-gray-300 hover:text-green-600 transition-colors p-2 ${isSyncing ? 'animate-spin text-green-600' : ''}`}
            title="Sync AI Memory (Admin Only)"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  )
}

export default App
