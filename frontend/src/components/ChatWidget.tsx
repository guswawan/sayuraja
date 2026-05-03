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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat`, {
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
              } catch (parseError) {
                console.error('Error parsing stream chunk:', parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Maaf Kak, sepertinya koneksi sedang bermasalah. Coba lagi ya!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getWhatsAppLink = () => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
    const text = encodeURIComponent(`Halo Sayuraja! Saya mau tanya-tanya nih.\n\n${lastAssistantMsg}`);
    return `https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER}?text=${text}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Initial Search Input Bar - Only show when no messages */}
      {!isOpen && messages.length === 0 && (
        <div className="relative group animate-in fade-in duration-500">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
          </div>
          <Input
            placeholder="Tanya stok, harga..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="pl-12 pr-28 py-8 text-lg rounded-2xl border-2 border-green-100 focus-visible:ring-green-600 focus-visible:border-green-600 shadow-lg bg-white"
            disabled={isLoading}
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-green-600 hover:bg-green-700 rounded-xl px-4 flex items-center h-12 shadow-md transition-all active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              Tanya
            </Button>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      {(isOpen || messages.length > 0) && (
        <Card className="shadow-2xl border-green-100 bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-500 flex flex-col h-[500px] p-0 gap-0">
          <CardHeader className="bg-green-600 text-white py-4 flex flex-row items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Asisten Sayuraja</CardTitle>
                <p className="text-[10px] text-green-100 font-medium opacity-90">Online • Siap membantu Kakak</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(false);
                setMessages([]);
              }}
              className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0 bg-gray-50/50">
            <ScrollArea className="h-full px-4 py-1" ref={scrollAreaRef}>
              <div className="space-y-4 pt-1">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center py-10 space-y-2">
                    <Sparkles className="h-8 w-8 text-green-200 mx-auto" />
                    <p className="text-sm text-gray-500">Halo Kak! Ada yang bisa kami bantu hari ini?</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${m.role === 'user'
                      ? 'bg-green-600 text-white rounded-tr-none'
                      : 'bg-white text-gray-900 rounded-tl-none border border-green-50'
                      }`}>
                      <p className="text-sm leading-relaxed">{m.content}</p>
                      {isLoading && i === messages.length - 1 && !m.content && (
                        <span className="flex gap-1.5 items-center py-2">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-4 border-t bg-white flex flex-col gap-3">
            {/* Action Bar */}
            {messages.length > 0 && !isLoading && (
              <div className="flex justify-between items-center w-full px-1">
                <p className="text-[10px] text-gray-400 italic">Pesanan diproses via WhatsApp</p>
                <Button variant="outline" size="sm" className="h-8 border-green-600 text-green-600 hover:bg-green-50 rounded-full text-[11px] font-semibold flex items-center gap-2">
                  <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    Lanjut ke WhatsApp
                  </a>
                </Button>
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="relative w-full flex items-center gap-2">
              <Input
                placeholder="Tanya stok, harga..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 pr-12 py-6 rounded-xl border-gray-200 focus-visible:ring-green-600 shadow-inner bg-gray-50"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="absolute right-1.5 bg-green-600 hover:bg-green-700 rounded-lg h-9 w-9 shadow-md transition-all active:scale-90"
              >
                <Sparkles className="h-4 w-4 text-white" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
