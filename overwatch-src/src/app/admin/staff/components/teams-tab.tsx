"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Search, Loader2, Trash2, Plus, X, Edit,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getTeams, createTeam, updateTeam, archiveTeam, deleteTeam, getTeamMembers, addTeamMember, removeTeamMember } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

interface Team {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  isArchived: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: "lead" | "member";
  createdAt: string;
}

interface TeamsTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

export function TeamsTab({ activeCompanyId, canManage }: TeamsTabProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Team | null>(null);
  const [showMembersModal, setShowMembersModal] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberId, setNewMemberId] = useState("");

  const loadTeams = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const data = await getTeams(activeCompanyId);
      setTeams(data);
    } catch (e) {
      logger.swallow("teams:load", e, "error");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const color = formData.get("color") as string;
    const icon = formData.get("icon") as string;

    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }

    const result = await createTeam(activeCompanyId, { name, description, color, icon });
    if (result) {
      toast.success("Team created");
      setShowCreateModal(false);
      loadTeams();
    } else {
      toast.error("Failed to create team");
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTeam) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const color = formData.get("color") as string;
    const icon = formData.get("icon") as string;

    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }

    const result = await updateTeam(editingTeam.id, { name, description, color, icon });
    if (result) {
      toast.success("Team updated");
      setShowEditModal(false);
      setEditingTeam(null);
      loadTeams();
    } else {
      toast.error("Failed to update team");
    }
  };

  const handleArchive = async () => {
    if (!showDeleteModal) return;
    const result = await archiveTeam(showDeleteModal.id);
    if (result) {
      toast.success("Team archived");
      setShowDeleteModal(null);
      loadTeams();
    } else {
      toast.error("Failed to archive team");
    }
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    const result = await deleteTeam(showDeleteModal.id);
    if (result) {
      toast.success("Team deleted");
      setShowDeleteModal(null);
      loadTeams();
    } else {
      toast.error("Cannot delete team with members");
    }
  };

  const handleAddMember = async () => {
    if (!showMembersModal || !newMemberId) return;
    const result = await addTeamMember(showMembersModal.id, newMemberId);
    if (result) {
      toast.success("Member added to team");
      setNewMemberId("");
      loadTeamMembers(showMembersModal.id);
    } else {
      toast.error("Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!showMembersModal) return;
    const result = await removeTeamMember(showMembersModal.id, userId);
    if (result) {
      toast.success("Member removed from team");
      loadTeamMembers(showMembersModal.id);
    } else {
      toast.error("Failed to remove member");
    }
  };

  const loadTeamMembers = async (teamId: string) => {
    try {
      const data = await getTeamMembers(teamId);
      setTeamMembers(data);
    } catch (e) {
      logger.swallow("team:members", e, "error");
    }
  };

  const handleOpenMembers = async (team: Team) => {
    setTeamMembers([]);
    setShowMembersModal(team);
    await loadTeamMembers(team.id);
  };

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
        )}
      </div>

      {/* Teams Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No teams found
                </TableCell>
              </TableRow>
            ) : (
              filteredTeams.map(team => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {team.icon && <span className="text-lg">{team.icon}</span>}
                      {team.name}
                      {team.isArchived && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{team.description || <span className="text-muted-foreground italic">No description</span>}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenMembers(team)}>
                      {teamMembers.length} members
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canManage && !team.isArchived && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingTeam(team); setShowEditModal(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(team)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Team Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input name="name" placeholder="e.g., Patrol Team A" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input name="description" placeholder="Team description" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <Input name="color" type="color" defaultValue="#6366f1" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Icon</label>
              <Input name="icon" placeholder="e.g., 🛡️" />
            </div>
            <DialogFooter>
              <Button type="submit">Create Team</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Team Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input name="name" defaultValue={editingTeam?.name} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input name="description" defaultValue={editingTeam?.description ?? ""} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <Input name="color" type="color" defaultValue={editingTeam?.color ?? "#6366f1"} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Icon</label>
              <Input name="icon" defaultValue={editingTeam?.icon ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete/Archive Team Modal */}
      <Dialog open={!!showDeleteModal} onOpenChange={(open) => !open && setShowDeleteModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showDeleteModal?.isArchived ? "Delete Team" : "Archive Team"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {showDeleteModal?.isArchived
                ? `Are you sure you want to permanently delete the team "${showDeleteModal.name}"? This action cannot be undone.`
                : `Are you sure you want to archive the team "${showDeleteModal?.name}"? Archived teams are hidden from the list.`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={showDeleteModal?.isArchived ? handleDelete : handleArchive}>
              {showDeleteModal?.isArchived ? "Delete Team" : "Archive Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Members Modal */}
      <Dialog open={!!showMembersModal} onOpenChange={(open) => !open && setShowMembersModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showMembersModal?.name} Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>
            ) : (
              <div className="space-y-2">
                {teamMembers.map(tm => (
                  <div key={tm.id} className="flex items-center justify-between p-2 rounded-md border">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Member</span>
                      {tm.role === "lead" && <Badge variant="secondary" className="text-[10px]">Lead</Badge>}
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(tm.userId)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canManage && (
              <div className="flex gap-2">
                <Input
                  placeholder="User ID"
                  value={newMemberId}
                  onChange={(e) => setNewMemberId(e.target.value)}
                />
                <Button onClick={handleAddMember}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowMembersModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
