<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Grid from '@moum/grid';
import '@moum/grid/style.css';

const props = defineProps({ rows: { type: Array, default: () => [] } });
const emit = defineEmits(['change']);
const host = ref(null);
let grid;

onMounted(() => {
  grid = new Grid(host.value, {
    label: '품목 편집',
    columns: [
      { field: 'code', header: '코드', editable: false },
      { field: 'name', header: '품목', defaultValue: '신규 품목' },
      { field: 'qty', header: '수량', type: 'number', defaultValue: 0 }
    ],
    data: props.rows,
    onChange: event => emit('change', event)
  });
});

// Replace only when a new query result arrives; no deep watch on edited cells.
watch(() => props.rows, rows => grid?.setData(rows));
onBeforeUnmount(() => { grid?.destroy(); grid = null; });
</script>

<template>
  <div ref="host"></div>
</template>
