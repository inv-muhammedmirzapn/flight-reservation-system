import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';

/**
 * Custom hook to encapsulate boilerplate for delete operations in the admin panel.
 * Handles state for delete item, loading state, and error handling.
 */
export default function useDeleteAction({ thunk, onSuccess, successMessage = 'Deleted successfully.', errorMessage = 'Failed to delete.' }) {
  const dispatch = useDispatch();
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isDeletingRef = useRef(false);

  const confirmDelete = async () => {
    if (!deleteItem || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setDeleteLoading(true);

    try {
      await dispatch(thunk(deleteItem.id)).unwrap();
      const msg = typeof successMessage === 'function' ? successMessage(deleteItem) : successMessage;
      toast.success(msg);
      setDeleteItem(null);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.detail || err?.message || err?.error || errorMessage);
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
      isDeletingRef.current = false;
    }
  };

  return { deleteItem, setDeleteItem, deleteLoading, confirmDelete };
}
