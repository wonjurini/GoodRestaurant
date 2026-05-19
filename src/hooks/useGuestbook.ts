import { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';

export interface GuestbookEntry {
  id: string;
  date: string;
  message: string;
}

const SHEET_ID = '1e_iFONEtX9CaebJuEoZx37Sdc5sI-Kr5eg34mdH4I3Q';
const GUESTBOOK_GID = '1853269471';
const GUESTBOOK_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GUESTBOOK_GID}`;

function pickValue(row: Record<string, string>, keys: string[], fallbackIndex: number) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }

  const values = Object.values(row);
  return values[fallbackIndex]?.trim() || '';
}

export function useGuestbook(enabled: boolean) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGuestbook = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${GUESTBOOK_CSV_URL}&cacheBust=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`방명록을 불러오지 못했습니다: ${response.status}`);
      }

      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          const parsedEntries = rows
            .map((row, index) => {
              const date = pickValue(row, ['날짜', '일자', 'Date'], 1);
              const message = pickValue(row, ['오늘의 한 마디', '오늘의 한마디', '한마디', '내용', 'Message'], 2);

              return {
                id: `${date}-${index}`,
                date,
                message,
              };
            })
            .filter((entry) => entry.date || entry.message);

          setEntries(parsedEntries);
        },
        error: (parseError: Error) => {
          setError(parseError);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error fetching guestbook'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      fetchGuestbook();
    }
  }, [enabled, fetchGuestbook]);

  return { entries, loading, error, refetch: fetchGuestbook };
}
