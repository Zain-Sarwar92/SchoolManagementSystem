import { useCallback, useEffect, useState } from "react";
import { toast } from "../../../components/ui/toast.jsx";
import { fetchCatalog } from "../bank/index.js";

/** Load TG curriculum catalog with retry-friendly error state. */
export function useGeneratorCatalog() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);

  const reloadCatalog = useCallback(async () => {
    setLoading(true);
    setCatalogError(null);
    try {
      const data = await fetchCatalog();
      setBoards(data.boards || []);
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load catalog";
      setCatalogError(message);
      setBoards([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCatalog();
  }, [reloadCatalog]);

  return { boards, setBoards, loading, catalogError, reloadCatalog };
}
