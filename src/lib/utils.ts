import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const randomColor = () => {
  const r = Math.floor(Math.random() * 201);
  const g = Math.floor(Math.random() * 201);
  const b = Math.floor(Math.random() * 201);

  const toHex = (x: number) => x.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
