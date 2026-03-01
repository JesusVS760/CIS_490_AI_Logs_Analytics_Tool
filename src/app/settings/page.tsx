"use client"
//Server Component???
//import SettingsClient from "./components/SettingsClient";

//export default function SettingsPage() 
//{
  //export default function SettingsPage() 
  //{
    //return <SettingsClient />;
 // }

//}
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingClient()
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
    if (newNameUser.trim()) return alert ("Username cannot be empty");

    localStorage.setItem("username", newNameUser);
    setNameUser(newNameUser);
    setNewNameUser("");
  };

  //Change the password
  const changePassword = () =>
  {
    if (newPassword.trim()) return alert ("Password cannot be empty");

    localStorage.setItem("Password", newPassword);
    router.push("/login");
  };
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
