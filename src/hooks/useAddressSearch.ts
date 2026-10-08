import { useState, useEffect, useRef } from 'react';
import { searchAddresses, AddressSuggestion, CitySuggestion } from '@/lib/address-search';

export type { AddressSuggestion } from '@/lib/address-search';

/** Adresses dans la ville choisie, sur la base officielle de son pays. */
export function useAddressSearch(query: string, city: CitySuggestion | null) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 3 || !city) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        setSuggestions(await searchAddresses(query, city));
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, city]);

  return { suggestions, isLoading };
}
