#!/usr/bin/env bash
# To setup, add "$HOME/.ssh/ssh-tool.sh" to
# /etc/bash.bashrc or ~/.bashrc or ~/.zshrc

version="0.0.3"
PROFILE_DIR="$HOME/.ssh/profiles"

# Ensure profiles directory exists
mkdir -p -m 700 "$PROFILE_DIR"

function Echo_Color(){
    case $1 in
        r* | R* )
        COLOR='\033[0;31m'
        ;;
        g* | G* )
        COLOR='\033[0;32m'
        ;;
        y* | Y* )
        COLOR='\033[0;33m'
        ;;
        b* | B* )
        COLOR='\033[0;34m'
        ;;
        *)
        COLOR='\033[0m' # Default color
        echo -e "$COLOR Wrong COLOR keyword!"
        return
        ;;
    esac
    echo -e "$COLOR$2\033[0m"
}

function ssh-which() {
  if [ $# -ge 1 ]; then
    Echo_Color r "[usage] ssh-which"
    return 1
  fi
  profiles=($(find "$PROFILE_DIR" -maxdepth 1 -type d -exec basename {} \; | tail -n +2))
  if [ ${#profiles[@]} -eq 0 ]; then
    Echo_Color y "No profiles available to switch to.Would you like to create one? (Y/n)"
    read -r response
    if [[ $response =~ ^[Yy]$ ]]; then
      ssh-create
    fi
    return 1
  fi
  if [ ! -f "$PROFILE_DIR/.active" ]; then
    Echo_Color y "No active profiles found! Would you like to select one? (Y/n)"
    read -r response
    if [[ $response =~ ^[Yy]$ ]]; then
      ssh-switch
    fi
  else
    active_profile=$(cat "$PROFILE_DIR/.active")
    Echo_Color g "Active key: \"$active_profile\". Checking global name and email..."
    git config --list --global | grep -E 'user\.name|user\.email|github\.user|github\.token'
    Echo_Color b "Authenticating active key \"$active_profile\" with GitHub..."
    ssh -T git@github.com
  fi
}

function ssh-list() {
  if [ $# -ge 1 ]; then
    Echo_Color r "[usage] ssh-list"
    return 1
  fi
  Echo_Color g "Existing profiles:"
  find "$PROFILE_DIR" -maxdepth 1 -type d -exec basename {} \; | tail -n +2
}

function ssh-create() {
  if [ $# -ge 1 ]; then
    Echo_Color r "[usage] ssh-create"
    return 1
  fi
  Echo_Color g "Enter a name for this SSH profile: "; read profile
  Echo_Color g "Enter your name: "; read name
  Echo_Color g "Enter your Git username: "; read username
  Echo_Color g "Enter your Git user email: "; read email
  Echo_Color g "Enter your Git private access token (Optional): "; read token

  profile_path="$PROFILE_DIR/$profile"
  Echo_Color b "Generating new key for \"$profile\""

  # Clear any existing profile with the same name
  rm -rf "$profile_path"
  mkdir -p "$profile_path"
  
  # Set strict permissions on profile directory
  chmod 700 "$profile_path"
  chown -R $(id -u):$(id -g) "$profile_path"

  # Generate the SSH key with strict permissions
  ssh-keygen -q -b 4096 -t rsa -f "$profile_path/id_rsa" -C "$email" -N ''
  chmod 600 "$profile_path/id_rsa"
  chmod 644 "$profile_path/id_rsa.pub"

  # Create the .gitconfig for the profile with proper permissions
  printf "[user]\nemail = $email\nname = $name\n\n[github]\nuser = $username\ntoken = $token" > "$profile_path/.gitconfig"
  chmod 644 "$profile_path/.gitconfig"

  # Copy and set permissions for global .gitconfig
  cp -f "$profile_path/.gitconfig" "$HOME/.gitconfig"
  chmod 644 "$HOME/.gitconfig"

  # Update SSH config file
  if [ ! -f "$HOME/.ssh/config" ]; then
    touch "$HOME/.ssh/config"
  fi
  chmod 600 "$HOME/.ssh/config"

  # Update config content
  {
    echo "Host github.com"
    echo "    User git"
    echo "    IdentityFile $profile_path/id_rsa"
  } > "$HOME/.ssh/config"

  # Display the public key and instructions for GitHub
  Echo_Color g "Your SSH public key has been generated. You can add it to GitHub with the following command:"
  Echo_Color y "================================================"
  cat "$profile_path/id_rsa.pub"
  Echo_Color y "================================================"

  Echo_Color g "Instructions:"
  Echo_Color b "Copy the above key and follow these steps to add it to your GitHub account:"
  Echo_Color b "1. Go to https://github.com and log in."
  Echo_Color b "2. Navigate to Settings > SSH and GPG keys."
  Echo_Color b "3. Click 'New SSH key'."
  Echo_Color b "4. Paste your key into the 'Key' field."
  Echo_Color b "5. Give it a Title (e.g., '$profile') and click 'Add SSH key'."

  # ask if the above instructions are clear and followed
  Echo_Color g "Done? (Y/n)"
  read -r response
  if [[ $response =~ ^[Yy]$ ]]; then
    Echo_Color g "Great! You can now switch to this profile with the following command:"
    Echo_Color y "================================================"
    Echo_Color g "ssh-switch"
    Echo_Color y "================================================"
  fi

  Echo_Color b "Files created in profile \"$profile\":"
  ls -p -a "$profile_path" | grep -v / | grep -v '^[.]/$'
  echo "$profile" > "$PROFILE_DIR/.active"
  chmod 644 "$PROFILE_DIR/.active"
  ssh-which
}

function ssh-switch() {
  # Remove the sudo check and elevation
  if [ $# -ge 1 ]; then
    Echo_Color r "[usage] ssh-switch" 
    return 1
  fi

  # List available profiles
  profiles=($(find "$PROFILE_DIR" -maxdepth 1 -type d -exec basename {} \; | tail -n +2))
  if [ ${#profiles[@]} -eq 0 ]; then
    Echo_Color r "No profiles available to switch to. Please create one first."
    return 1
  fi

  # check if home/.ssh/id_rsa and home/.ssh/id_rsa.pub doesnt exist and create it when selected
  if [ ! -f "$HOME/.ssh/id_rsa" ] || [ ! -f "$HOME/.ssh/id_rsa.pub" ]; then
    Echo_Color y "SSH key does not exist in $HOME/.ssh/id_rsa. Creating it..."
    ssh-keygen -q -b 4096 -t rsa -f "$HOME/.ssh/id_rsa" -C "default@ssh-tool" -N ''
    ssh-keygen -y -f "$HOME/.ssh/id_rsa" > "$HOME/.ssh/id_rsa.pub"
    chmod 600 "$HOME/.ssh/id_rsa"
    chmod 644 "$HOME/.ssh/id_rsa.pub"
  fi

  Echo_Color g "Please select a profile to switch to: "
  PS3="Enter selection: "
  select profile in "${profiles[@]}"; do
    if [ -z "$profile" ]; then
      Echo_Color r "Invalid selection! Please try again..."
    else
      profile_path="$PROFILE_DIR/$profile"
      if [ ! -f "$profile_path/id_rsa" ]; then
        Echo_Color r "No profile \"$profile\" exists"
        return 2
      else
        Echo_Color g "You have selected \"$profile\" profile"
        
        # Ensure proper permissions on profile directory
        chmod 700 "$profile_path"
        
        # permissions for SSH key files
        chmod 600 "$profile_path/id_rsa"
        chmod 644 "$profile_path/id_rsa.pub"
        
        # Copy and set permissions for SSH keys
        if [ -f "$profile_path/id_rsa" ]; then
          cp -f "$profile_path/id_rsa" "$HOME/.ssh/"
          cp -f "$profile_path/id_rsa.pub" "$HOME/.ssh/"
          chmod 600 "$HOME/.ssh/id_rsa"
          chmod 644 "$HOME/.ssh/id_rsa.pub"
        else
          Echo_Color r "Error: SSH keys not found in profile"
          return 1
        fi

        # Copy known_hosts if it exists
        if [ -f "$profile_path/known_hosts" ]; then
          cp -f "$profile_path/known_hosts" "$HOME/.ssh/known_hosts" 2>/dev/null
          chmod 644 "$HOME/.ssh/known_hosts" 2>/dev/null
        fi

        # Update active profile
        echo "$profile" > "$PROFILE_DIR/.active" 2>/dev/null || Echo_Color y "Warning: Could not update active profile"
        chmod 644 "$PROFILE_DIR/.active" 2>/dev/null

        # Update SSH config
        if [ ! -f "$HOME/.ssh/config" ]; then
          touch "$HOME/.ssh/config" 2>/dev/null
        fi
        
        if [ -w "$HOME/.ssh/config" ]; then
          sed -i.bak "/^Host github.com$/,/^IdentityFile /d" "$HOME/.ssh/config" 2>/dev/null
          rm -f "$HOME/.ssh/config.bak" 2>/dev/null
          {
            echo "Host github.com"
            echo "    User git" 
            echo "    IdentityFile $profile_path/id_rsa"
          } >> "$HOME/.ssh/config"
          chmod 600 "$HOME/.ssh/config" 2>/dev/null
        else
          Echo_Color r "Error: Cannot write to SSH config file"
        fi

        ssh-which
        break
      fi
    fi
  done
}

function ssh-remove() {
  if [ $# -ge 1 ]; then
    Echo_Color r "[usage] ssh-remove"
    return 1
  fi

  # List available profiles
  profiles=($(find "$PROFILE_DIR" -maxdepth 1 -type d -exec basename {} \; | tail -n +2))
  if [ ${#profiles[@]} -eq 0 ]; then
    Echo_Color r "No profiles available to remove."
    return 1
  fi

  Echo_Color g "Please select a profile to remove: "
  PS3="Enter selection: "
  select profile in "${profiles[@]}"; do
    if [ -z "$profile" ]; then
      Echo_Color r "Invalid selection! Please try again..."
    else
      profile_path="$PROFILE_DIR/$profile"
      if [ ! -f "$profile_path/id_rsa" ]; then
        Echo_Color r "No profile \"$profile\" exists"
        return 2
      else
        if [ "$profile" == "$(cat "$PROFILE_DIR/.active")" ]; then
          Echo_Color y "Deleting active profile. Please switch profiles first."
          ssh-switch
        fi

        # Remove profile from SSH config
        sed -i.bak "/^Host github.com$/,/^IdentityFile $profile_path\/id_rsa/d" "$HOME/.ssh/config"
        rm -f "$HOME/.ssh/config.bak"

        # Delete the profile directory
        rm -rf "$profile_path"
        Echo_Color g "Profile \"$profile\" removed."
        ssh-which
        break
      fi
    fi
  done
}

function ssh-clear() {
  if [ $# -ge 1 ]; then
    Echo_Color r "[usage] ssh-clear"
    return 1
  fi
  Echo_Color y "Are you sure you want to clear all SSH profiles? (y/N) "
  read -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    Echo_Color b "Clearing SSH profiles..."
    rm -rf "$PROFILE_DIR"
    mkdir -p -m 700 "$PROFILE_DIR"
    rm -rf "$HOME/.ssh/id_rsa*" "$HOME/.ssh/config" "$HOME/.gitconfig"
    Echo_Color g "All profiles cleared."
    ssh-which
  else
    Echo_Color y "Canceled!"
  fi
}
