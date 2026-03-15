"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, FileText, Activity, FolderOpen } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());

  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {user?.firstName ?? "Your"} {user?.lastName ?? "Name"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs capitalize">
                  {activeCompany?.role ?? "Staff"}
                </Badge>
              </div>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          {/* Personal Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Personal details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">First name</span>
                <p className="font-medium">{user?.firstName ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Last name</span>
                <p className="font-medium">{user?.lastName ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Email</span>
                <p className="font-medium truncate">{user?.email ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Phone</span>
                <p className="font-medium">{user?.phone ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Nickname / Callsign</span>
                <p className="font-medium">{activeCompany?.membership?.nickname ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="shared">
            <TabsList>
              <TabsTrigger value="shared" className="gap-1.5 text-xs">
                <FolderOpen className="h-3.5 w-3.5" />
                Shared with me
              </TabsTrigger>
              <TabsTrigger value="submissions" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                My submissions
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                My activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shared">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No entries to display</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Shared entries will be displayed here. Your teammates may share
                    Forms and checklists entries with you.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="submissions">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No submissions yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Forms you submit will appear here for tracking.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Your clock-ins, training progress, and other activity will
                    show here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
