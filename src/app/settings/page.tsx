"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function SettingClient() {
  const router = useRouter();

  const [modeDark, setModeDark] = useState(false);
  const [nameUser, setNameUser] = useState("");
  const [newNameUser, setNewNameUser] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // 🔹 Fetch logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("/api/user/me", {
          withCredentials: true,
        });

        setNameUser(res.data.username);
        setProfilePic(res.data.profilePic);
        setModeDark(res.data.darkMode);

        if (res.data.darkMode) {
          document.documentElement.classList.add("dark");
        }
      } catch {
        router.push("/login");
      }
    };

    fetchUser();
  }, [router]);

  // 🔹 Toggle dark mode
  const darkModeToggle = async () => {
    try {
      const res = await axios.put(
        "/api/user/theme",
        { darkMode: !modeDark },
        { withCredentials: true }
      );

      setModeDark(res.data.darkMode);
      document.documentElement.classList.toggle("dark");

      toast.success("Mode updated ✅");
    } catch {
      toast.error("Failed to update mode ❌");
    }
  };

  // 🔹 Change username
  const changeUsername = async () => {
    if (!newNameUser.trim()) {
      toast.error("Username cannot be empty ❌");
      return;
    }

    try {
      await axios.put(
        "/api/user/username",
        { username: newNameUser },
        { withCredentials: true }
      );

      setNameUser(newNameUser);
      setNewNameUser("");
      toast.success("Username updated ✅");
    } catch {
      toast.error("Update failed ❌");
    }
  };

  // 🔹 Change password
  const changePassword = async () => {
    if (!newPassword.trim()) {
      toast.error("Password cannot be empty ❌");
      return;
    }

    try {
      await axios.put(
        "/api/user/password",
        { password: newPassword },
        { withCredentials: true }
      );

      toast.success("Password updated ✅");
      router.push("/login");
    } catch {
      toast.error("Password update failed ❌");
    }
  };

  // 🔹 Delete account
  const deleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account?")) return;

    try {
      await axios.delete("/api/user", {
        withCredentials: true,
      });

      toast.success("Account deleted ✅");
      router.push("/login");
    } catch {
      toast.error("Deletion failed ❌");
    }
  };

  // 🔹 Upload profile picture
  const handleProfileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // preview immediately
    setProfilePic(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("profilePic", file);

    try {
      const res = await axios.put(
        "/api/user/profile-pic",
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setProfilePic(res.data.profilePic);
      toast.success("Profile picture updated ✅");
    } catch {
      toast.error("Upload failed ❌");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-white text-black dark:bg-gray-900 dark:text-white transition-all">
      <Toaster />

      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* 🔹 Profile Picture Section */}
      <div className="mb-6 flex flex-col items-center">

        {profilePic ? (
          <img
            src={profilePic}
            className="w-32 h-32 rounded-full object-cover mb-4 border"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center mb-4">
            No Photo
          </div>
        )}

        {/* Hidden File Input */}
        <input
          id="profileUpload"
          type="file"
          accept="image/*"
          onChange={handleProfileUpload}
          className="hidden"
        />

        {/* Upload Button */}
        <button
          onClick={() =>
            document.getElementById("profileUpload")?.click()
          }
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
        >
          Upload Profile Picture
        </button>
      </div>

      {/* 🔹 Dark Mode */}
      <button
        onClick={darkModeToggle}
        className="block mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Switch to {modeDark ? "Light" : "Dark"} Mode
      </button>

      {/* 🔹 Username */}
      <p className="mt-6">
        <strong>Current Username:</strong> {nameUser}
      </p>

      <input
        type="text"
        placeholder="New Username"
        value={newNameUser}
        onChange={(e) => setNewNameUser(e.target.value)}
        className="p-2 border rounded mt-2 text-black"
      />

      <button
        onClick={changeUsername}
        className="block mt-2 px-4 py-2 bg-green-600 text-white rounded"
      >
        Update Username
      </button>

      {/* 🔹 Password */}
      <input
        type="password"
        placeholder="New Password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="p-2 border rounded mt-6 text-black"
      />

      <button
        onClick={changePassword}
        className="block mt-2 px-4 py-2 bg-yellow-600 text-white rounded"
      >
        Reset Password
      </button>

      {/* 🔹 Delete Account */}
      <button
        onClick={deleteAccount}
        className="block mt-6 px-4 py-2 bg-red-700 text-white rounded"
      >
        Delete Account
      </button>
    </div>
  );
}


//check to push to github aaaffff