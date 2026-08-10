import { useState, useCallback, useRef, useEffect } from 'react';
import { parseApiError } from '@/utils/errorUtils';

export default function useAdminAsync(asyncFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const execute = useCallback(async (...args) => {
    if (isMounted.current) {
      setLoading(true);
      setError(null);
    }
    
    try {
      const result = await asyncFn(...args);
      if (isMounted.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (isMounted.current) {
        setError(parseApiError(err));
      }
      throw err;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [asyncFn]);

  return { data, loading, error, execute, setData, setError, isMounted };
}
