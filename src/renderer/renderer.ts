let currentProfileName: string | null = null;

// Update UI with current profile
async function updateCurrentProfile() {
  const currentProfileElement = document.getElementById("currentProfile");
  if (currentProfileElement) {
    currentProfileName = await window.sshManager.getCurrentProfile();
    currentProfileElement.textContent = currentProfileName || "None";
  }
}

// Update profile list
async function updateProfileList() {
  const profileListElement = document.getElementById("profileList");
  if (!profileListElement) return;

  const profiles = await window.sshManager.listProfiles();
  profileListElement.innerHTML = "";

  if (profiles.length === 0) {
    profileListElement.innerHTML =
      '<div class="text-gray-400 text-xs">No profiles available</div>';
    return;
  }

  profiles.forEach((profile, index) => {
    // Add profile element
    const profileElement = document.createElement("div");
    profileElement.className = `mb-1.5 flex flex-col border border-gray-200 dark:border-gray-700 rounded items-center gap-2 p-2 ${profile == currentProfileName ? "text-green-500 border-green-500" : ""
      }`;
    profileElement.innerHTML = `
        <p class="text-xs"><span class="font-medium">${profile}</span></p>

        <hr class="w-full border-gray-200 dark:border-gray-700">
  
        <div class="ms-auto space-x-1.5">
          ${profile !== currentProfileName
        ? `
          <button class="switch-profile px-1.5 py-0.5 text-[10px] border border-green-500 hover:border-green-600 text-green-500 hover:text-green-600 rounded-sm" data-profile="${profile}">
            Switch
          </button>
          <button class="remove-profile px-1.5 py-0.5 text-[10px] border border-red-500 hover:border-red-600 text-red-500 hover:text-red-600 rounded-sm" data-profile="${profile}">
            Remove
          </button>`
        : `
          <button disabled class="manage-profile px-1.5 py-0.5 text-[10px] border border-green-500 hover:border-green-600 text-green-500 hover:text-green-600 rounded-sm" data-profile="${profile}">
            Selected
          </button>
          `
      }
        <button class="show-ssh-rsa px-1.5 py-0.5 text-[10px] border border-blue-500 hover:border-blue-600 text-blue-500 hover:text-blue-600 rounded-sm" data-profile="${profile}">
            Show ssh-rsa
          </button>
        </div>
      `;

    profileListElement.appendChild(profileElement);
  });

  // Add event listeners for buttons
  document.querySelectorAll(".switch-profile").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const profile = (e.currentTarget as HTMLButtonElement).dataset.profile;
      if (profile) {
        try {
          await window.sshManager.switchProfile(profile);
          await updateCurrentProfile();
          await updateProfileList();
          alert(`Profile "${profile}" switched successfully`);
        } catch (error: any) {
          alert(`Failed to switch profile: ${error.message}`);
        }
      }
    });
  });

  document.querySelectorAll(".remove-profile").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const profile = (e.currentTarget as HTMLButtonElement).dataset.profile;
      if (
        profile &&
        confirm(`Are you sure you want to remove profile "${profile}"?`)
      ) {
        try {
          await window.sshManager.removeProfile(profile);
          await updateCurrentProfile();
          await updateProfileList();
          alert(`Profile "${profile}" removed successfully`);
        } catch (error: any) {
          alert(`Failed to remove profile: ${error.message}`);
        }
      }
    });
  });

  document.querySelectorAll(".show-ssh-rsa").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const profile = (e.currentTarget as HTMLButtonElement).dataset.profile;
  
      if (profile) {
        const sshKey = await window.sshManager.showSshRsa(profile);
  
        // Create overlay for modal
        const overlay = document.createElement("div");
        overlay.className = "fixed inset-0 bg-black/30 backdrop-blur-sm z-40";
        document.body.appendChild(overlay);
  
        // Create modal container
        const modal = document.createElement("div");
        modal.className = "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-11/12 max-w-lg p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg";
  
        // Modal content
        const trimmedSshKey = sshKey.slice(0, 150) + "..."; // Trimmed key example
        modal.innerHTML = `
          <h2 class="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-3">SSH Key</h2>
          <p class="text-[10px] text-gray-600 dark:text-gray-400 break-words max-h-40 overflow-y-auto">
            ${trimmedSshKey}
          </p>
        `;
  
        // Modal actions container
        const modalActions = document.createElement("div");
        modalActions.className = "mt-3 flex justify-end gap-1.5";
  
        // Close button
        const closeButton = document.createElement("button");
        closeButton.className = "px-2 py-1 text-[10px] bg-gray-500 text-white rounded-sm hover:bg-gray-600";
        closeButton.innerText = "Close";
        closeButton.addEventListener("click", () => {
          overlay.remove();
          modal.remove();
        });
        modalActions.appendChild(closeButton);
  
        // Copy button
        const copyButton = document.createElement("button");
        copyButton.className = "px-2 py-1 text-[10px] bg-blue-500 text-white rounded-sm hover:bg-blue-600";
        copyButton.innerText = "Copy";
        copyButton.addEventListener("click", () => {
          navigator.clipboard.writeText(sshKey);
          alert("SSH Key copied to clipboard!");
        });
        modalActions.appendChild(copyButton);
  
        modal.appendChild(modalActions);
        document.body.appendChild(modal);
      }
    });
  });
}

// Create Profile Form Handling
document.getElementById("createProfile")?.addEventListener("click", () => {
  const form = document.getElementById("create-profile-form-container");
  if (form) form.classList.remove("hidden");
});

document.getElementById("cancelCreate")?.addEventListener("click", () => {
  const form = document.getElementById("create-profile-form-container");
  if (form) {
    form.classList.add("hidden");
    (form.querySelector("form") as HTMLFormElement).reset();
  }
});

document
  .getElementById("profileForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    try {
      await window.sshManager.createProfile({
        profile: formData.get("profile") as string,
        name: formData.get("name") as string,
        username: formData.get("username") as string,
        email: formData.get("email") as string,
        token: (formData.get("token") as string) || undefined,
      });

      // Reset and hide form
      (e.target as HTMLFormElement).reset();
      const form = document.getElementById("create-profile-form-container");
      if (form) form.classList.add("hidden");

      // Update UI
      await updateCurrentProfile();
      await updateProfileList();
    } catch (error: any) {
      alert(`Failed to create profile: ${error.message}`);
    }
  });

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await updateCurrentProfile();
  await updateProfileList();
});
