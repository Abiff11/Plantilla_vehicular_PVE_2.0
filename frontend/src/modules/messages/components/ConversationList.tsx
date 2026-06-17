import type { Conversation, User } from '../../../types';
import { formatDateMx } from '../../../lib/date-format';
import { useAuth } from '../../auth/auth-context';

type ConversationListProps = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  users: User[];
};

function getConversationName(conversation: Conversation, currentUserId: string): string {
  if (conversation.title) return conversation.title;
  if (conversation.isGroup) return `Grupo (${conversation.participants.length})`;

  const otherParticipant = conversation.participants.find(
    (p) => p.id !== currentUserId,
  );

  if (otherParticipant) {
    return `${otherParticipant.firstName} ${otherParticipant.lastName}`;
  }

  return 'Conversacion desconocida';
}

function getConversationRole(conversation: Conversation, currentUserId: string): string {
  const otherParticipants = conversation.participants.filter(
    (p) => p.id !== currentUserId,
  );

  if (otherParticipants.length === 0) return '';

  const roles = otherParticipants.map((p) => p.role).join(', ');
  return roles;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  users,
}: ConversationListProps) {
  const { session } = useAuth();

  if (!session) return null;

  const currentUserId = session.user.id;

  return (
    <div className="conversation-list">
      {conversations.length === 0 ? (
        <div className="empty-conversations">
          <p>No hay conversaciones activas</p>
        </div>
      ) : (
        <ul>
          {conversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const unreadCount = conv.unreadCount ?? 0;
            const name = getConversationName(conv, currentUserId);
            const role = getConversationRole(conv, currentUserId);

            return (
              <li
                key={conv.id}
                className={`conversation-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(conv.id)}
              >
                <div className="conversation-info">
                  <div className="conversation-name">
                    {name}
                    {unreadCount > 0 && (
                      <span className="unread-badge">{unreadCount}</span>
                    )}
                  </div>
                  <div className="conversation-role">{role}</div>
                  {conv.lastMessage && conv.lastMessage.content && (
                    <div className="last-message-preview">
                      {conv.lastMessage.content.substring(0, 30)}
                      {conv.lastMessage.content.length > 30 ? '...' : ''}
                    </div>
                  )}
                </div>
                {conv.lastMessageAt && (
                  <div className="conversation-time">
                    {formatDateMx(conv.lastMessageAt)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
