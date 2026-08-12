import ConfirmModal from "@/components/common/ConfirmModal";

export default function LogoutConfirmModal({ isAdmin, onConfirm, onCancel }) {
  return (
    <ConfirmModal
      isOpen={true}
      variant="danger"
      icon="logout"
      title="Sign out?"
      description={`You'll need to sign in again to access ${isAdmin ? "the admin workspace" : "your account"}.`}
      confirmText="Yes, sign out"
      cancelText="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
