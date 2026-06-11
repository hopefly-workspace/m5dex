import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getFavourites } from '../services/favouritesWishlistApi';

export function useFavouritesList() {
  const { isAuthenticated } = useAuth();
  const [favouritesList, setFavouritesList] = useState([]);
  const [favouritesLoading, setFavouritesLoading] = useState(false);

  const refreshFavourites = useCallback(async () => {
    if (!isAuthenticated) {
      setFavouritesList([]);
      return;
    }
    setFavouritesLoading(true);
    try {
      const list = await getFavourites();
      setFavouritesList(Array.isArray(list) ? list : []);
    } catch {
      setFavouritesList([]);
    } finally {
      setFavouritesLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshFavourites();
  }, [refreshFavourites]);

  return { favouritesList, favouritesLoading, refreshFavourites };
}
