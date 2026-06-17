import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { api } from '../../../lib/api';
import { socket } from '../../../lib/socket';
import { hasAnyRole, MESSENGER_ROLES } from '../../../lib/role-access';
import type { User } from '../../../types';
import { useAuth } from '../../auth/auth-context';
import { ConversationList } from './ConversationList';
import { ChatView } from './ChatView';
import { useConversations } from '../use-conversations';

export function MessengerPanel() {
  const { session } = useAuth();
  const { conversations, loading, refresh } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!session) return;

    const loadUsers = async () => {
      try {
        const usersList = await api.getMessagingPartners(session.accessToken);
        setUsers(usersList);
      } catch {
        setUsers([]);
      }
    };

    void loadUsers();
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const handlePresenceUpdated = (payload: { onlineUserIds?: string[] }) => {
      setOnlineUserIds(payload.onlineUserIds ?? []);
    };

    socket.on('presence:updated', handlePresenceUpdated);

    return () => {
      socket.off('presence:updated', handlePresenceUpdated);
    };
  }, [session]);

  const availableUsers = useMemo(() => {
    if (!session) {
      return [];
    }

    return users
      .filter((u) => u.id !== session.user.id && hasAnyRole(u.role, MESSENGER_ROLES))
      .map((u) => ({
        ...u,
        isOnline: u.isOnline ?? onlineUserIds.includes(u.id),
      }))
      .sort((a, b) => Number(Boolean(b.isOnline)) - Number(Boolean(a.isOnline)));
  }, [onlineUserIds, session, users]);

  if (!session) return null;

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId,
  ) ?? null;

  const handleCreateConversation = async (selectedUserIds: string[]) => {
    if (!session) return;

    if (selectedUserIds.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Selecciona al menos un usuario',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    try {
      const newConversation = await api.createConversation(
        selectedUserIds,
        undefined,
        session.accessToken,
      );

      setShowNewConversation(false);
      await refresh();
      setSelectedConversationId(newConversation.id);
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo crear la conversacion',
        text: (error as Error).message,
        confirmButtonText: 'Entendido',
      });
    }
  };

  return (
    <div className="messenger-panel">
      <div className="messenger-sidebar">
        <div className="sidebar-header">
          <h2>Mensajes</h2>
          <span className="sidebar-online-count">
            {availableUsers.filter((user) => user.isOnline).length} conectados
          </span>
          <button
            className="new-conversation-btn"
            onClick={() => setShowNewConversation(true)}
          >
            + Nueva conversacion
          </button>
        </div>

        {loading ? (
          <div className="loading-conversations">Cargando conversaciones...</div>
        ) : (
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
            users={users}
          />
        )}
      </div>

      <div className="messenger-main">
        {selectedConversation ? (
          <ChatView
            conversation={selectedConversation}
            users={users}
          />
        ) : (
          <div className="no-conversation-selected">
            <p>Selecciona una conversacion o inicia una nueva</p>
          </div>
        )}
      </div>

      {showNewConversation && (
        <NewConversationModal
          users={availableUsers}
          onClose={() => setShowNewConversation(false)}
          onCreate={handleCreateConversation}
        />
      )}
    </div>
  );
}

type NewConversationModalProps = {
  users: User[];
  onClose: () => void;
  onCreate: (selectedUserIds: string[]) => void;
};

function NewConversationModal({
  users,
  onClose,
  onCreate,
}: NewConversationModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleCreate = () => {
    onCreate(selectedUsers);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Nueva conversacion</h3>
        <p>Selecciona los participantes:</p>

        <div className="user-selection">
          {users.length === 0 ? (
            <p>No hay usuarios disponibles</p>
          ) : (
            <ul>
              {users.map((user) => (
                <li
                  key={user.id}
                  className={`user-option ${selectedUsers.includes(user.id) ? 'selected' : ''}`}
                  onClick={() => toggleUser(user.id)}
                >
                  <span className="user-name">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="user-role">{user.role}</span>
                  <span className={`user-status ${user.isOnline ? 'online' : 'offline'}`}>
                    {user.isOnline ? 'Conectado' : 'Desconectado'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="create-btn"
            onClick={handleCreate}
            disabled={selectedUsers.length === 0}
          >
            Crear conversacion
          </button>
        </div>
      </div>
    </div>
  );
}
