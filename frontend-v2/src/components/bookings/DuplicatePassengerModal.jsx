import ConfirmModal from "@/components/common/ConfirmModal";

export default function DuplicatePassengerModal({ isOpen, onConfirm, onCancel }) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      variant="warning"
      icon="warning"
      title="Duplicate Passenger Details"
      description="You have entered duplicate details for multiple passengers. Do you want to confirm?"
      confirmText="Confirm"
      cancelText="Go Back"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
