import "server-only";

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { SUPER_ADMIN_OPTIONS } from "@/lib/api/superAdminAuth";
import { getAdminFirestore, auth } from "@/firebase/admin";

export const GET = withAuth(async () => {
  const db = getAdminFirestore();

  const [orgsSnapshot, usersResult] = await Promise.all([
    db.collection("organizations").get(),
    auth.listUsers(1000),
  ]);

  const totalOrganizations = orgsSnapshot.size;
  const activeOrganizations = orgsSnapshot.docs.filter(
    (d) => d.data().status === "active"
  ).length;
  const totalUsers = usersResult.users.length;

  return NextResponse.json({
    totalOrganizations,
    activeOrganizations,
    totalUsers,
  });
}, SUPER_ADMIN_OPTIONS);
