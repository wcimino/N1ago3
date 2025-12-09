export function EnvironmentBadge() {
  const isDev = import.meta.env.DEV;
  
  if (!isDev) {
    return null;
  }
  
  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide rounded-b-md bg-yellow-500 text-yellow-900">
      <span className="hidden sm:inline">Ambiente de Desenvolvimento</span>
      <span className="sm:hidden">DEV</span>
    </div>
  );
}
