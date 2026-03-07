"use client";

import { Bell } from "lucide-react";
import React from "react";

/* ADD FUNCTIONALITY FOR BELL BUTTON  */

import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AlertCard } from "./AlertCard";

const Notifications = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Bell />
      </SheetTrigger>
      <SheetContent className="flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Stay up to date and read what is new around here!
          </SheetDescription>
        </SheetHeader>
        <AlertCard />
        <SheetFooter className="mt-auto">
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default Notifications;
