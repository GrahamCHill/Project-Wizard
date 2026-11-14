<script setup>
import { ref } from 'vue';

const title = document.title;
const count = ref(0);
</script>

<template>
  <h1>{{ title }}</h1>
  <button @click="count++">Count {{ count }}</button>
</template>
