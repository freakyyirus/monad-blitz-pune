"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabaseBrowserClient } from "@/app/lib/supabase-client";
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
      const supabaseClient = getSupabaseBrowserClient();
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
      {label && <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">{label}</label>}

      <div className="overflow-hidden rounded-xl border border-brand-border bg-white/5">
        <div className="flex items-center justify-between border-b border-brand-border bg-black/20 px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                !isPreview
                  ? "bg-accent/20 text-accent shadow-sm border border-accent/30"
                  : "text-white/40 hover:bg-white/10 hover:text-white"
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
                  ? "bg-accent/20 text-accent shadow-sm border border-accent/30"
                  : "text-white/40 hover:bg-white/10 hover:text-white"
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
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
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
            <div className="min-h-[200px] w-full prose prose-invert max-w-none text-white/80 break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value || "*Nothing to preview*"}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="h-full min-h-[200px] w-full resize-y bg-transparent outline-none placeholder:text-white/20 text-white"
            />
          )}
        </div>
      </div>
      <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mt-1">
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
    <div className={cn("prose prose-invert max-w-none break-words text-white/80", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitizedContent}</ReactMarkdown>
    </div>
  );
}
