import { LogIn } from "lucide-react";
import { N1agoLogo } from "../components";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mx-auto mb-6">
          <N1agoLogo className="w-16 h-16 mx-auto" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">N1ago</h1>
        
        <a
          href="/api/login"
          className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <LogIn className="w-5 h-5" />
          Entrar
        </a>
      </div>
    </div>
  );
}
