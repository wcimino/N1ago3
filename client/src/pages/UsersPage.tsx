import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Users, MessageCircle, Activity, User, UserCheck } from "lucide-react";
import { UserDetailModal, LoadingState, EmptyState, Pagination } from "../components";
import { formatShortDateTime } from "../lib/dateUtils";
import { getUserDisplayName, getActiveConversationsCount, getUserFromGroup } from "../lib/userUtils";
import { usePaginatedQuery } from "../hooks/usePaginatedQuery";
import type { User as UserType, UserGroup } from "../types";

export function UsersPage() {
  const [, navigate] = useLocation();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  const {
    data: userGroups,
    total,
    page,
    totalPages,
    isLoading,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    showingFrom,
    showingTo,
  } = usePaginatedQuery<UserGroup>({
    queryKey: "conversations-grouped",
    endpoint: "/api/conversations/grouped",
    limit: 20,
    dataKey: "user_groups",
  });

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
        <p className="text-sm text-gray-500 mt-1">Lista de usuários com suas conversas e eventos</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : userGroups.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="w-12 h-12 text-gray-300" />}
          title="Nenhuma conversa registrada ainda."
          description="As conversas serão criadas quando mensagens chegarem via webhook."
        />
      ) : (
        <>
          <div className="divide-y divide-gray-200">
            {userGroups.map((group) => {
              const activeCount = getActiveConversationsCount(group.conversations);
              
              return (
                <div key={group.user_id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{getUserDisplayName(group)}</h3>
                          {group.user_info?.authenticated && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <UserCheck className="w-3 h-3" />
                              Autenticado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {group.conversation_count} {group.conversation_count === 1 ? "conversa" : "conversas"}
                          </span>
                          {activeCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              {activeCount} ativa{activeCount > 1 ? "s" : ""}
                            </span>
                          )}
                          <span>Última atividade: {formatShortDateTime(group.last_activity)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {group.user_info && (
                        <button
                          onClick={() => {
                            const user = getUserFromGroup(group);
                            if (user) setSelectedUser(user);
                          }}
                          title="Ver detalhes do usuário"
                          className="p-2 border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <User className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/users/${encodeURIComponent(group.user_id)}`)}
                        title="Ver conversas"
                        className="p-2 border border-gray-200 text-gray-600 hover:text-green-600 hover:border-green-300 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/events?user=${encodeURIComponent(group.user_id)}`}
                        title="Ver eventos"
                        className="p-2 border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <Activity className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {group.conversations.length > 1 && (
                    <div className="mt-3 ml-14 flex flex-wrap gap-2">
                      {group.conversations.map((conv, idx) => (
                        <span
                          key={conv.id}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                            conv.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          #{idx + 1} - {formatShortDateTime(conv.created_at)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            showingFrom={showingFrom}
            showingTo={showingTo}
            total={total}
            onPreviousPage={previousPage}
            onNextPage={nextPage}
            hasPreviousPage={hasPreviousPage}
            hasNextPage={hasNextPage}
            itemLabel="usuários"
          />
        </>
      )}

      {selectedUser !== null && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}
