import { LogIn } from "lucide-react";
import { N1agoLogo } from "../components";
import { Button } from "../components/ui";

export function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mx-auto mb-8">
          <N1agoLogo className="h-12 w-auto mx-auto" variant="full" />
        </div>
        
        <Button
          onClick={handleLogin}
          size="lg"
          fullWidth
          leftIcon={<LogIn className="w-5 h-5" />}
        >
          Entrar
        </Button>
      </div>
    </div>
  );
}
