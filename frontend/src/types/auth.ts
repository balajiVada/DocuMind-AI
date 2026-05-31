export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface Workspace {
  _id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  defaultWorkspace?: Workspace;
}

export interface ProfileResponse {
  user: User;
  activeWorkspaceId?: string;
  workspaces: Workspace[];
}
