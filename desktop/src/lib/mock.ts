// Dados de exemplo só existem em DESENVOLVIMENTO (npm run dev / electron:dev).
// No instalador e em qualquer build de produção, import.meta.env.DEV é falso: o código e os dados de exemplo
// são removidos do pacote e o aplicativo SEMPRE fala com a API de verdade.
// Em desenvolvimento, VITE_USE_MOCK=false no desktop/.env liga a API real.
export const USAR_MOCK: boolean = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== "false";
