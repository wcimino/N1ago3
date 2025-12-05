import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Users, MessageCircle, Activity, User, UserCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { UserDetailModal } from "../components";
import type { User as UserType, UserProfile, UserGroup, UserConversation, GroupedConversationsResponse } from "../types";

export function UsersPage() {
  const [page, setPage] = useState(0);
  const [, navigate] = useLocation();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const limit = 20;

  const { data: groupedData, isLoading } = useQuery<GroupedConversationsResponse>({
    queryKey: ["conversations-grouped", page],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/grouped?limit=${limit}&offset=${page * limit}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const totalPages = groupedData ? Math.ceil(groupedData.total / limit) : 0;

  const getUserDisplayName = (group: UserGroup) => {
    if (group.user_info?.profile) {
      const profile = group.user_info.profile as UserProfile;
      if (profile.givenName || profile.surname) {
        return `${profile.givenName || ""} ${profile.surname || ""}`.trim();
      }
      if (profile.email) {
        return profile.email;
      }
    }
    return group.user_id.slice(0, 16) + "...";
  };

  const getActiveCount = (conversations: UserConversation[]) => {
    return conversations.filter(c => c.status === "active").length;
  };

  const getUserFromGroup = (group: UserGroup): UserType | null => {
    if (!group.user_info) return null;
    return {
      id: group.user_info.id,
      sunshine_id: group.user_id,
      external_id: group.user_info.external_id || null,
      authenticated: group.user_info.authenticated,
      profile: group.user_info.profile as UserProfile | null,
      first_seen_at: group.first_activity,
      last_seen_at: group.last_activity,
    };
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
        <p className="text-sm text-gray-500 mt-1">Lista de usuários com suas conversas e eventos</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !groupedData?.user_groups || groupedData.user_groups.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p>Nenhuma conversa registrada ainda.</p>
          <p className="text-sm mt-1">As conversas serão criadas quando mensagens chegarem via webhook.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-200">
            {groupedData.user_groups.map((group) => (
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
                        {getActiveCount(group.conversations) > 0 && (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {getActiveCount(group.conversations)} ativa{getActiveCount(group.conversations) > 1 ? "s" : ""}
                          </span>
                        )}
                        <span>
                          Última atividade: {format(new Date(group.last_activity), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
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
                        #{idx + 1} - {format(new Date(conv.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, groupedData?.total || 0)} de{" "}
              {groupedData?.total || 0} usuários
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {selectedUser !== null && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
