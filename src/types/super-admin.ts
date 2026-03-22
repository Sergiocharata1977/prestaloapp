export type OrganizationPlan = "free" | "pro" | "enterprise";

export type OrganizationStatus = "active" | "inactive";
export type DemoRequestStatus = "pending" | "processing" | "approved" | "rejected";

export type SuperAdminRole =
  | "super_admin"
  | "admin"
  | "gerente"
  | "operador"
  | "manager"
  | "operator";

export type OrganizationMetrics = {
  clients: number;
  credits: number;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  status: OrganizationStatus;
  adminEmail: string;
  adminUid: string;
  createdAt: string | null;
  updatedAt: string | null;
  metrics: OrganizationMetrics;
};

export type SuperAdminUser = {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  role: SuperAdminRole | null;
  organizationId: string | null;
  organizationName: string | null;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  admin: boolean;
  capabilities: string[];
};

export type DemoRequest = {
  id: string;
  contactName: string;
  organizationName: string;
  email: string;
  phone: string | null;
  notes: string | null;
  requestedPlan: OrganizationPlan;
  status: DemoRequestStatus;
  createdAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  approvedOrganizationId: string | null;
  approvedAdminUid: string | null;
  lastError: string | null;
};
