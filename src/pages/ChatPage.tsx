import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureAnonymousSession, supabase } from '../lib/supabase';

const NICKNAME_KEY = 'chat_nickname';
const BUCKET = 'chat-images';

export interface ChatMessageRow {
  id: string;
  created_at: string;
  sender_id: string | null;
  body: string | null;
  message_type: 'user' | 'system';
  sender_nickname: string | null;
  image_url: string | null;
}

export default function ChatPage() {
  const [nickname, setNicknameState] = useState<string | null>(() =>
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(NICKNAME_KEY) : null,
  );
  const [nicknameInput, setNicknameInput] = useState('');
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [participantNotice, setParticipantNotice] = useState<{
    count: number;
    nicknames: string[];
  } | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leaveSentRef = useRef(false);
  const participantNoticeShownRef = useRef(false);
  const joinedAtRef = useRef<string | null>(null);

  const sendLeaveMessage = useCallback(async () => {
    if (leaveSentRef.current) return;
    const nick = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(NICKNAME_KEY) : null;
    if (!nick) return;
    leaveSentRef.current = true;
    try {
      await supabase.from('messages').insert({
        message_type: 'system',
        body: `${nick}님이 퇴장했습니다.`,
        sender_id: null,
      });
    } catch {
      leaveSentRef.current = false;
    }
  }, []);

  const handleClose = useCallback(() => {
    (async () => {
      await sendLeaveMessage();
      window.close();
    })();
  }, [sendLeaveMessage]);

  useEffect(() => {
    (async () => {
      await ensureAnonymousSession();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);
    })();
  }, []);

  useEffect(() => {
    if (!nickname || !userId) return;
    let mounted = true;
    participantNoticeShownRef.current = false;

    (async () => {
      let joinedAt: string | null = null;
      const { data: participant } = await supabase
        .from('chat_participants')
        .select('joined_at')
        .eq('user_id', userId)
        .single();
      if (participant?.joined_at) {
        joinedAt = participant.joined_at;
      } else {
        joinedAt = new Date().toISOString();
        await supabase.from('chat_participants').upsert(
          { user_id: userId, nickname, joined_at: joinedAt },
          { onConflict: 'user_id' },
        );
      }
      if (mounted) joinedAtRef.current = joinedAt;

      const { data: rows, error } = await supabase
        .from('messages')
        .select('id, created_at, sender_id, body, message_type, sender_nickname, image_url')
        .order('created_at', { ascending: true });

      if (mounted && !error) setMessages(rows ?? []);

      const channel = supabase
        .channel('chat-messages')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const newRow = payload.new as ChatMessageRow;
            const joined = joinedAtRef.current;
            if (!mounted || !joined) return;
            if (new Date(newRow.created_at) < new Date(joined)) return;
            setMessages((prev) => [...prev, newRow]);
          },
        )
        .on('presence', { event: 'sync' }, () => {
          if (!mounted || participantNoticeShownRef.current) return;
          const state = channel.presenceState();
          const presences = (Object.values(state).flat() as { nickname?: string; user_id?: string }[])
            .filter((p) => p.user_id && p.nickname);
          const byUser = new Map<string, string>();
          for (const p of presences) byUser.set(p.user_id!, p.nickname!);
          const nicknames = Array.from(byUser.values()).sort();
          if (nicknames.length >= 1) {
            participantNoticeShownRef.current = true;
            setParticipantNotice({ count: nicknames.length, nicknames });
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ nickname, user_id: userId });
          }
        });
      channelRef.current = channel;
    })();

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [nickname, userId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onBeforeUnload = () => {
      sendLeaveMessage();
    };
    const onPageHide = () => {
      sendLeaveMessage();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [sendLeaveMessage]);

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nick = nicknameInput.trim();
    if (!nick) return;
    await ensureAnonymousSession();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const joinedAt = new Date().toISOString();
    await supabase.from('chat_participants').upsert(
      { user_id: uid, nickname: nick, joined_at: joinedAt },
      { onConflict: 'user_id' },
    );
    sessionStorage.setItem(NICKNAME_KEY, nick);
    setNicknameState(nick);
    joinedAtRef.current = joinedAt;
    supabase
      .from('messages')
      .insert({
        message_type: 'system',
        body: `${nick}님이 입장했습니다.`,
        sender_id: null,
      })
      .then(() => {});
  };

  const handleSendText = async () => {
    const text = input.trim();
    if (!text || !userId || !nickname) return;
    setLoading(true);
    setSendError(null);
    setInput('');
    const { error } = await supabase.from('messages').insert({
      message_type: 'user',
      sender_id: userId,
      sender_nickname: nickname,
      body: text,
    });
    setLoading(false);
    if (error) setSendError(error.message);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !userId || !nickname) return;
    setLoading(true);
    setSendError(null);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
    });
    if (uploadError) {
      setSendError(uploadError.message);
      setLoading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: insertError } = await supabase.from('messages').insert({
      message_type: 'user',
      sender_id: userId,
      sender_nickname: nickname,
      body: '',
      image_url: urlData.publicUrl,
    });
    setLoading(false);
    if (insertError) setSendError(insertError.message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  if (nickname === null || nickname === '') {
    return (
      <div className="chat-page chat-page--nickname">
        <div className="chat-nickname-card">
          <h1 className="chat-nickname-title">닉네임을 입력하세요</h1>
          <form onSubmit={handleNicknameSubmit} className="chat-nickname-form">
            <input
              type="text"
              className="chat-nickname-input"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="닉네임"
              maxLength={20}
              autoFocus
            />
            <button type="submit" className="chat-nickname-submit" disabled={!nicknameInput.trim()}>
              입장
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <h1 className="chat-header-title">채팅</h1>
        <button
          type="button"
          className="chat-header-close"
          onClick={handleClose}
          aria-label="나가기"
        >
          ✕
        </button>
      </header>

      <div className="chat-body">
        {participantNotice && (
          <div className="chat-participant-notice" role="status">
            <p className="chat-participant-notice-text">
              현재 <strong>{participantNotice.count}명</strong> 참여 중:{' '}
              {participantNotice.nicknames.join(', ')}
            </p>
            <button
              type="button"
              className="chat-participant-notice-close"
              onClick={() => setParticipantNotice(null)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        )}
        <div className="chat-messages">
          {messages.length === 0 && (
            <p className="chat-messages-empty">아직 메시지가 없습니다.</p>
          )}
          {messages.map((msg) => {
            if (msg.message_type === 'system') {
              return (
                <div key={msg.id} className="chat-message chat-message--system">
                  <span className="chat-message-body chat-message-body--system">{msg.body}</span>
                </div>
              );
            }
            const isMine = msg.sender_id === userId;
            return (
              <div
                key={msg.id}
                className={`chat-message chat-message--${isMine ? 'mine' : 'others'}`}
              >
                <div className="chat-message-meta">
                  <span className="chat-message-name">{msg.sender_nickname ?? '알 수 없음'}</span>
                  <span className="chat-message-time">
                    {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                {msg.image_url && (
                  <a
                    href={msg.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat-message-image-wrap"
                  >
                    <img src={msg.image_url} alt="첨부 이미지" className="chat-message-image" />
                  </a>
                )}
                {msg.body != null && msg.body !== '' && (
                  <span className="chat-message-body">{msg.body}</span>
                )}
              </div>
            );
          })}
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
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="chat-file-input"
              onChange={handleImageSelect}
              aria-label="이미지 첨부"
            />
            <button
              type="button"
              className="chat-add-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              aria-label="이미지 첨부"
            >
              +
            </button>
            <input
              type="text"
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="입력하는 창"
              disabled={loading}
              maxLength={2000}
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={handleSendText}
              disabled={loading || !input.trim()}
              aria-label="전송"
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
