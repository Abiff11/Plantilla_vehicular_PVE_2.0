import { useEffect, useRef, useState } from "react";
import type { Conversation, Message, User } from "../../../types";
import { useAuth } from "../../auth/auth-context";
import { useMessages } from "../use-messages";
import { resolveConfiguredNetworkUrl } from "../../../lib/resolve-network-url";

function resolveApiBaseUrl() {
  const configuredUrl = resolveConfiguredNetworkUrl(
    import.meta.env.VITE_API_URL,
    "/api",
  );
  if (configuredUrl) {
    const apiBaseUrl = configuredUrl.replace(/\/api$/, "");
    return apiBaseUrl || (typeof window === "undefined" ? "" : window.location.origin);
  }
  if (typeof window === "undefined") {
    return "http://localhost:3101";
  }
  return window.location.origin;
}

const API_BASE_URL = resolveApiBaseUrl();

function resolveMessagePhotoUrl(photo: Message["photos"][number]) {
  if (
    photo.publicUrl.startsWith("http://") ||
    photo.publicUrl.startsWith("https://")
  ) {
    return photo.publicUrl;
  }

  return `${API_BASE_URL}${photo.publicUrl}`;
}

type ChatViewProps = {
  conversation: Conversation;
  users: User[];
};

type PhotoPreview = {
  file: File;
  preview: string;
};

const MAX_PHOTOS = 5;

export function ChatView({ conversation, users }: ChatViewProps) {
  const { session } = useAuth();
  const { messages, loading, sending, sendMessage, markAllAsRead } =
    useMessages(conversation.id);
  const [newMessage, setNewMessage] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasMarkedRead = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    hasMarkedRead.current = false;
  }, [conversation.id]);

  useEffect(() => {
    if (!hasMarkedRead.current && messages.length > 0) {
      hasMarkedRead.current = true;
      void markAllAsRead();
    }
  }, [messages, markAllAsRead]);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, [photos]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - photos.length;

    if (remaining <= 0) return;

    const newFiles = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!newMessage.trim() && photos.length === 0) || sending) return;

    const photoFiles = photos.map((p) => p.file);

    try {
      await sendMessage(newMessage, photoFiles);
      setNewMessage("");
      setPhotos([]);
    } catch {
      // Error handled by hook
    }
  };

  if (!session) return null;

  const currentUserId = session.user.id;

  const otherParticipants = conversation.participants.filter(
    (p) => p.id !== currentUserId,
  );

  const conversationTitle = conversation.title
    ? conversation.title
    : conversation.isGroup
      ? `Grupo (${otherParticipants.length} participantes)`
      : otherParticipants.length > 0
        ? `${otherParticipants[0].firstName} ${otherParticipants[0].lastName}`
        : "Conversacion";

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h3>{conversationTitle}</h3>
        <div className="chat-participants">
          {otherParticipants.map((p) => (
            <span key={p.id} className="participant-badge">
              {p.firstName} {p.lastName} ({p.role})
            </span>
          ))}
        </div>
      </div>

      <div className="messages-container">
        {loading ? (
          <div className="loading-messages">Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            No hay mensajes aun. Inicia la conversacion.
          </div>
        ) : (
          <ul>
            {messages.map((msg) => {
              const isOwn = msg.sender.id === currentUserId;

              return (
                <li
                  key={msg.id}
                  className={`message ${isOwn ? "own" : "other"}`}
                >
                  <div className="message-bubble">
                    {!isOwn && (
                      <div className="message-sender">
                        {msg.sender.firstName} {msg.sender.lastName}
                      </div>
                    )}
                    {msg.content && (
                      <div className="message-content">{msg.content}</div>
                    )}
                    {msg.photos && msg.photos.length > 0 && (
                      <div className="message-photos">
                        {msg.photos.map((photo) => {
                          const photoUrl = resolveMessagePhotoUrl(photo);
                          const isImage = photo.mimeType.startsWith("image/");

                          return (
                            <div
                              key={photo.id}
                              className="message-photo-wrapper"
                            >
                              {isImage ? (
                                <img
                                  className="message-photo"
                                  src={photoUrl}
                                  alt={photo.fileName}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="message-document">
                                  <div className="document-icon">
                                    {photo.mimeType.includes("pdf")
                                      ? "📄"
                                      : photo.mimeType.includes("spreadsheetml")
                                        ? "📊"
                                        : "📝"}
                                  </div>
                                  <div className="document-name">
                                    {photo.fileName}
                                  </div>
                                </div>
                              )}
                              <a
                                href={photoUrl}
                                download={photo.fileName}
                                className="message-photo-download"
                                title="Descargar archivo"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                ⬇
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={messagesEndRef} />
      </div>

      {photos.length > 0 && (
        <div className="photo-preview-bar">
          {photos.map((photo, index) => {
            const isImage = photo.file.type.startsWith("image/");
            return (
              <div key={index} className="photo-preview-thumb">
                {isImage ? (
                  <img src={photo.preview} alt={photo.file.name} />
                ) : (
                  <div className="document-preview">
                    <div className="document-icon-small">
                      {photo.file.type.includes("pdf")
                        ? "📄"
                        : photo.file.type.includes("spreadsheetml")
                          ? "📊"
                          : "📝"}
                    </div>
                    <div className="document-name-small">{photo.file.name}</div>
                  </div>
                )}
                <button
                  type="button"
                  className="photo-preview-remove"
                  onClick={() => removePhoto(index)}
                >
                  X
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form className="message-input-form" onSubmit={handleSend}>
        <button
          type="button"
          className="attach-photo-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || photos.length >= MAX_PHOTOS}
          title={
            photos.length >= MAX_PHOTOS
              ? "Limite de archivos alcanzado"
              : "Adjuntar archivo"
          }
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.xlsx,.docx"
          multiple
          onChange={handlePhotoChange}
          style={{ display: "none" }}
        />
        <input
          type="text"
          className="message-input"
          placeholder="Escribe un mensaje..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          className="send-button"
          disabled={(!newMessage.trim() && photos.length === 0) || sending}
        >
          {sending ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
