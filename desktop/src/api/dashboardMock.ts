import { DADOS_DASHBOARD } from "../mock/dashboardDados";
import type { DadosDashboard } from "./dashboard";

export async function buscarDashboardMock(): Promise<DadosDashboard> {
  await new Promise((r) => setTimeout(r, 700));
  return DADOS_DASHBOARD;
}
