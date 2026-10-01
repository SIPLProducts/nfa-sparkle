import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

type Message = string | number | null | undefined;

function text(message: Message) {
  return message == null ? "" : String(message);
}

function fire(icon: "success" | "error" | "warning" | "info", message: Message) {
  if (typeof document === "undefined") return Promise.resolve();
  return Swal.fire({
    icon,
    text: text(message),
    confirmButtonText: "OK",
    buttonsStyling: false,
    customClass: {
      popup: "nfa-swal-popup",
      title: "nfa-swal-title",
      htmlContainer: "nfa-swal-content",
      confirmButton: "nfa-swal-confirm",
    },
  }).then(() => undefined);
}

/** Drop-in notification API used across the portal. Dynamic response text is passed through unchanged. */
export const toast = {
  success: (message: Message) => fire("success", message),
  error: (message: Message) => fire("error", message),
  warning: (message: Message) => fire("warning", message),
  info: (message: Message) => fire("info", message),
};

export async function swalConfirm({
  title,
  text: message,
  confirmText = "Confirm",
  destructive = false,
}: {
  title: string;
  text: string;
  confirmText?: string;
  destructive?: boolean;
}) {
  if (typeof document === "undefined") return false;
  const result = await Swal.fire({
    icon: "warning",
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: "nfa-swal-popup",
      title: "nfa-swal-title",
      htmlContainer: "nfa-swal-content",
      confirmButton: destructive ? "nfa-swal-confirm nfa-swal-destructive" : "nfa-swal-confirm",
      cancelButton: "nfa-swal-cancel",
    },
  });
  return result.isConfirmed;
}