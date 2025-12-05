export function EnvironmentBadge() {
  const isDev = import.meta.env.DEV;
  
  return (
    <div className={`fixed top-0 right-0 z-50 px-3 py-1 text-xs font-bold uppercase tracking-wide ${
      isDev 
        ? "bg-yellow-500 text-yellow-900" 
        : "bg-green-500 text-white"
    }`}>
      {isDev ? "Ambiente de Desenvolvimento" : "Ambiente de Produção"}
    </div>
  );
}
