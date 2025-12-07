export function EnvironmentBadge() {
  const isDev = import.meta.env.DEV;
  
  return (
    <div className={`fixed top-0 left-1/2 -translate-x-1/2 z-50 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide rounded-b-md ${
      isDev 
        ? "bg-yellow-500 text-yellow-900" 
        : "bg-green-500 text-white"
    }`}>
      <span className="hidden sm:inline">{isDev ? "Ambiente de Desenvolvimento" : "Ambiente de Produção"}</span>
      <span className="sm:hidden">{isDev ? "DEV" : "PROD"}</span>
    </div>
  );
}
