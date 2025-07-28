"use client";
import { useState, useRef, useEffect } from "react";
import cn from "classnames";
import { ArrowUpIcon } from "./icons";
import { toast } from "sonner";
import { useTogetherApiKey } from "./app/ApiKeyControls";

export const ChatInput = ({
  append,
  disabled,
}: {
  disabled?: boolean;
  append: (message: {
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
  }) => void;
}) => {
  const [input, setInput] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("chatInput") || "";
    }
    return "";
  });
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { apiKey } = useTogetherApiKey();

  useEffect(() => {
    if (textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 400);
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("chatInput", input);
    }
  }, [input]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (apiKey) {
        formData.append("apiKey", apiKey);
      }

      const response = await fetch("/api/process-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process file");
      }

      const result = await response.json();
      setInput(result.researchTopic);
      toast.success(`File processed: ${result.fileName}`);
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process file");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div
      className="p-3 relative overflow-hidden rounded-lg max-w-[640px] mx-auto w-full flex"
      style={{
        border: "1px solid transparent",
        borderRadius: "8px",
        background: `
          linear-gradient(white, white) padding-box,
          radial-gradient(circle at center, #072D77, #D1D5DC) border-box
        `,
        backgroundOrigin: "border-box",
        backgroundRepeat: "no-repeat",
        boxShadow: "0px 1px 13px -6px rgba(0,0,0,0.2)",
      }}
    >
      <textarea
        ref={textareaRef}
        className="mb-12 resize-none w-full min-h-12 outline-none bg-transparent placeholder:text-zinc-400 max-h-[240px] overflow-y-auto"
        placeholder="Type your message (Enter to send, Shift+Enter for new line)"
        value={input}
        disabled={disabled}
        onChange={(event) => {
          setInput(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if (input === "") {
              return;
            }

            append({
              role: "user",
              content: input.trimEnd(),
              createdAt: new Date(),
            });

            setInput("");
            if (typeof window !== "undefined") {
              localStorage.removeItem("chatInput");
            }
          }
        }}
      />

      <div className="absolute bottom-2.5 right-2.5 flex flex-row gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          onChange={handleFileUpload}
          className="hidden"
          disabled={disabled || isProcessingFile}
        />
        <button
          className={cn(
            "px-3 py-1 flex flex-row justify-center items-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors",
            isProcessingFile && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isProcessingFile}
          title="Upload a file to generate research topic"
        >
          {isProcessingFile ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload File
            </span>
          )}
        </button>
        <button
          className={cn(
            "size-[26px] flex flex-row justify-center items-center bg-[#093999] text-white rounded"
          )}
          onClick={() => {
            if (input === "") {
              return;
            }

            append({
              role: "user",
              content: input.trimEnd(),
              createdAt: new Date(),
            });
            setInput("");
            if (typeof window !== "undefined") {
              localStorage.removeItem("chatInput");
            }
          }}
        >
          <ArrowUpIcon size={12} />
        </button>
      </div>
    </div>
  );
};
