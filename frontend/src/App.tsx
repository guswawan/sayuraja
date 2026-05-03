import { useState, useEffect } from 'react'
import { ChatWidget } from './components/ChatWidget'
import { Card } from "@/components/ui/card"
import { Loader2, Settings, CheckCircle2, AlertCircle, Check, Plus } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  image?: string;
  mediaType?: 'image' | 'video';
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

  const getPlaceholderImage = (name: string) => {
    return `https://placehold.co/600x400/f3f4f6/16a34a?text=${encodeURIComponent(name)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32 font-sans">
      <header className="bg-green-600 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">Sayuraja</h1>
          <p className="text-green-100 opacity-90">Segar Tiap Pagi, Langsung ke Rumah.</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-2">
        {/* Sticky Search/Chat Bar */}
        <div className="sticky top-0 z-30 bg-gray-50/80 backdrop-blur-md py-4 mb-2">
          <ChatWidget />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-green-600">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p className="font-medium">Memuat data sayur segar...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {products.map((p) => {
              const isSelected = selectedItems.has(p.id);
              const isReady = p.stock.toLowerCase() === 'in stock' || p.stock.toLowerCase() === 'ready';

              return (
                <Card
                  key={p.id}
                  className={`group relative flex flex-col overflow-hidden cursor-pointer transition-all border-none shadow-sm hover:shadow-md bg-white rounded-2xl ${isSelected ? 'ring-2 ring-green-500 ring-offset-2' : ''
                    }`}
                  onClick={() => isReady && toggleItem(p.id)}
                >
                  {/* Media Section */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                    {p.image ? (
                      p.mediaType === 'video' ? (
                        <video
                          src={p.image}
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getPlaceholderImage(p.name);
                          }}
                        />
                      )
                    ) : (
                      <img
                        src={getPlaceholderImage(p.name)}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    )}

                    {/* Selected Overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-green-600/10 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="bg-green-600 text-white rounded-full p-1 shadow-lg animate-in zoom-in-50">
                          <Check className="h-5 w-5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="flex-1 p-3 sm:p-4 flex flex-col gap-1">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-1 leading-tight">
                      {p.name}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-gray-400 font-medium">
                      per {p.unit || 'pack'}
                    </p>

                    <div className="mt-auto pt-2 flex flex-col">
                      <span className="text-orange-600 font-extrabold text-sm sm:text-lg leading-none">
                        Rp {p.price.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* Add Button */}
                    <div className="absolute bottom-3 right-3">
                      <div
                        className={`p-1.5 sm:p-2 rounded-full shadow-sm transition-all active:scale-90 ${isSelected ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-green-600 group-hover:text-white'
                          }`}
                      >
                        <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    </div>
                  </div>

                  {!isReady && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                      <span className="bg-gray-800 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                        Habis
                      </span>
                    </div>
                  )}
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

      <footer className="max-w-4xl mx-auto p-4 mt-12 border-t text-center text-gray-500 text-sm relative">
        <p>&copy; 2026 Sayuraja. Delivery setiap jam 06:00 pagi.</p>

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
