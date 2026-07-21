import type { ReactNode } from "react";

export function StatusMessage({
  message,
  type,
}: {
  message: string;
  type: "" | "success" | "error";
}) {
  if (!message) return <div className="status" />;
  return <div className={`status ${type}`}>{message}</div>;
}

export function Modal({
  title,
  children,
  onClose,
  className,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={className ? `modal ${className}` : "modal"}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
