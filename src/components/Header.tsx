"use client";
import Link from "next/link";
import { useSidebar } from "./ui/sidebar";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const Header = () => {
  const { toggleSidebar } = useSidebar();
  const { isSignedIn, user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const [isPdfMode, setIsPdfMode] = useState(false);

  useEffect(() => {
    // Check if we're in PDF mode by looking for a specific query param
    setIsPdfMode(searchParams.get("pdf") === "true");
  }, [searchParams]);

  const isUserLoggedIn = isLoaded && isSignedIn;

  // Hide header in PDF mode
  if (isPdfMode) {
    return null;
  }

  return (
    <div className="fixed md:hidden right-0 left-0 w-full top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 z-50">
      <div className="flex justify-center sm:justify-between items-center p-4 ">
        <div className="flex flex-row items-center gap-2 shrink-0 w-full">
          <div className="flex flex-row items-center gap-4 justify-center w-full">
            {isUserLoggedIn && (
              <button
                className="p-1 cursor-pointer absolute left-5"
                onClick={() => {
                  toggleSidebar();
                }}
              >
                <img src="/menu.svg" className="size-5" />
              </button>
            )}
            <Link className="flex flex-row items-center gap-2" href="/">
              <div className="flex flex-row items-center gap-2">
                <div className=" text-zinc-800 dark:text-zinc-100">
                  <img
                    src="/logo.svg"
                    alt="Open Deep Research"
                    className="size-6"
                  />
                </div>
                <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
                  Open Deep Research
                </div>
              </div>
            </Link>
          </div>
        </div>
        <div className="flex flex-row items-center gap-2 shrink-0"></div>
      </div>
    </div>
  );
};
