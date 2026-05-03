import { useState, useEffect } from 'react'
import { ChatWidget } from './components/ChatWidget'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Settings, CheckCircle2, AlertCircle } from 'lucide-react'

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
    <div className="min-h-screen bg-gray-50 pb-20">
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
            {products.map((p) => (
              <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="bg-white pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      {p.category}
                    </Badge>
                    <Badge 
                      variant={p.stock.toLowerCase() === 'in stock' || p.stock.toLowerCase() === 'ready' ? 'default' : 'destructive'} 
                      className={p.stock.toLowerCase() === 'in stock' || p.stock.toLowerCase() === 'ready' ? 'bg-green-500' : ''}
                    >
                      {p.stock}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2">{p.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-700">
                    Rp {p.price.toLocaleString('id-ID')} <span className="text-sm font-normal text-gray-500">/ {p.unit}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

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
