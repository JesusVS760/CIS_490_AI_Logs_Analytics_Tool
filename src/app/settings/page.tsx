"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function SettingClient(): any {
  const router = useRouter();

  const [modeDark, setModeDark] = useState(false);
  const [nameUser, setNameUser] = useState("");
  const [newNameUser, setNewNameUser] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    const themeSaved = localStorage.getItem("theme");
    const usernameSaved = localStorage.getItem("username");
    const savedProfilePic = localStorage.getItem("profilePic");

    if (themeSaved === "dark") {
      document.documentElement.classList.add("dark");
      setModeDark(true);
    }

    if (usernameSaved) {
      setNameUser(usernameSaved);
    }

    if (savedProfilePic) {
      setProfilePic(savedProfilePic);
    }
  }, []);

  // Toggle Dark Mode
  const darkModeToggle = () => {
    const themeNew = !modeDark;
    setModeDark(themeNew);

    if (themeNew) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }

    toast("Mode Changed ✅");
  };

  // Change Username
const changeUsername = () => {
  if (!newNameUser.trim()) {
    toast.error("Username cannot be empty ❌");
    return;
  }

  const oldUsername = localStorage.getItem("username");

  // Save new username
  localStorage.setItem("username", newNameUser);

  // Dispatch custom event so whole app updates
  window.dispatchEvent(
    new CustomEvent("usernameChanged", {
      detail: {
        oldUsername,
        newUsername: newNameUser,
      },
    })
  );

  setNameUser(newNameUser);
  setNewNameUser("");
  toast.success("Username updated everywhere ✅");
};
  // Change Password
const changePassword = () => {
  const currentPassword = localStorage.getItem("Password");

  // If empty
  if (!newPassword.trim()) {
    toast.error("Password not updated ❌");
    return;
  }

  // If same as current password
  if (newPassword === currentPassword) {
    toast.warning("New password must be different ⚠️");
    return;
  }

  // If valid
  localStorage.setItem("Password", newPassword);
  toast.success("Password updated ✅");
  router.push("/login");
};

  // Delete Account
  const deleteAccount = () => {
    if (
      confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      localStorage.clear();
      toast("Account deleted ✅");
      router.push("/login");
    }
  };

  // Handle Profile Picture Upload
  const handleProfileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfilePic(base64String);
      localStorage.setItem("profilePic", base64String);
      toast("Profile picture updated ✅");
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen p-8 bg-white text-black dark:bg-gray-900 dark:text-white transition-all">
      <Toaster />
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Profile Picture Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Profile Picture</h2>

        <div className="mb-4">
          {profilePic ? (
            <img
              src={profilePic}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center">
              No Image
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={handleProfileUpload}
          className="mb-4"
        />
      </div>

      {/* Dark Mode */}
      <button
        onClick={darkModeToggle}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded cursor-pointer"
      >
        Switch to {modeDark ? "Light" : "Dark"} Mode
      </button>

      {/* Username */}
      <p className="mb-4">
        <strong>Current Username:</strong> {nameUser || "Not Set"}
      </p>

      <input
        type="text"
        placeholder="New Username"
        value={newNameUser}
        onChange={(e) => setNewNameUser(e.target.value)}
        className="p-2 border rounded mb-2 text-black"
      />
      <br />
      <button
        onClick={changeUsername}
        className="mb-6 px-4 py-2 bg-green-600 text-white rounded cursor-pointer"
      >
        Update Username
      </button>

      {/* Reset Password */}
      <div className="mb-6">
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="p-2 border rounded mb-2 text-black"
        />
        <br />
        <button
          onClick={changePassword}
          className="px-4 py-2 bg-yellow-600 text-white rounded cursor-pointer"
        >
          Reset Password
        </button>
      </div>

      {/* Delete Account */}
      <button
        onClick={deleteAccount}
        className="px-4 py-2 bg-red-700 text-white rounded cursor-pointer"
      >
        Delete Account
      </button>
    </div>
  );
}
