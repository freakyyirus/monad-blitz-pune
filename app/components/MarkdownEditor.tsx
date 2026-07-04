"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabaseClient } from "@/app/lib/supabase-client";
import { Loader2, Image as ImageIcon, Eye, Edit2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  className,
}: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("media")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage.from("media").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const isImage = file.type.startsWith("image/");
      const markdownToInsert = isImage
        ? `\n![${file.name}](${publicUrl})\n`
        : `\n[Download ${file.name}](${publicUrl})\n`;

      onChange(value + markdownToInsert);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <label className="text-sm font-medium text-gray-600">{label}</label>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                !isPreview
                  ? "bg-white text-blue-600 shadow-sm border border-gray-200"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              )}
            >
              <Edit2 className="h-4 w-4" />
              Write
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isPreview
                  ? "bg-white text-blue-600 shadow-sm border border-gray-200"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              )}
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 transition-colors"
              title="Upload Image or File"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Add Media</span>
            </button>
          </div>
        </div>

        <div className="min-h-[200px] p-4">
          {isPreview ? (
            <div className="min-h-[200px] w-full prose max-w-none text-gray-700 break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value || "*Nothing to preview*"}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="h-full min-h-[200px] w-full resize-y bg-transparent outline-none placeholder:text-gray-400 text-gray-900"
            />
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Supports Markdown. You can drag & drop images or use the &quot;Add Media&quot; button.
      </p>
    </div>
  );
}

import DOMPurify from "isomorphic-dompurify";

export function MarkdownViewer({ content, className }: { content: string; className?: string }) {
  // Sanitize the incoming markdown string before rendering it
  const sanitizedContent = DOMPurify.sanitize(content);

  return (
    <div className={cn("prose max-w-none break-words text-gray-700", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitizedContent}</ReactMarkdown>
    </div>
  );
}
