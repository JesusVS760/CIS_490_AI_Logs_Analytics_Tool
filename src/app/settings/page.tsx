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
} from "lucide-react";

/** Shape of the user object persisted in localStorage under "dashboardUser". */
type StoredUser = {
  nameUser: string;
  profilePic: string | null;
};

export default function SettingClient() {
  const router = useRouter();

  // ── UI / loading state ──────────────────────────────────────────────────────
  const [modeDark, setModeDark] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  // ── User profile state ──────────────────────────────────────────────────────
  const [nameUser, setNameUser] = useState("");       // current saved username
  const [newNameUser, setNewNameUser] = useState(""); // controlled input value
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // ── Per-action loading flags (prevent duplicate requests) ───────────────────
  const [updatingTheme, setUpdatingTheme] = useState(false);
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Controls visibility of the delete-account confirmation modal.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Persists the current username and profile picture URL to localStorage so
   * other parts of the app (e.g. the sidebar) can read them without an API call.
   */
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

  /**
   * Fires a "profile-updated" CustomEvent on the window so any component that
   * listens for it (e.g. the sidebar avatar) can re-render immediately without
   * a page refresh.
   */
  const dispatchProfileUpdated = (
    userName: string,
    userProfilePic: string | null
  ) => {
    window.dispatchEvent(
      new CustomEvent("profile-updated", {
        detail: { nameUser: userName, profilePic: userProfilePic },
      })
    );
  };

  /**
   * Applies a dark/light theme by toggling the "dark" class on <html>,
   * persisting the choice to localStorage, and broadcasting a "theme-updated"
   * event so other components can respond without a full reload.
   */
  const applyTheme = (isDark: boolean) => {
    setModeDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("dashboardTheme", isDark ? "dark" : "light");
    window.dispatchEvent(
      new CustomEvent("theme-updated", { detail: { darkMode: isDark } })
    );
  };

  // ── Initialisation ───────────────────────────────────────────────────────────

  /**
   * On mount:
   * 1. Reads any cached theme from localStorage and applies it immediately so
   *    there is no flash of the wrong theme while the API call is in-flight.
   * 2. Fetches the authenticated user's profile from /api/auth/me. On failure
   *    (expired session, 401, etc.) redirects to /login.
   */
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
        const res = await axios.get("/api/auth/me", { withCredentials: true });

        // The API may return the name under different keys depending on version;
        // fall back through each until we find a value.
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
      } catch {
        router.push("/login");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUser();
  }, [router]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  /**
   * Toggles dark/light mode for the current user. Persists the preference to
   * the database via PUT /api/auth/theme so it survives across sessions and
   * devices. Uses the value returned by the API as the source of truth in case
   * the server normalises or rejects the value.
   */
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
      // Prefer the server-confirmed value; fall back to the optimistic value.
      const updatedDarkMode =
        typeof res.data?.darkMode === "boolean"
          ? res.data.darkMode
          : typeof res.data?.user?.darkMode === "boolean"
            ? res.data.user.darkMode
            : nextMode;
      applyTheme(updatedDarkMode);
      toast.success("Mode updated ✅");
    } catch {
      toast.error("Failed to update mode ❌");
    } finally {
      setUpdatingTheme(false);
    }
  };

  /**
   * Saves a new username via PUT /api/auth/username and immediately syncs the
   * updated name to localStorage and any listening components so the sidebar
   * reflects the change without a reload.
   */
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
    } catch {
      toast.error("Update failed ❌");
    } finally {
      setUpdatingUsername(false);
    }
  };

  /**
   * Permanently deletes the account via DELETE /api/auth/delete.
   * Called only after the user confirms in the modal (setShowDeleteConfirm).
   * Clears localStorage cache before redirecting to /login so a subsequent
   * sign-up starts with a clean state.
   */
  const deleteAccount = async () => {
    try {
      setDeletingAccount(true);
      setShowDeleteConfirm(false);

      await axios.delete("/api/auth/delete", { withCredentials: true });

      localStorage.removeItem("dashboardUser");
      localStorage.removeItem("dashboardTheme");

      toast.success("Account removed. You've been signed out. 👋");

      // Delay navigation so the toast is visible before the Toaster unmounts.
      setTimeout(() => router.push("/login"), 1500);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;
        console.error("Delete account error:", error.response?.status, message);
        toast.error(`Deletion failed: ${message} ❌`);
      } else {
        console.error("Delete account unknown error:", error);
        toast.error("Deletion failed ❌");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  /**
   * Handles profile picture selection. Shows a local object-URL preview
   * immediately (optimistic UI), then uploads the file to /api/auth/profile-pic.
   * A cache-busting query string is appended to the URL returned by the server
   * so the browser doesn't serve the old image from its cache.
   */
  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show the local preview instantly while the upload is in-flight.
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
    } catch {
      toast.error("Upload failed ❌");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Shared input styles ──────────────────────────────────────────────────────

  // Tailwind class string shared by all text inputs on this page.
  const inputClassName =
    "settings-input w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400";

  // Inline style to set text and caret color explicitly. Required because some
  // browsers override Tailwind's text-color utilities when autocomplete is active.
  const inputStyle: React.CSSProperties = {
    color: modeDark ? "#ffffff" : "#111827",
    caretColor: modeDark ? "#ffffff" : "#111827",
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  // Show a spinner while the initial /api/auth/me call is in-flight.
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
      {/*
        Global autofill overrides for .settings-input elements.
        Browsers inject their own background/text colours on autofilled inputs;
        these rules force the correct light/dark palette so autofill doesn't
        visually break the form.
      */}
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
              Manage your account, profile, appearance, and security preferences.
            </p>
          </div>

          {/* Page layout: narrow profile card on the left, settings panels on the right */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* ── Left column: Profile Overview ──────────────────────────────── */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-xl font-semibold">Profile Overview</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Your public account details and profile photo.
              </p>

              <div className="mt-6 flex flex-col items-center gap-4 text-center">
                {/* Show the profile picture if set, otherwise a placeholder icon */}
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

                {/*
                  Hidden file input triggered programmatically by the button below.
                  Using a hidden input + button avoids native file-input styling
                  inconsistencies across browsers.
                */}
                <input
                  id="profileUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("profileUpload")?.click()}
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

              {/* Read-only summary tiles showing the current username and theme */}
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

            {/* ── Right column: Settings panels (spans 2 of 3 grid columns) ─── */}
            <div className="space-y-6 lg:col-span-2">

              {/* Appearance — toggle between light and dark mode */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  {modeDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
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

              {/* Username — inline update via the changeUsername handler */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">Username</h2>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Update the name shown for your account.
                </p>
                <div className="mt-4">
                  <label htmlFor="new-username" className="mb-2 block text-sm font-medium">
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

              {/*
                Password — navigates to /reset-password instead of allowing an
                inline change. The reset page handles the full email-verification
                flow (send code → verify → set new password), which is safer than
                letting a logged-in user overwrite the password without re-auth.
              */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">Password</h2>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Change your password to keep your account secure.
                </p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Reset password</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You'll be guided through a secure password reset flow.
                    </p>
                  </div>
                  {/* router.push keeps the navigation client-side (no full reload) */}
                  <button
                    type="button"
                    onClick={() => router.push("/reset-password")}
                    className="rounded-lg bg-yellow-600 px-4 py-2 text-white transition hover:bg-yellow-700"
                  >
                    Reset Password
                  </button>
                </div>
              </div>

              {/* Danger Zone — destructive, irreversible account actions */}
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
                  {/* Opens the confirmation modal; does not delete immediately */}
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
                  Confirmation modal — rendered in-place inside the Danger Zone
                  card. The fixed overlay covers the full viewport (z-50) and a
                  centred card asks the user to confirm before deleteAccount() runs.
                */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Delete your account?
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        This action is permanent and cannot be undone. All your
                        courses, assignments, student data, and uploaded logs will
                        be permanently deleted.
                      </p>
                      <div className="mt-6 flex justify-end gap-3">
                        {/* Cancel dismisses the modal without taking any action */}
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        {/* Confirm triggers the irreversible deleteAccount() call */}
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
