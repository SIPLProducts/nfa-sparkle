import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

type Message = string | number | null | undefined;

function text(message: Message) {
  return message == null ? "" : String(message);
}


function fire(icon: "success" | "error" | "warning" | "info", message: Message, explicit?: HTMLElement) {
  if (typeof document === "undefined") return Promise.resolve();
  const target = explicit;
  return Swal.fire({
    icon,
    ...(target ? { target } : {}),
    text: text(message),
    confirmButtonText: "OK",
    buttonsStyling: false,
    customClass: {
      ...(target ? { container: "nfa-swal-in-dialog" } : {}),
      popup: "nfa-swal-popup",
      title: "nfa-swal-title",
      htmlContainer: "nfa-swal-content",
      confirmButton: "nfa-swal-confirm",
    },
  }).then(() => undefined);
}

/** Drop-in notification API used across the portal. Dynamic response text is passed through unchanged. */
export const toast = {
  success: (message: Message, target?: HTMLElement) => fire("success", message, target),
  error: (message: Message) => fire("error", message),
  warning: (message: Message) => fire("warning", message),
  info: (message: Message, target?: HTMLElement) => fire("info", message, target),
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
  const target: HTMLElement | undefined = undefined;
  const result = await Swal.fire({
    icon: "warning",
    ...(target ? { target } : {}),
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      ...(target ? { container: "nfa-swal-in-dialog" } : {}),
      popup: "nfa-swal-popup",
      title: "nfa-swal-title",
      htmlContainer: "nfa-swal-content",
      confirmButton: destructive ? "nfa-swal-confirm nfa-swal-destructive" : "nfa-swal-confirm",
      cancelButton: "nfa-swal-cancel",
    },
  });
  return result.isConfirmed;
}