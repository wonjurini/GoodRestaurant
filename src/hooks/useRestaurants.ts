import { useState, useEffect } from 'react';
import Papa from 'papaparse';

export interface Restaurant {
  id: string;
  category: string;
  name: string;
  rating: string;
  url: string;
  review: string;
}

const CATEGORIES = ['한식', '중식', '양식', '일식', '기타', '카페'];
const SHEET_ID = '1e_iFONEtX9CaebJuEoZx37Sdc5sI-Kr5eg34mdH4I3Q';
const CLOSED_RESTAURANT_ROWS: Record<string, Set<number>> = {
  한식: new Set([8, 12, 19, 21, 24, 25, 26, 33, 39, 41, 46, 53, 54, 55, 59, 72, 74, 79, 82, 89]),
  중식: new Set([3, 8, 14, 15]),
  양식: new Set([5, 6, 8, 12]),
  일식: new Set([3, 5, 6, 8, 10, 15, 16, 20, 22, 25, 28]),
  기타: new Set([2, 8, 13, 16, 19]),
  카페: new Set([8]),
};

export function useRestaurants() {
  const [data, setData] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const allData: Restaurant[] = [];

        // Fetch all sheets in parallel
        await Promise.all(CATEGORIES.map(async (category) => {
          const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(category)}`;
          const response = await fetch(url);
          const csvText = await response.text();
          
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const rows = results.data as Record<string, string>[];
              rows.forEach((row, index) => {
                const sheetRowNumber = index + 2;

                // Ensure row has the required fields
                if (row['이름'] && !CLOSED_RESTAURANT_ROWS[category]?.has(sheetRowNumber)) {
                  allData.push({
                    id: `${category}-${index}`,
                    category,
                    name: row['이름'] || '',
                    rating: row['별점'] || '',
                    url: row['URL'] || '',
                    review: row['한줄리뷰'] || '',
                  });
                }
              });
            }
          });
        }));

        setData(allData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error fetching data'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error, categories: CATEGORIES };
}
