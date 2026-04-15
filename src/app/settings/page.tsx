"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Moon,
  Sun,
  Upload,
  User,
  KeyRound,
  Trash2,
  Loader2,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";

type StoredUser = {
  nameUser: string;
  profilePic: string | null;
};

export default function SettingClient() {
  const router = useRouter();

  const [modeDark, setModeDark] = useState(false);
  const [nameUser, setNameUser] = useState("");
  const [newNameUser, setNewNameUser] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [updatingTheme, setUpdatingTheme] = useState(false);
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const saveUserToStorage = (
    userName: string,
    userProfilePic: string | null
  ) => {
    const storedUser: StoredUser = {
      nameUser: userName,
      profilePic: userProfilePic,
    };
    localStorage.setItem("dashboardUser", JSON.stringify(storedUser));
  };

  const dispatchProfileUpdated = (
    userName: string,
    userProfilePic: string | null
  ) => {
    window.dispatchEvent(
      new CustomEvent("profile-updated", {
        detail: {
          nameUser: userName,
          profilePic: userProfilePic,
        },
      })
    );
  };

  const applyTheme = (isDark: boolean) => {
    setModeDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("dashboardTheme", isDark ? "dark" : "light");

    window.dispatchEvent(
      new CustomEvent("theme-updated", {
        detail: { darkMode: isDark },
      })
    );
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("dashboardTheme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setModeDark(true);
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      setModeDark(false);
    }

    const fetchUser = async () => {
      try {
        const res = await axios.get("/api/auth/me", {
          withCredentials: true,
        });

        const fetchedName =
          res.data?.user?.name || res.data?.username || "User";
        const fetchedProfilePic =
          res.data?.user?.profilePic ?? res.data?.profilePic ?? null;
        const fetchedDarkMode = Boolean(
          res.data?.user?.darkMode ?? res.data?.darkMode ?? false
        );

        setNameUser(fetchedName);
        setProfilePic(fetchedProfilePic);

        saveUserToStorage(fetchedName, fetchedProfilePic);
        dispatchProfileUpdated(fetchedName, fetchedProfilePic);
        applyTheme(fetchedDarkMode);
      } catch (error) {
        router.push("/login");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUser();
  }, [router]);

  const darkModeToggle = async () => {
    if (updatingTheme) return;

    try {
      setUpdatingTheme(true);

      const nextMode = !modeDark;

      const res = await axios.put(
        "/api/auth/theme",
        { darkMode: nextMode },
        { withCredentials: true }
      );

      const updatedDarkMode =
        typeof res.data?.darkMode === "boolean"
          ? res.data.darkMode
          : typeof res.data?.user?.darkMode === "boolean"
            ? res.data.user.darkMode
            : nextMode;

      applyTheme(updatedDarkMode);
      toast.success("Mode updated ✅");
    } catch (error) {
      toast.error("Failed to update mode ❌");
    } finally {
      setUpdatingTheme(false);
    }
  };

  const changeUsername = async () => {
    const trimmedName = newNameUser.trim();

    if (!trimmedName) {
      toast.error("Username cannot be empty ❌");
      return;
    }

    try {
      setUpdatingUsername(true);

      const res = await axios.put(
        "/api/auth/username",
        { name: trimmedName },
        { withCredentials: true }
      );

      const updatedName = res.data?.user?.name || trimmedName;

      setNameUser(updatedName);
      setNewNameUser("");
      saveUserToStorage(updatedName, profilePic);
      dispatchProfileUpdated(updatedName, profilePic);

      toast.success("Username updated ✅");
    } catch (error) {
      toast.error("Update failed ❌");
    } finally {
      setUpdatingUsername(false);
    }
  };

  const changePassword = async () => {
    const trimmedPassword = newPassword.trim();

    if (!trimmedPassword) {
      toast.error("Password cannot be empty ❌");
      return;
    }

    if (trimmedPassword.length < 6) {
      toast.error("Password must be at least 6 characters ❌");
      return;
    }

    try {
      setUpdatingPassword(true);

      await axios.put(
        "/api/auth/password",
        { newPassword: trimmedPassword },
        { withCredentials: true }
      );

      setNewPassword("");
      toast.success("Password updated ✅");
    } catch (error) {
      toast.error("Password update failed ❌");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
 const deleteAccount = async () => {
  // Confirm with the user before doing anything destructive.
  // If they cancel, bail out immediately.
  //if (!confirm("Are you sure you want to delete your account?")) return;

  try {
    // Disable the Delete button and show the spinner state.
    setDeletingAccount(true);
    setShowDeleteConfirm(false);
    // Call the backend to permanently delete the account and all
    // associated data. withCredentials ensures the session_token
    // cookie is sent so the server knows which account to delete.
    await axios.delete("/api/auth/delete", {
      withCredentials: true,
    });

    // Clear any cached user info and theme from localStorage so a
    // new account created afterward starts with a clean slate.
    localStorage.removeItem("dashboardUser");
    localStorage.removeItem("dashboardTheme");

    // Show a success toast confirming the account was removed.
    toast.success("Account removed. You've been signed out. 👋");

    // Delay the redirect briefly so the toast has time to render
    // before the Toaster unmounts on navigation.
    setTimeout(() => {
      router.push("/login");
    }, 1500);
  } catch (error) {
    // Handle axios-specific errors so we can surface the server's
    // error message (if any) to the user.
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      console.error(
        "Delete account error:",
        error.response?.status,
        message
      );
      toast.error(`Deletion failed: ${message} ❌`);
    } else {
      // Fallback for anything that isn't an axios error
      // (network failure, unexpected runtime error, etc.).
      console.error("Delete account unknown error:", error);
      toast.error("Deletion failed ❌");
    }
  } finally {
    // Always re-enable the button, whether the request succeeded
    // or failed, so the UI doesn't get stuck in a loading state.
    setDeletingAccount(false);
  }
};

  const handleProfileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setProfilePic(previewUrl);
    saveUserToStorage(nameUser, previewUrl);
    dispatchProfileUpdated(nameUser, previewUrl);

    const formData = new FormData();
    formData.append("profilePic", file);

    try {
      setUploadingPhoto(true);

      const res = await axios.put("/api/auth/profile-pic", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updatedProfilePic = res.data?.profilePic
        ? `${res.data.profilePic}?t=${Date.now()}`
        : previewUrl;

      setProfilePic(updatedProfilePic);
      saveUserToStorage(nameUser, updatedProfilePic);
      dispatchProfileUpdated(nameUser, updatedProfilePic);

      toast.success("Profile picture updated ✅");
    } catch (error) {
      toast.error("Upload failed ❌");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const inputClassName =
    "settings-input w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400";

  const inputStyle: React.CSSProperties = {
    color: modeDark ? "#ffffff" : "#111827",
    caretColor: modeDark ? "#ffffff" : "#111827",
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
        <Toaster />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .settings-input:-webkit-autofill,
        .settings-input:-webkit-autofill:hover,
        .settings-input:-webkit-autofill:focus,
        .settings-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #111827 !important;
          caret-color: #111827 !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        html.dark .settings-input:-webkit-autofill,
        html.dark .settings-input:-webkit-autofill:hover,
        html.dark .settings-input:-webkit-autofill:focus,
        html.dark .settings-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #1f2937 inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
        <Toaster />

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your account, profile, appearance, and security
              preferences.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column — Profile Overview */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-xl font-semibold">Profile Overview</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Your public account details and profile photo.
              </p>

              <div className="mt-6 flex flex-col items-center gap-4 text-center">
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt="Profile"
                    className="h-28 w-28 rounded-full border border-gray-300 object-cover dark:border-gray-700"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    <User className="h-10 w-10 text-gray-500 dark:text-gray-400" />
                  </div>
                )}

                <div>
                  <p className="text-lg font-semibold">{nameUser || "User"}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Update your photo and account details below.
                  </p>
                </div>

                <input
                  id="profileUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("profileUpload")?.click()
                  }
                  disabled={uploadingPhoto}
                  className="flex w-full items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Profile Picture
                    </>
                  )}
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-sm font-medium">Current username</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {nameUser || "No username set"}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-sm font-medium">Theme</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {modeDark ? "Dark mode enabled" : "Light mode enabled"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right column — Settings panels */}
            <div className="space-y-6 lg:col-span-2">
              {/* Appearance */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  {modeDark ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                  <h2 className="text-xl font-semibold">Appearance</h2>
                </div>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Customize how the application looks for your account.
                </p>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Theme mode</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Switch between light and dark mode.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={darkModeToggle}
                    disabled={updatingTheme}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updatingTheme
                      ? "Updating..."
                      : `Switch to ${modeDark ? "Light" : "Dark"} Mode`}
                  </button>
                </div>
              </div>

              {/* Username */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">Username</h2>
                </div>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Update the name shown for your account.
                </p>

                <div className="mt-4">
                  <label
                    htmlFor="new-username"
                    className="mb-2 block text-sm font-medium"
                  >
                    New Username
                  </label>
                  <input
                    id="new-username"
                    type="text"
                    placeholder="Enter a new username"
                    value={newNameUser}
                    onChange={(e) => setNewNameUser(e.target.value)}
                    autoComplete="username"
                    className={inputClassName}
                    style={inputStyle}
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={changeUsername}
                    disabled={updatingUsername}
                    className="rounded-lg bg-green-600 px-4 py-2 text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {updatingUsername ? "Updating..." : "Update Username"}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">Password</h2>
                </div>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Change your password to keep your account secure.
                </p>

                <div className="mt-4">
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-sm font-medium"
                  >
                    New Password
                  </label>

                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter a new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className={`${inputClassName} pr-11`}
                      style={inputStyle}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={changePassword}
                    disabled={updatingPassword}
                    className="rounded-lg bg-yellow-600 px-4 py-2 text-white transition hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {updatingPassword ? "Updating..." : "Reset Password"}
                  </button>
                </div>
              </div>

             {/* Danger Zone */}
              <div className="rounded-2xl border border-red-300 bg-white p-6 shadow-sm dark:border-red-800 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">Danger Zone</h2>
                </div>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Permanent and destructive account actions.
                </p>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Delete account</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This action is permanent and cannot be undone.
                    </p>
                  </div>

                  {/*
                    CHANGED: Button no longer calls deleteAccount() directly.
                    It now opens an in-app confirmation modal by setting
                    showDeleteConfirm to true, replacing the native
                    browser confirm() popup with a styled modal that
                    matches the app's theme (including dark mode).
                  */}
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingAccount}
                    className="flex items-center justify-center rounded-lg bg-red-700 px-4 py-2 text-white transition hover:bg-red-800 disabled:opacity-50"
                  >
                    {deletingAccount ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </>
                    )}
                  </button>
                </div>

                {/*
                  ADDED: Custom confirmation modal for account deletion.
                  Renders only when showDeleteConfirm is true.
                  - Full-screen dimmed overlay (bg-black/50)
                  - Centered modal card styled to match other settings cards
                  - Cancel closes the modal; Confirm calls deleteAccount()
                */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Delete your account?
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
     This action is permanent and cannot be undone. All
                        your courses, assignments, student data, and uploaded
                        logs will be permanently deleted.
                      </p>

                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={deleteAccount}
                          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
                        >
                          Yes, delete my account
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}