"use client";
import { toast } from "sonner";
import { useState } from "react";
import { slugifyFilename } from "@/lib/utils";

export const DownloadPdfButton = ({ fileName }: { fileName?: string }) => {
  const [loading, setLoading] = useState(false);

  const handleDownloadPdf = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          url: window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'pdf=true', 
          fileName 
        }),
      });

      if (!response.ok) {
        throw new Error("PDF generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      // Use slugified filename to match backend
      const safeFileName = slugifyFilename(fileName || "report");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownloadPdf}
      className="cursor-pointer flex flex-col justify-center items-center overflow-hidden  gap-2.5 px-3 py-1.5 rounded bg-[#072d77] border border-[#072d77]"
      disabled={loading}
    >
      <div className="flex justify-start items-center self-stretch relative gap-1.5">
        {loading ? (
          <p className="flex-grow-0 flex-shrink-0 text-sm text-left text-white">
            Generating PDF...
          </p>
        ) : (
          <>
            <img src="/download.svg" alt="" className="size-4" />
            <p className="flex-grow-0 flex-shrink-0 text-sm text-left text-white">
              Download as PDF
            </p>
          </>
        )}
      </div>
    </button>
  );
};
