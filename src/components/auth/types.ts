export type SessionUserPublic = {
  id: string;
  workspaceId: string;
  email: string | null;
  displayName: string;
  kind: "email" | "sandbox";
};
