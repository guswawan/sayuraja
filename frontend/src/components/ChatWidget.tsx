import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, X, MessageSquare } from 'lucide-react';

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
    // Add user message and set loading
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://sayuraya-backend.agsndoes6.workers.dev/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMsg,
          history: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) throw new Error('API Error');

      // Add empty assistant message IMMEDIATELY to reduce perceived latency
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
                // Handle different stream formats (Llama, Kimi, GLM)
                const contentChunk = data.response || data.choices?.[0]?.delta?.content || '';
                
                if (contentChunk) {
                  assistantContent += contentChunk;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantContent;
                    return newMessages;
                  });
                }
              } catch (e) {
                // Ignore parsing errors
              }
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
    const text = encodeURIComponent(`Halo Sayuraya! Saya mau tanya-tanya nih.\n\n${lastAssistantMsg}`);
    return `https://wa.me/6281234567890?text=${text}`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen && (
        <Button 
          onClick={() => setIsOpen(true)} 
          className="rounded-full h-14 w-14 shadow-lg bg-green-600 hover:bg-green-700"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      )}

      {isOpen && (
        <Card className="w-80 sm:w-96 h-[500px] flex flex-col shadow-2xl border-green-100 bg-white overflow-hidden">
          <CardHeader className="bg-green-600 text-white py-3 flex flex-row items-center justify-between shrink-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Sayuraya Concierge
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-green-700">
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-hidden p-0 bg-white">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 mt-10">
                    <p>Halo Kak! Ada yang bisa kami bantu seputar sayur dan buah hari ini?</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      m.role === 'user' 
                        ? 'bg-green-600 text-white rounded-tr-none' 
                        : 'bg-gray-100 text-gray-900 rounded-tl-none shadow-sm'
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

          <CardFooter className="p-3 border-t flex flex-col gap-2 shrink-0 bg-white">
            <div className="flex w-full gap-2">
              <Input 
                placeholder="Tanya harga bayam..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="focus-visible:ring-green-600 rounded-xl"
                disabled={isLoading}
              />
              <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon" className="bg-green-600 hover:bg-green-700 rounded-xl">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {messages.length > 0 && !isLoading && (
              <Button className="w-full bg-green-500 hover:bg-green-600 p-0 rounded-xl shadow-sm">
                <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center">
                  Order via WhatsApp
                </a>
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
