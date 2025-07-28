"use client";
import { useState } from "react";

export interface ResearchConfig {
  maxTokens: number;      // Report length (2048-16384)
  budget: number;         // Number of refinement cycles (0-5)
  maxQueries: number;     // Queries per cycle (1-5)
  maxSources: number;     // Maximum sources to include (3-10)
}

interface ResearchSettingsProps {
  config: ResearchConfig;
  onChange: (config: ResearchConfig) => void;
}

export const ResearchSettings = ({ config, onChange }: ResearchSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof ResearchConfig, value: number) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="w-full max-w-[640px] mx-auto mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Advanced Settings
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
          {/* Report Length Slider */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Report Length</span>
              <span className="text-gray-500">{config.maxTokens.toLocaleString()} tokens</span>
            </label>
            <input
              type="range"
              min="2048"
              max="16384"
              step="1024"
              value={config.maxTokens}
              onChange={(e) => handleChange("maxTokens", parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#072d77]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Short</span>
              <span>Medium</span>
              <span>Long</span>
            </div>
          </div>

          {/* Refinement Cycles Slider */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Research Depth (Refinement Cycles)</span>
              <span className="text-gray-500">{config.budget}</span>
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={config.budget}
              onChange={(e) => handleChange("budget", parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#072d77]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Basic</span>
              <span>Standard</span>
              <span>Deep</span>
            </div>
          </div>

          {/* Queries per Cycle Slider */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Searches per Cycle</span>
              <span className="text-gray-500">{config.maxQueries}</span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={config.maxQueries}
              onChange={(e) => handleChange("maxQueries", parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#072d77]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Focused</span>
              <span>Balanced</span>
              <span>Broad</span>
            </div>
          </div>

          {/* Max Sources Slider */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Maximum Sources</span>
              <span className="text-gray-500">{config.maxSources}</span>
            </label>
            <input
              type="range"
              min="3"
              max="10"
              step="1"
              value={config.maxSources}
              onChange={(e) => handleChange("maxSources", parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#072d77]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Few</span>
              <span>Standard</span>
              <span>Many</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-xs text-blue-700">
              <strong>Tip:</strong> Higher values increase research quality but take more time and use more API credits.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};