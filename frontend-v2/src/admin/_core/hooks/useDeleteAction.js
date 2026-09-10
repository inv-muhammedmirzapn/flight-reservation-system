import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { parseApiError } from '@/utils/errorUtils';

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
      let msg = parseApiError(err, errorMessage);
      const errStr = typeof err === 'string' ? err : JSON.stringify(err || '');
      if (errStr.toLowerCase().includes('protected') || errStr.toLowerCase().includes('foreign key') || errStr.toLowerCase().includes('reference')) {
        msg = 'Cannot delete this record because other active records (routes, flights, or bookings) depend on it.';
      }
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
      isDeletingRef.current = false;
    }
  };

  return { deleteItem, setDeleteItem, deleteLoading, confirmDelete };
}
