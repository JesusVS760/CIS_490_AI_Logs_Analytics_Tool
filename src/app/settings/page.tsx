"use client"
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";



declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export default function SettingClient(): any
{
  const router = useRouter();

  const [modeDark, setModeDark] = useState(false);
  const [nameuser, setNameUser] = useState("");
  const [newNameUser, setNewNameUser] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [log, setLog]= useState<string[]>([]);
  const [pointend, setPointEnd] = useState("");

  useEffect(() => 
  {
    const themeSaved = localStorage.getItem("theme");
    const usernameSaved = localStorage.getItem("username");
    const logSaved = JSON.parse(localStorage.getItem("log") || "[]");

    if (themeSaved === "dark") 
    {
      document.documentElement.classList.add("dark");
      setModeDark(true);
    }

    if (usernameSaved) setNameUser(usernameSaved);
    setLog(logSaved);
  }, []);

  // Function to toggle between light and dark mode
  const darkModeToggle = () =>
  {
    const themeNew = !modeDark;
    setModeDark(themeNew);

    if (themeNew)
    {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    else
    {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  //Change the username
  const changeUsername = () =>
  {
    if (!newNameUser.trim()) return alert ("Username cannot be empty");

    localStorage.setItem("username", newNameUser);
    setNameUser(newNameUser);
    setNewNameUser("");
  };

  //Change the password
  const changePassword = () =>
  {
    if (!newPassword.trim()) return alert ("Password cannot be empty");

    localStorage.setItem("Password", newPassword);
    router.push("/login");
  };

  //delete account
  const deleteAccount = () =>
  {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) 
    {
      localStorage.clear();
      router.push("/login");
    }
  };

  //Get API endpoint + Route
  const getEndpoint = async () =>
  {
    try
    {
      const response = await fetch("endpoint");

      if(response.ok)
      {
        router.push("/Upload point")//Valid API Route
      }
      else
      {
        router.push("/Invalid Page")//Invalid Custom Page
      }
    }
    catch (error)
    {
      router.push("/Error Page");//Error Custom Page
    }
  };

  return (
    <div className="min-h-screen p-8 bg-white text-black dark:bg-gray-900 dark:text-white transition-all">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Dark Mode */}
      <button
        onClick={darkModeToggle}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Switch to {modeDark ? "Light" : "Dark"} Mode
      </button>

      {/* Username */}
      <p className="mb-4">
        <strong>Current Username:</strong> {nameuser || "Not Set"}
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
        className="mb-6 px-4 py-2 bg-green-600 text-white rounded"
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
          className="px-4 py-2 bg-yellow-600 text-white rounded"
        >
          Reset Password
        </button>
      </div>

      {/* Uploaded Logs */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Uploaded Logs</h2>
        {log.length === 0 ? (
          <p>No logs found.</p>
        ) : (
          <ul className="list-disc pl-6">
            {log.map((logItem: any, index: any) => (
              <li key={index}>{logItem}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Fetch API Endpoint */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Enter API Endpoint URL"
          value={pointend}
          onChange={(e) => setPointEnd(e.target.value)}
          className="p-2 border rounded mb-2 text-black"
        />
        <br />
        <button
          onClick={getEndpoint}
          className="px-4 py-2 bg-purple-600 text-white rounded"
        >
          Fetch Endpoint
        </button>
      </div>

      {/* Delete Account */}
      <button
        onClick={deleteAccount}
        className="px-4 py-2 bg-red-700 text-white rounded"
      >
        Delete Account
      </button>
    </div>
  );

}


//Original Code Provided by the user, commented out for reference
//const SettingsPage = () => {
  //return (
   // <div className="flex items-center justify-center h-full flex-1 grow">
      //<h1>SettingsPage</h1>
    //</div>
  //);
//};

//export default SettingsPage;
