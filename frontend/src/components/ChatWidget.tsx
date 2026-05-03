import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, MessageSquare, Search, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    if (!isOpen) setIsOpen(true);
    
    // Add user message and set loading
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://sayuraja-backend.agsndoes6.workers.dev/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMsg,
          history: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) throw new Error('API Error');

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                const contentChunk = data.response || data.choices?.[0]?.delta?.content || '';
                
                if (contentChunk) {
                  assistantContent += contentChunk;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantContent;
                    return newMessages;
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Maaf Kak, sepertinya koneksi sedang bermasalah. Coba lagi ya!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getWhatsAppLink = () => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
    const text = encodeURIComponent(`Halo Sayuraja! Saya mau tanya-tanya nih.\n\n${lastAssistantMsg}`);
    return `https://wa.me/6281234567890?text=${text}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      {/* Search Input Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
        </div>
        <Input 
          placeholder="Tanya stok, harga, atau tips masak ke AI Sayuraja..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="pl-12 pr-24 py-7 text-lg rounded-2xl border-2 border-green-100 focus-visible:ring-green-600 focus-visible:border-green-600 shadow-sm bg-white"
          disabled={isLoading}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-2">
           <Button 
            onClick={sendMessage} 
            disabled={isLoading || !input.trim()} 
            className="bg-green-600 hover:bg-green-700 rounded-xl px-4 flex items-center gap-2 h-10"
          >
            <Sparkles className="h-4 w-4" />
            Tanya AI
          </Button>
        </div>
      </div>

      {/* Chat Results / Conversation Area */}
      {isOpen && (
        <Card className="mt-4 shadow-xl border-green-100 bg-white overflow-hidden animate-in slide-in-from-top duration-300">
          <CardHeader className="bg-green-50 text-green-800 py-3 flex flex-row items-center justify-between shrink-0 border-b border-green-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              AI Assistant Sayuraja
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-green-800 hover:bg-green-100">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="p-0 bg-white">
            <ScrollArea className="h-[300px] p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      m.role === 'user' 
                        ? 'bg-green-600 text-white rounded-tr-none' 
                        : 'bg-gray-100 text-gray-900 rounded-tl-none shadow-sm border border-gray-200'
                    }`}>
                      {m.content || (isLoading && i === messages.length - 1 ? (
                        <span className="flex gap-1 items-center py-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </span>
                      ) : null)}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-2" />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 border-t bg-gray-50 flex justify-between items-center">
            <p className="text-[10px] text-gray-400 italic">AI bisa saja membuat kesalahan. Konfirmasi ulang pesanan Anda.</p>
            {messages.length > 0 && !isLoading && (
              <Button variant="outline" size="sm" className="border-green-600 text-green-600 hover:bg-green-50 rounded-lg text-xs">
                <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  Lanjut ke WhatsApp
                </a>
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
