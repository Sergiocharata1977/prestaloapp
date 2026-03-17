import { redirect } from "next/navigation";

// El dashboard de KPIs vive en /dashboard para evitar conflicto con la landing en /
export default function DashboardRoot() {
  redirect("/dashboard");
}
