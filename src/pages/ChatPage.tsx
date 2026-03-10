import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureAnonymousSession, supabase } from '../lib/supabase';

const NICKNAME_KEY = 'chat_nickname';
const BUCKET = 'chat-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const HEARTBEAT_INTERVAL_MS = 10 * 1000; // 10초
const INACTIVE_AFTER_MS = 30 * 1000; // 30초 미갱신 시 inactive
const INACTIVE_LAST_SEEN = '2000-01-01T00:00:00.000Z'; // X 버튼 나가기 시 즉시 inactive
const AUTO_LEAVE_INACTIVE_MS = 30 * 60 * 1000; // 30분 무활동 시 자동 퇴장
const AUTO_LEAVE_CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 무활동 여부 확인

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** http/https URL만 링크로 변환. XSS 방지를 위해 프로토콜 제한, 새 탭 열기 */
function linkifyMessageBody(body: string, messageId: string): (string | ReactNode)[] {
  if (body == null || body === '') return [];
  const parts: (string | React.ReactNode)[] = [];
  const urlRe = /(https?:\/\/[^\s<>"']+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;
  while ((match = urlRe.exec(body)) !== null) {
    const raw = match[1];
    const href = raw.startsWith('http://') || raw.startsWith('https://') ? raw : null;
    if (lastIndex < match.index) {
      parts.push(body.slice(lastIndex, match.index));
    }
    if (href) {
      parts.push(
        <a
          key={`${messageId}-link-${keyIndex++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-message-body-link"
        >
          {raw}
        </a>,
      );
    } else {
      parts.push(raw);
    }
    lastIndex = urlRe.lastIndex;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [body];
}

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
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const participantTimersRef = useRef<{
    heartbeat: ReturnType<typeof setInterval>;
    participants: ReturnType<typeof setInterval>;
    autoLeave: ReturnType<typeof setInterval>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const skipNextChangeRef = useRef(false);
  const leaveSentRef = useRef(false);
  const joinedAtRef = useRef<string | null>(null);
  const participantPopupRef = useRef<HTMLDivElement>(null);
  const [participantPopupOpen, setParticipantPopupOpen] = useState(false);
  const [changeNicknameOpen, setChangeNicknameOpen] = useState(false);
  const [changeNicknameInput, setChangeNicknameInput] = useState('');
  /** 퇴장 후 이름 입력 화면에 표시할 안내(자동 퇴장 등) */
  const [leaveNoticeMessage, setLeaveNoticeMessage] = useState<string | null>(null);
  const lastActivityAtRef = useRef<number>(Date.now());

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

  /** 퇴장 처리 후 이름 입력 화면으로 전환. noticeMessage 있으면 해당 안내 문구 표시(자동 퇴장 등) */
  const performLeave = useCallback(
    async (noticeMessage?: string) => {
      if (userId) {
        await supabase
          .from('chat_participants')
          .update({ last_seen_at: INACTIVE_LAST_SEEN })
          .eq('user_id', userId);
      }
      await sendLeaveMessage();
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(NICKNAME_KEY);
      leaveSentRef.current = false;
      setNicknameState(null);
      setNicknameInput('');
      setParticipantNotice(null);
      setMessages([]);
      setInput('');
      setSendError(null);
      setParticipantPopupOpen(false);
      setChangeNicknameOpen(false);
      setLeaveNoticeMessage(noticeMessage ?? null);
    },
    [sendLeaveMessage, userId],
  );

  const handleClose = useCallback(() => {
    void performLeave();
  }, [performLeave]);

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
    lastActivityAtRef.current = Date.now();

    (async () => {
      let joinedAt: string | null = null;
      const { data: participant } = await supabase
        .from('chat_participants')
        .select('joined_at')
        .eq('user_id', userId)
        .single();
      const now = new Date().toISOString();
      if (participant?.joined_at) {
        joinedAt = participant.joined_at;
        await supabase
          .from('chat_participants')
          .update({ last_seen_at: now })
          .eq('user_id', userId);
      } else {
        joinedAt = now;
        await supabase.from('chat_participants').upsert(
          { user_id: userId, nickname, joined_at: joinedAt, last_seen_at: now },
          { onConflict: 'user_id' },
        );
      }
      if (mounted) joinedAtRef.current = joinedAt;

      const { data: rows, error } = await supabase
        .from('messages')
        .select('id, created_at, sender_id, body, message_type, sender_nickname, image_url')
        .order('created_at', { ascending: true });

      if (mounted && !error) setMessages(rows ?? []);

      const fetchActiveParticipants = async () => {
        if (!mounted) return;
        const since = new Date(Date.now() - INACTIVE_AFTER_MS).toISOString();
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('user_id, nickname')
          .gte('last_seen_at', since);
        if (!mounted) return;
        const byUser = new Map<string, string>();
        for (const p of participants ?? []) {
          if (p.user_id && p.nickname) byUser.set(p.user_id, p.nickname);
        }
        const nicknames = Array.from(byUser.values()).sort();
        if (nicknames.length >= 1) {
          setParticipantNotice({ count: nicknames.length, nicknames });
        } else {
          setParticipantNotice(null);
        }
      };

      const heartbeat = async () => {
        if (!mounted) return;
        await supabase
          .from('chat_participants')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('user_id', userId);
      };

      await fetchActiveParticipants();
      const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
      const participantsTimer = setInterval(fetchActiveParticipants, HEARTBEAT_INTERVAL_MS);
      const autoLeaveTimer = setInterval(() => {
        if (!mounted || Date.now() - lastActivityAtRef.current < AUTO_LEAVE_INACTIVE_MS) return;
        void performLeave('장시간 활동이 없어 채팅방에서 퇴장되었습니다.');
      }, AUTO_LEAVE_CHECK_INTERVAL_MS);
      participantTimersRef.current = {
        heartbeat: heartbeatTimer,
        participants: participantsTimer,
        autoLeave: autoLeaveTimer,
      };

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
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_participants' },
          () => {
            if (mounted) fetchActiveParticipants();
          },
        )
        .subscribe();
      channelRef.current = channel;
    })();

    return () => {
      mounted = false;
      const timers = participantTimersRef.current;
      if (timers) {
        clearInterval(timers.heartbeat);
        clearInterval(timers.participants);
        if (timers.autoLeave) clearInterval(timers.autoLeave);
        participantTimersRef.current = null;
      }
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [nickname, userId, performLeave]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!participantPopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const el = participantPopupRef.current;
      const target = e.target as Node;
      const trigger = target instanceof Element ? target.closest('.chat-participant-trigger') : null;
      if (el && !el.contains(target) && !trigger) {
        setParticipantPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [participantPopupOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;

    const updateForKeyboard = () => {
      const el = inputWrapRef.current;
      if (!el) return;

      // 데스크톱에서는 기본 fixed bottom 동작 유지
      if (window.innerWidth > 768) {
        el.style.transform = '';
        return;
      }

      const layoutHeight = window.innerHeight;
      const visibleHeight = viewport.height;
      const offsetTop = viewport.offsetTop;
      const keyboardHeight = layoutHeight - (visibleHeight + offsetTop);

      // 키패드가 충분히 올라온 경우에만 입력창을 키패드 높이만큼 위로 이동
      if (keyboardHeight > 80) {
        el.style.transform = `translateY(-${keyboardHeight}px)`;
      } else {
        el.style.transform = '';
      }
    };

    viewport.addEventListener('resize', updateForKeyboard);
    viewport.addEventListener('scroll', updateForKeyboard);
    updateForKeyboard();

    return () => {
      viewport.removeEventListener('resize', updateForKeyboard);
      viewport.removeEventListener('scroll', updateForKeyboard);
    };
  }, []);

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveNoticeMessage(null);
    const nick = nicknameInput.trim();
    if (!nick) return;
    await ensureAnonymousSession();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const now = new Date().toISOString();
    await supabase.from('chat_participants').upsert(
      { user_id: uid, nickname: nick, joined_at: now, last_seen_at: now },
      { onConflict: 'user_id' },
    );
    sessionStorage.setItem(NICKNAME_KEY, nick);
    setNicknameState(nick);
    joinedAtRef.current = now;
    supabase
      .from('messages')
      .insert({
        message_type: 'system',
        body: `${nick}님이 입장했습니다.`,
        sender_id: null,
      })
      .then(() => {});
  };

  const openChangeNickname = useCallback(() => {
    setChangeNicknameInput(nickname ?? '');
    setChangeNicknameOpen(true);
  }, [nickname]);

  const handleChangeNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    lastActivityAtRef.current = Date.now();
    const newNick = changeNicknameInput.trim();
    if (!newNick || !userId || !nickname) return;
    if (newNick === nickname) {
      setChangeNicknameOpen(false);
      return;
    }
    const inUse = participantNotice?.nicknames?.includes(newNick) ?? false;
    if (inUse) {
      alert('이미 사용중인 이름입니다');
      return;
    }
    const joinedAt = joinedAtRef.current ?? new Date().toISOString();
    const now = new Date().toISOString();
    await supabase.from('chat_participants').upsert(
      { user_id: userId, nickname: newNick, joined_at: joinedAt, last_seen_at: now },
      { onConflict: 'user_id' },
    );
    await supabase.from('messages').insert({
      message_type: 'system',
      body: `<strong>${escapeHtml(nickname)}</strong>님이 <strong>${escapeHtml(newNick)}</strong>으로 이름을 변경했습니다.`,
      sender_id: null,
    });
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(NICKNAME_KEY, newNick);
    setNicknameState(newNick);
    setChangeNicknameOpen(false);
    setChangeNicknameInput('');
  };

  const handleSendText = async () => {
    if (loading) return;
    lastActivityAtRef.current = Date.now();
    const raw =
      (typeof messageInputRef.current?.value !== 'undefined' && messageInputRef.current?.value !== null
        ? messageInputRef.current.value
        : input);
    const text = raw.trim();
    if (!text || !userId || !nickname) return;
    setLoading(true);
    setSendError(null);
    setInput('');
    skipNextChangeRef.current = true;
    const { error } = await supabase.from('messages').insert({
      message_type: 'user',
      sender_id: userId,
      sender_nickname: nickname,
      body: text,
    });
    setLoading(false);
    if (error) setSendError(error.message);
  };

  const uploadImageAndSend = useCallback(
    async (file: File) => {
      if (!userId || !nickname) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > MAX_IMAGE_BYTES) {
        setSendError('이미지는 5MB 이하여야 합니다.');
        return;
      }
      lastActivityAtRef.current = Date.now();
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
    },
    [userId, nickname],
  );

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadImageAndSend(file);
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          imageFile = item.getAsFile();
          break;
        }
      }
      if (imageFile) {
        e.preventDefault();
        uploadImageAndSend(imageFile);
        const text = e.clipboardData.getData('text');
        if (text) setInput((prev) => prev + text);
      }
    },
    [uploadImageAndSend],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      handleSendText();
    }
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (skipNextChangeRef.current) {
      skipNextChangeRef.current = false;
      setInput('');
      return;
    }
    setInput(e.target.value);
  }, []);

  if (nickname === null || nickname === '') {
    return (
      <div className="chat-page chat-page--nickname">
        <div className="chat-nickname-card">
          <h1 className="chat-nickname-title">이름을 입력하세요</h1>
          {leaveNoticeMessage && (
            <p className="chat-nickname-leave-notice" role="status">
              {leaveNoticeMessage}
            </p>
          )}
          <form onSubmit={handleNicknameSubmit} className="chat-nickname-form">
            <input
              type="text"
              className="chat-nickname-input"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="이름"
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
        <h1 className="chat-header-title">😎 맹챗</h1>
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-header-nickname-btn"
            onClick={openChangeNickname}
            aria-label="이름 변경"
          >
            <span className="chat-header-nickname-label">✏️ 이름 변경</span>
          </button>
          <button
            type="button"
            className="chat-header-close"
            onClick={handleClose}
            aria-label="나가기"
          >
            ✕
          </button>
        </div>
      </header>

      {changeNicknameOpen && (
        <div
          className="chat-change-nickname-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="이름 변경"
          onClick={() => setChangeNicknameOpen(false)}
        >
          <div
            className="chat-change-nickname-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="chat-change-nickname-title">이름 변경</h2>
            <form onSubmit={handleChangeNicknameSubmit} className="chat-change-nickname-form">
              <input
                type="text"
                className="chat-nickname-input"
                value={changeNicknameInput}
                onChange={(e) => setChangeNicknameInput(e.target.value)}
                placeholder="새 이름"
                maxLength={20}
                autoFocus
              />
              <div className="chat-change-nickname-buttons">
                <button
                  type="button"
                  className="chat-change-nickname-cancel"
                  onClick={() => setChangeNicknameOpen(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="chat-nickname-submit"
                  disabled={!changeNicknameInput.trim()}
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="chat-body">
        {participantNotice && (
          <div className="chat-participant-notice" role="status">
            <button
              type="button"
              className="chat-participant-trigger"
              onClick={() => setParticipantPopupOpen((open) => !open)}
              aria-expanded={participantPopupOpen}
              aria-haspopup="dialog"
              aria-label="참여자 목록 보기"
            >
              <span className="chat-participant-trigger-text">
                현재 <strong>{participantNotice.count}명</strong> 참여 중
              </span>
              <span className="chat-participant-trigger-icon" aria-hidden>
                {participantPopupOpen ? '▲' : '▼'}
              </span>
            </button>
            {participantPopupOpen && (
              <div
                ref={participantPopupRef}
                className="chat-participant-popup"
                role="dialog"
                aria-label="참여자 목록"
              >
                <div className="chat-participant-popup-header">
                  <span className="chat-participant-popup-title">참여자</span>
                  <button
                    type="button"
                    className="chat-participant-popup-close"
                    onClick={() => setParticipantPopupOpen(false)}
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
                <ul className="chat-participant-popup-list">
                  {participantNotice.nicknames.map((name) => (
                    <li key={name} className="chat-participant-popup-item">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                  <span
                    className="chat-message-body chat-message-body--system"
                    dangerouslySetInnerHTML={{ __html: msg.body ?? '' }}
                  />
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
                  <span className="chat-message-body">
                    {linkifyMessageBody(msg.body, msg.id)}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={listEndRef} />
        </div>

        <div className="chat-input-wrap" ref={inputWrapRef}>
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
            <textarea
              ref={messageInputRef}
              className="chat-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="입력하는 창"
              maxLength={2000}
              rows={2}
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={handleSendText}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
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
