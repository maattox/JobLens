import { useMemo } from "react";
import { renderFollowUpMarkdown } from "../../shared/followUpMarkdown";

interface FollowUpMarkdownProps {
  markdown: string;
}

export function FollowUpMarkdown({ markdown }: FollowUpMarkdownProps) {
  const html = useMemo(() => renderFollowUpMarkdown(markdown), [markdown]);

  return (
    <div
      className="follow-up-answer markdown-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
