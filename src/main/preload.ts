import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sshManager', {
  listProfiles: () => ipcRenderer.invoke('ssh:list-profiles'),
  getCurrentProfile: () => ipcRenderer.invoke('ssh:get-current-profile'),
  createProfile: (profileData: {
    profile: string;
    name: string;
    username: string;
    email: string;
    token?: string;
  }) => ipcRenderer.invoke('ssh:create-profile', profileData),
  switchProfile: (profile: string) => ipcRenderer.invoke('ssh:switch-profile', profile),
  removeProfile: (profile: string) => ipcRenderer.invoke('ssh:remove-profile', profile),
  clearProfiles: () => ipcRenderer.invoke('ssh:clear-profiles'),
  showSshRsa: (profile: string) => ipcRenderer.invoke('ssh:show-ssh-rsa', profile),
}); 