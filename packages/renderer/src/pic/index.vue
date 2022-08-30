<script setup lang="ts">
import MySplit from '@/layout/MySplit.vue'
import PicLeft from '@/pic/PicLeft.vue'
import PicRight from '@/pic/PicRight.vue'
</script>

<template>
  <MySplit>
    <template #first><PicLeft/></template>
    <template #second><PicRight/></template>
  </MySplit>
</template>

<style></style>
