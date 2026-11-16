'use client';

import { useEffect, useRef } from 'react';
import Grid from '@moum/grid';
import '@moum/grid/style.css';

const EMPTY_ROWS = [];
const columns = [
  { field: 'code', header: '코드', editable: false },
  { field: 'name', header: '품목', defaultValue: '신규 품목' },
  { field: 'qty', header: '수량', type: 'number', defaultValue: 0 }
];

export default function ProductGrid({ rows = EMPTY_ROWS, onChange }) {
  const host = useRef(null), instance = useRef(null), onChangeRef = useRef(onChange);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    const grid = new Grid(host.current, {
      columns, data: [], label: '품목 편집',
      onChange: event => onChangeRef.current?.(event)
    });
    instance.current = grid;
    return () => { grid.destroy(); instance.current = null; };
  }, []);

  // Replace only when a new query result arrives; setData resets edit history.
  useEffect(() => { instance.current?.setData(rows); }, [rows]);
  return <div ref={host} />;
}
