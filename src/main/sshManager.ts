import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PROFILE_DIR = path.join(os.homedir(), '.ssh/profiles');
const SSH_DIR = path.join(os.homedir(), '.ssh');

// Ensure directories exist with proper permissions
if (!fs.existsSync(PROFILE_DIR)) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 });
}
if (!fs.existsSync(SSH_DIR)) {
  fs.mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
}

function execCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export async function listProfiles(): Promise<string[]> {
  try {
    return fs.readdirSync(PROFILE_DIR)
      .filter(file => fs.statSync(path.join(PROFILE_DIR, file)).isDirectory());
  } catch (error : any) {
    throw new Error(`Failed to list profiles: ${error.message}`);
  }
}

export async function getCurrentProfile(): Promise<string | null> {
  const activePath = path.join(PROFILE_DIR, '.active');
  try {
    if (fs.existsSync(activePath)) {
      return fs.readFileSync(activePath, 'utf8').trim();
    }
    return null;
  } catch (error: any) {
    throw new Error(`Failed to get current profile: ${error.message}`);
  }
}

export async function createProfile(
  profile: string,
  name: string,
  username: string,
  email: string,
  token?: string
): Promise<void> {
  const profilePath = path.join(PROFILE_DIR, profile);

  try {
    // Create profile directory
    fs.mkdirSync(profilePath, { recursive: true, mode: 0o700 });

    // Generate SSH key
    await execCommand(`ssh-keygen -q -b 4096 -t rsa -f "${profilePath}/id_rsa" -C "${email}" -N ""`);
    fs.chmodSync(path.join(profilePath, 'id_rsa'), 0o600);
    fs.chmodSync(path.join(profilePath, 'id_rsa.pub'), 0o644);

    // Create .gitconfig
    const gitConfig = [
      '[user]',
      `email = ${email}`,
      `name = ${name}`,
      '',
      '[github]',
      `user = ${username}`,
      token ? `token = ${token}` : '',
    ].join('\n');

    fs.writeFileSync(path.join(profilePath, '.gitconfig'), gitConfig, { mode: 0o644 });

    // Update SSH config
    const sshConfig = [
      'Host github.com',
      '    User git',
      `    IdentityFile ${path.join(profilePath, 'id_rsa')}`,
    ].join('\n');

    fs.writeFileSync(path.join(SSH_DIR, 'config'), sshConfig, { mode: 0o600 });

    // Set as active profile
    fs.writeFileSync(path.join(PROFILE_DIR, '.active'), profile, { mode: 0o644 });

    // Display public key
    const publicKey = fs.readFileSync(path.join(profilePath, 'id_rsa.pub'), 'utf8');
    console.log('\nYour SSH public key has been generated:');
    console.log('================================================');
    console.log(publicKey);
    console.log('================================================');

  } catch (error: any) {
    throw new Error(`Failed to create profile: ${error.message}`);
  }
}

export async function switchProfile(profile: string): Promise<void> {
  const profilePath = path.join(PROFILE_DIR, profile);

  console.log('profilePath', profilePath);

  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile "${profile}" does not exist`);
  }

  try {
    // Copy SSH keys
    fs.copyFileSync(path.join(profilePath, 'id_rsa'), path.join(SSH_DIR, 'id_rsa'));
    fs.copyFileSync(path.join(profilePath, 'id_rsa.pub'), path.join(SSH_DIR, 'id_rsa.pub'));
    fs.chmodSync(path.join(SSH_DIR, 'id_rsa'), 0o600);
    fs.chmodSync(path.join(SSH_DIR, 'id_rsa.pub'), 0o644);

    // Copy gitconfig if exists and set git config values
    if (fs.existsSync(path.join(profilePath, '.gitconfig'))) {
      fs.copyFileSync(
        path.join(profilePath, '.gitconfig'),
        path.join(os.homedir(), '.gitconfig')
      );

      // Read the gitconfig file to get user values
      const gitConfigContent = fs.readFileSync(path.join(profilePath, '.gitconfig'), 'utf8');
      const emailMatch = gitConfigContent.match(/email = (.+)/);
      const nameMatch = gitConfigContent.match(/name = (.+)/);
      const usernameMatch = gitConfigContent.match(/user = (.+)/);

      // Set git config values explicitly
      if (emailMatch && emailMatch[1]) {
        await execCommand(`git config --global user.email "${emailMatch[1].trim()}"`);
      }
      if (nameMatch && nameMatch[1]) {
        await execCommand(`git config --global user.name "${nameMatch[1].trim()}"`);
      }
      if (usernameMatch && usernameMatch[1]) {
        await execCommand(`git config --global github.user "${usernameMatch[1].trim()}"`);
      }
    }

    // Update SSH config
    const sshConfig = [
      'Host github.com',
      '    User git',
      `    IdentityFile ${path.join(profilePath, 'id_rsa')}`,
    ].join('\n');

    fs.writeFileSync(path.join(SSH_DIR, 'config'), sshConfig, { mode: 0o600 });

    // Update active profile
    fs.writeFileSync(path.join(PROFILE_DIR, '.active'), profile, { mode: 0o644 });

    console.log('switched profile', profile);

  } catch (error: any) {
    throw new Error(`Failed to switch profile: ${error.message}`);
  }
}

export async function removeProfile(profile: string): Promise<void> {
  const profilePath = path.join(PROFILE_DIR, profile);

  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile "${profile}" does not exist`);
  }

  try {
    const currentProfile = await getCurrentProfile();
    if (currentProfile === profile) {
      throw new Error('Cannot remove active profile. Please switch profiles first.');
    }

    // Remove profile directory
    fs.rmSync(profilePath, { recursive: true, force: true });

    // Update SSH config if needed
    const configPath = path.join(SSH_DIR, 'config');
    if (fs.existsSync(configPath)) {
      const config = fs.readFileSync(configPath, 'utf8');
      const newConfig = config.replace(
        new RegExp(`Host github.com[\\s\\S]*?IdentityFile ${profilePath}/id_rsa\\n`, 'g'),
        ''
      );
      fs.writeFileSync(configPath, newConfig, { mode: 0o600 });
    }

  } catch (error: any) {
    throw new Error(`Failed to remove profile: ${error.message}`);
  }
}

export async function clearProfiles(): Promise<void> {
  try {
    // Remove all profiles
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    fs.mkdirSync(PROFILE_DIR, { mode: 0o700 });

    // Remove SSH files
    const filesToRemove = ['id_rsa', 'id_rsa.pub', 'config'];
    for (const file of filesToRemove) {
      const filePath = path.join(SSH_DIR, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove global gitconfig
    const gitconfigPath = path.join(os.homedir(), '.gitconfig');
    if (fs.existsSync(gitconfigPath)) {
      fs.unlinkSync(gitconfigPath);
    }

  } catch (error: any) {
    throw new Error(`Failed to clear profiles: ${error.message}`);
  }
}

export async function showSshRsa(profile: string): Promise<string> {
  const profilePath = path.join(PROFILE_DIR, profile);
  const sshRsaPath = path.join(profilePath, 'id_rsa.pub');
  console.log('sshRsaPath___', sshRsaPath);
  if (fs.existsSync(sshRsaPath)) {
    const sshKey = fs.readFileSync(sshRsaPath, 'utf8');
    return sshKey;
  }
  throw new Error('SSH key not found');
}