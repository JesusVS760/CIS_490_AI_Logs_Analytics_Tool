"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type DashboardAssignmentFilterContextType = {
  selectedAssignment: string;
  setSelectedAssignment: (value: string) => void;
  assignmentOptions: string[];
  setAssignmentOptions: (options: string[]) => void;
};

const DashboardAssignmentFilterContext =
  createContext<DashboardAssignmentFilterContextType>({
    selectedAssignment: "all",
    setSelectedAssignment: () => {},
    assignmentOptions: [],
    setAssignmentOptions: () => {},
  });

export function DashboardAssignmentFilterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedAssignment, setSelectedAssignment] = useState("all");
  const [assignmentOptions, setAssignmentOptions] = useState<string[]>([]);

  useEffect(() => {
    if (
      selectedAssignment !== "all" &&
      !assignmentOptions.includes(selectedAssignment)
    ) {
      setSelectedAssignment("all");
    }
  }, [assignmentOptions, selectedAssignment]);

  const value = useMemo(
    () => ({
      selectedAssignment,
      setSelectedAssignment,
      assignmentOptions,
      setAssignmentOptions,
    }),
    [selectedAssignment, assignmentOptions]
  );

  return (
    <DashboardAssignmentFilterContext.Provider value={value}>
      {children}
    </DashboardAssignmentFilterContext.Provider>
  );
}

export function useDashboardAssignmentFilter() {
  return useContext(DashboardAssignmentFilterContext);
}
