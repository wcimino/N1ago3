import { XCircle, LogOut } from "lucide-react";

interface UnauthorizedPageProps {
  message: string;
}

export function UnauthorizedPage({ message }: UnauthorizedPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <a
          href="/api/logout"
          className="inline-flex items-center justify-center gap-2 w-full bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair e tentar com outra conta
        </a>
      </div>
    </div>
  );
}
