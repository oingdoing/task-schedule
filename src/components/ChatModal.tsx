import { useEffect, useRef, useState } from 'react';
import { ensureAnonymousSession, supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  created_at: string;
  sender_id: string;
  body: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    (async () => {
      await ensureAnonymousSession();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: rows, error } = await supabase
        .from('messages')
        .select('id, created_at, sender_id, body')
        .order('created_at', { ascending: true });

      if (mounted && !error) setMessages(rows ?? []);

      const channel = supabase
        .channel('messages-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const newRow = payload.new as ChatMessage;
            if (mounted) setMessages((prev) => [...prev, newRow]);
          },
        )
        .subscribe();
      channelRef.current = channel;
    })();

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setSendError('로그인 후 전송해 주세요.');
      return;
    }

    setLoading(true);
    setSendError(null);
    setInput('');

    const { error } = await supabase.from('messages').insert({
      sender_id: session.user.id,
      body: text,
    });

    setLoading(false);
    if (error) setSendError(error.message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal card chat-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>채팅</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="chat-modal-body">
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-messages-empty">아직 메시지가 없습니다.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="chat-message">
                <span className="chat-message-meta">
                  {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="chat-message-body">{msg.body}</span>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>
          <div className="chat-input-wrap">
            {sendError && (
              <p className="chat-send-error" role="alert">
                {sendError}
              </p>
            )}
            <div className="chat-input-row">
              <input
                type="text"
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지 입력..."
                disabled={loading}
                maxLength={2000}
              />
              <button
                type="button"
                className="chat-send-btn"
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
